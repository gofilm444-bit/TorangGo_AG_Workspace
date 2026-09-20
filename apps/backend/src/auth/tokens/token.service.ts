import { Injectable, Inject } from '@nestjs/common';
import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { eq, and } from 'drizzle-orm';
import type pg from 'pg';
import { PG_POOL_TOKEN, DRIZZLE_DB_TOKEN } from '../../database/database.tokens.js';
import type { DrizzleDb } from '../../database/transaction/transaction.service.js';
import {
  authSessions,
  refreshTokens,
  users,
  adminAccounts,
} from '../../database/schema/identity.js';
import { loadAppConfig, type AppConfig } from '../../config/app-config.js';
import { StructuredLogger } from '../../common/logging/logger.service.js';
import { AppError } from '../../common/errors/app-error.js';
import { generateUuidV7 } from '@platform/utils';
import type { AppAudience } from '@platform/shared-types';
import type { AccessTokenClaims, IssuedTokens } from './token.types.js';

@Injectable()
export class TokenService {
  private readonly config: AppConfig;

  constructor(
    @Inject(PG_POOL_TOKEN)
    private readonly pool: pg.Pool,
    @Inject(DRIZZLE_DB_TOKEN)
    private readonly db: DrizzleDb,
    private readonly logger: StructuredLogger,
  ) {
    this.config = loadAppConfig();
  }

  /**
   * Hash raw opaque refresh token using SHA-256 for safe database storage.
   */
  hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  /**
   * Generate signed JWT access token. Zero mutable business state in claims!
   */
  signAccessToken(params: {
    sub: string;
    sid: string;
    aud: AppAudience;
  }): string {
    const { sub, sid, aud } = params;
    const nowSec = Math.floor(Date.now() / 1000);
    const expSec = nowSec + this.config.authAccessTokenTtl;

    const payload: AccessTokenClaims = {
      iss: this.config.authIssuer,
      sub,
      sid,
      aud,
      jti: generateUuidV7(),
      iat: nowSec,
      exp: expSec,
    };

    return jwt.sign(payload, this.config.authJwtSecret, {
      algorithm: 'HS256',
    });
  }

  /**
   * Verify and decode JWT access token.
   */
  verifyAccessToken(token: string): AccessTokenClaims {
    try {
      const decoded = jwt.verify(token, this.config.authJwtSecret, {
        issuer: this.config.authIssuer,
        algorithms: ['HS256'],
      }) as AccessTokenClaims;

      if (!decoded.sub || !decoded.sid || !decoded.aud) {
        throw new AppError(401, 'AUTH_SESSION_EXPIRED', 'Malformed access token claims');
      }

      return decoded;
    } catch (err) {
      if (err instanceof AppError) throw err;
      const message = (err as Error).message;
      if (message.includes('expired')) {
        throw new AppError(401, 'AUTH_SESSION_EXPIRED', 'Access token has expired');
      }
      throw new AppError(401, 'UNAUTHORIZED', 'Invalid access token');
    }
  }

  /**
   * Issue a fresh token pair (access token + opaque refresh token).
   */
  async issueTokenPair(params: {
    sub: string;
    sid: string;
    aud: AppAudience;
    familyId?: string;
  }): Promise<IssuedTokens> {
    const { sub, sid, aud } = params;
    const familyId = params.familyId ?? generateUuidV7();
    const tokenId = generateUuidV7();

    // High entropy opaque refresh token (64 hex characters)
    const rawRefreshToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = this.hashToken(rawRefreshToken);

    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.config.authRefreshTokenTtl * 1000);

    await this.db.insert(refreshTokens).values({
      id: tokenId,
      sessionId: sid,
      tokenHash,
      familyId,
      isConsumed: false,
      consumedAt: null,
      createdAt: now,
      expiresAt,
    });

    const accessToken = this.signAccessToken({ sub, sid, aud });

