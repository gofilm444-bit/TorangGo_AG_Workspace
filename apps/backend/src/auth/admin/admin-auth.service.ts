import { Injectable, Inject } from '@nestjs/common';
import { eq, or } from 'drizzle-orm';
import crypto from 'node:crypto';
import { DRIZZLE_DB_TOKEN } from '../../database/database.tokens.js';
import type { DrizzleDb } from '../../database/transaction/transaction.service.js';
import {
  adminAccounts,
  adminRecoveryCodes,
} from '../../database/schema/identity.js';
import { AdminCryptoService } from './admin-crypto.service.js';
import { RedisService } from '../../database/redis/redis.service.js';
import { SessionService } from '../session/session.service.js';
import { TokenService } from '../tokens/token.service.js';
import { loadAppConfig } from '../../config/app-config.js';
import { StructuredLogger } from '../../common/logging/logger.service.js';
import { AppError } from '../../common/errors/app-error.js';
import { generateUuidV7 } from '@platform/utils';

export interface AdminLoginResult {
  mfaRequired: boolean;
  mfaChallengeToken: string;
}

export interface AdminMfaVerifiedResult {
  accessToken: string;
  refreshToken: string;
  csrfToken: string;
  sessionId: string;
  expiresInSeconds: number;
  admin: {
    id: string;
    username: string;
    email: string;
    roles: string[];
    permissions: string[];
  };
}

@Injectable()
export class AdminAuthService {
  constructor(
    @Inject(DRIZZLE_DB_TOKEN)
    private readonly db: DrizzleDb,
    private readonly adminCrypto: AdminCryptoService,
    private readonly redis: RedisService,
    private readonly sessionService: SessionService,
    private readonly tokenService: TokenService,
    private readonly logger: StructuredLogger,
  ) {}

  /**
   * Step 1: Verify username/email and password. Returns MFA challenge token.
   * Prevents account enumeration by always returning generic AUTH_INVALID_CREDENTIALS.
   */
  async login(identifier: string, password: string): Promise<AdminLoginResult> {
    if (!identifier || !password) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Identifier and password are required');
    }

    const trimmed = identifier.trim().toLowerCase();

    const rows = await this.db
      .select()
      .from(adminAccounts)
      .where(or(eq(adminAccounts.username, trimmed), eq(adminAccounts.email, trimmed)))
      .limit(1);

    const admin = rows[0];

    // Constant-time check: if account not found, still run hash verification against dummy hash
    // to prevent timing attacks / account enumeration
    if (!admin) {
      await this.adminCrypto.verifyPassword(
        '$argon2id$v=19$m=65536,t=3,p=4$c29tZXNhbHQ$P6L6sK3k1iK2iF2aQ5k1gA',
        password,
      );
      throw new AppError(401, 'AUTH_INVALID_CREDENTIALS', 'Invalid login credentials');
    }

    const isPasswordValid = await this.adminCrypto.verifyPassword(admin.passwordHash, password);
    if (!isPasswordValid) {
      throw new AppError(401, 'AUTH_INVALID_CREDENTIALS', 'Invalid login credentials');
    }

    if (admin.status !== 'ACTIVE') {
      throw new AppError(403, 'AUTH_FORBIDDEN', 'Admin account is suspended');
    }

    // MFA is strictly required for ADMIN_WEB!
    const mfaChallengeToken = generateUuidV7();
    const challengePayload = JSON.stringify({
      adminId: admin.id,
      createdAt: new Date().toISOString(),
    });

    // 5-minute TTL for MFA completion
    await this.redis.set(`auth:admin:mfa:${mfaChallengeToken}`, challengePayload, 300);

    return {
      mfaRequired: true,
      mfaChallengeToken,
    };
  }

  /**
   * Step 2: Verify MFA (TOTP code or one-time recovery code).
   */
  async verifyMfa(params: {
    mfaChallengeToken: string;
    code: string;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<AdminMfaVerifiedResult> {
    const { mfaChallengeToken, code, ipAddress, userAgent } = params;

    if (!mfaChallengeToken || !code) {
      throw new AppError(400, 'VALIDATION_ERROR', 'MFA challenge token and verification code are required');
    }

    const challengeKey = `auth:admin:mfa:${mfaChallengeToken}`;
    const rawChallenge = await this.redis.get(challengeKey);

    if (!rawChallenge) {
      throw new AppError(401, 'AUTH_SESSION_EXPIRED', 'MFA challenge has expired. Please log in again.');
    }

    let adminId: string;
    try {
      const parsed = JSON.parse(rawChallenge);
      adminId = parsed.adminId;
    } catch {
      await this.redis.del(challengeKey);
      throw new AppError(401, 'AUTH_SESSION_EXPIRED', 'Corrupted MFA challenge state');
    }

    const adminRows = await this.db
      .select()
      .from(adminAccounts)
      .where(eq(adminAccounts.id, adminId))
      .limit(1);

    const admin = adminRows[0];
    if (!admin || admin.status !== 'ACTIVE') {
      await this.redis.del(challengeKey);
      throw new AppError(403, 'AUTH_FORBIDDEN', 'Admin account is not active');
    }

    const normalizedCode = code.trim();
    let verified = false;

    // A. Verify 6-digit TOTP
    if (/^\d{6}$/.test(normalizedCode)) {
      if (!admin.totpSecretEncrypted) {
        throw new AppError(500, 'INTERNAL_SERVER_ERROR', 'MFA secret configuration error');
      }
      const plainSecret = this.adminCrypto.decryptSecret(admin.totpSecretEncrypted);
      verified = this.adminCrypto.verifyTotpCode(plainSecret, normalizedCode);
    }
    // B. Verify recovery code (format: XXXX-XXXX-XXXX)
    else {
      const codeHash = this.adminCrypto.hashRecoveryCode(normalizedCode);
      const codeRows = await this.db
        .select()
        .from(adminRecoveryCodes)
        .where(eq(adminRecoveryCodes.codeHash, codeHash))
        .limit(1);

      const recoveryRecord = codeRows[0];
      if (recoveryRecord && recoveryRecord.adminId === admin.id && !recoveryRecord.isUsed) {
        verified = true;
        // Mark recovery code used (single-use)
        await this.db
          .update(adminRecoveryCodes)
          .set({ isUsed: true, usedAt: new Date() })
          .where(eq(adminRecoveryCodes.id, recoveryRecord.id));
      }
    }

    if (!verified) {
      throw new AppError(401, 'AUTH_MFA_INVALID', 'Invalid MFA code or recovery code');
    }

    // Invalidate MFA challenge token (single-use)
    await this.redis.del(challengeKey);

    const config = loadAppConfig();

    // Create session in auth_sessions
    const { sessionId } = await this.sessionService.createSession({
      adminId: admin.id,
      audience: 'ADMIN_WEB',
      ipAddress,
      userAgent,
      ttlSeconds: config.authRefreshTokenTtl,
    });

    // Issue tokens
    const tokens = await this.tokenService.issueTokenPair({
      sub: admin.id,
      sid: sessionId,
      aud: 'ADMIN_WEB',
    });

    // Generate CSRF token (32 random bytes hex)
    const csrfToken = crypto.randomBytes(32).toString('hex');

    // Get admin roles and permissions
    const permissionsSummary = await this.sessionService.getAdminPermissions(admin.id);

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      csrfToken,
      sessionId,
      expiresInSeconds: tokens.expiresInSeconds,
      admin: {
        id: admin.id,
        username: admin.username,
        email: admin.email,
        roles: permissionsSummary.roles,
        permissions: permissionsSummary.permissions,
      },
    };
  }
}