    return {
      accessToken,
      refreshToken: rawRefreshToken,
      tokenType: 'Bearer',
      expiresInSeconds: this.config.authAccessTokenTtl,
      audience: aud,
      sessionId: sid,
    };
  }

  /**
   * Rotate a refresh token with automatic reuse detection.
   */
  async rotateRefreshToken(rawRefreshToken: string): Promise<IssuedTokens> {
    if (!rawRefreshToken || typeof rawRefreshToken !== 'string') {
      throw new AppError(401, 'AUTH_SESSION_EXPIRED', 'Invalid refresh token format');
    }

    const tokenHash = this.hashToken(rawRefreshToken);

    const tokenRows = await this.db
      .select()
      .from(refreshTokens)
      .where(eq(refreshTokens.tokenHash, tokenHash))
      .limit(1);

    const token = tokenRows[0];

    if (!token) {
      throw new AppError(401, 'AUTH_SESSION_EXPIRED', 'Invalid or unknown refresh token');
    }

    // ── REUSE DETECTION ──────────────────────────────────────────────────────────
    // If a consumed token is presented again, someone might be attempting a replay attack.
    // Revoke the entire token family and associated session immediately!
    if (token.isConsumed) {
      this.logger.warn({
        event: 'AUTH_REFRESH_REUSE_DETECTED',
        session_id: token.sessionId,
        family_id: token.familyId,
        message: 'Refresh token reuse detected! Immediately revoking session and token family.',
      });

      // Revoke session and all tokens in family
      await this.db
        .update(authSessions)
        .set({ status: 'REVOKED', updatedAt: new Date() })
        .where(eq(authSessions.id, token.sessionId));

      await this.db
        .update(refreshTokens)
        .set({ isConsumed: true, consumedAt: new Date() })
        .where(eq(refreshTokens.familyId, token.familyId));

      throw new AppError(
        401,
        'AUTH_REFRESH_REUSE_DETECTED',
        'Security alert: Refresh token reuse detected. Your session has been revoked. Please log in again.',
      );
    }

    // Check refresh token expiration
    if (token.expiresAt.getTime() <= Date.now()) {
      throw new AppError(401, 'AUTH_SESSION_EXPIRED', 'Refresh token has expired');
    }

    // Check associated session
    const sessionRows = await this.db
      .select()
      .from(authSessions)
      .where(eq(authSessions.id, token.sessionId))
      .limit(1);

    const session = sessionRows[0];

    if (!session || session.status !== 'ACTIVE' || session.expiresAt.getTime() <= Date.now()) {
      throw new AppError(401, 'AUTH_SESSION_REVOKED', 'Session has been revoked or expired');
    }

    // Check user / admin status
    let principalId: string;
    if (session.userId) {
      principalId = session.userId;
      const userRows = await this.db
        .select()
        .from(users)
        .where(eq(users.id, session.userId))
        .limit(1);
      if (!userRows[0] || userRows[0].status !== 'ACTIVE') {
        throw new AppError(403, 'AUTH_FORBIDDEN', 'User account is not active');
      }
    } else if (session.adminId) {
      principalId = session.adminId;
      const adminRows = await this.db
        .select()
        .from(adminAccounts)
        .where(eq(adminAccounts.id, session.adminId))
        .limit(1);
      if (!adminRows[0] || adminRows[0].status !== 'ACTIVE') {
        throw new AppError(403, 'AUTH_FORBIDDEN', 'Admin account is not active');
      }
    } else {
      throw new AppError(401, 'AUTH_SESSION_REVOKED', 'Session principal not found');
    }

    // Consume old token
    await this.db
      .update(refreshTokens)
      .set({ isConsumed: true, consumedAt: new Date() })
      .where(eq(refreshTokens.id, token.id));

    // Issue rotated replacement token within same family
    return this.issueTokenPair({
      sub: principalId,
      sid: session.id,
      aud: session.audience as AppAudience,
      familyId: token.familyId,
    });
  }

  /**
   * Revoke a single session and mark its tokens consumed.
   */
  async revokeSession(sessionId: string): Promise<void> {
    await this.db
      .update(authSessions)
      .set({ status: 'REVOKED', updatedAt: new Date() })
      .where(eq(authSessions.id, sessionId));

    await this.db
      .update(refreshTokens)
      .set({ isConsumed: true, consumedAt: new Date() })
      .where(eq(refreshTokens.sessionId, sessionId));
  }

  /**
   * Revoke all sessions for a canonical user.
   */
  async revokeAllUserSessions(userId: string): Promise<void> {
    const sessions = await this.db
      .select({ id: authSessions.id })
      .from(authSessions)
      .where(and(eq(authSessions.userId, userId), eq(authSessions.status, 'ACTIVE')));

    await this.db
      .update(authSessions)
      .set({ status: 'REVOKED', updatedAt: new Date() })
      .where(eq(authSessions.userId, userId));

    for (const s of sessions) {
      await this.db
        .update(refreshTokens)
        .set({ isConsumed: true, consumedAt: new Date() })
        .where(eq(refreshTokens.sessionId, s.id));
    }
  }

  /**
   * Revoke all sessions for an admin account.
   */
  async revokeAllAdminSessions(adminId: string): Promise<void> {
    const sessions = await this.db
      .select({ id: authSessions.id })
      .from(authSessions)
      .where(and(eq(authSessions.adminId, adminId), eq(authSessions.status, 'ACTIVE')));

    await this.db
      .update(authSessions)
      .set({ status: 'REVOKED', updatedAt: new Date() })
      .where(eq(authSessions.adminId, adminId));

    for (const s of sessions) {
      await this.db
        .update(refreshTokens)
        .set({ isConsumed: true, consumedAt: new Date() })
        .where(eq(refreshTokens.sessionId, s.id));
    }
  }
}
