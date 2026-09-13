import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { eq } from 'drizzle-orm';
import { loadAppConfig } from '../../config/app-config.js';
import { createPgPool } from '../../database/connection.js';
import type { DrizzleDb } from '../../database/transaction/transaction.service.js';
import * as schema from '../../database/schema/index.js';
import {
  users,
  merchantProfiles,
  driverProfiles,
  authSessions,
  refreshTokens,
  adminAccounts,
  adminRecoveryCodes,
} from '../../database/schema/identity.js';
import { TokenService } from '../tokens/token.service.js';
import { SessionService } from '../session/session.service.js';
import { AdminCryptoService } from '../admin/admin-crypto.service.js';
import { AdminAuthService } from '../admin/admin-auth.service.js';
import { RedisService } from '../../database/redis/redis.service.js';
import { AppError } from '../../common/errors/app-error.js';
import { generateUuidV7 } from '@platform/utils';
import { ApprovedMerchantGuard } from '../guards/approved-merchant.guard.js';
import { ApprovedDriverGuard } from '../guards/approved-driver.guard.js';
import { AuthController } from '../auth.controller.js';
import {
  bootstrapAdminRbac,
  assignAdminRole,
  SUPER_ADMIN_ROLE_NAME,
} from '../admin/admin-rbac.js';
import { ADMIN_PERMISSIONS } from '../admin/admin-permissions.js';
import { AdminService } from '../../admin/admin.service.js';


describe('Phase 1G Identity & Authentication Integration Suite', () => {

  const config = loadAppConfig();
  let pool: pg.Pool;
  let db: DrizzleDb;
  let redis: RedisService;
  let tokenService: TokenService;
  let sessionService: SessionService;
  let adminCryptoService: AdminCryptoService;
  let adminAuthService: AdminAuthService;
  let authController: AuthController;

  const mockLogger = {
    log: () => {},
    info: () => {},
    warn: () => {},
    error: () => {},
  } as any;

  before(async () => {
    pool = createPgPool(config);
    db = drizzle(pool, { schema });
    redis = new RedisService(mockLogger);
    tokenService = new TokenService(pool, db, mockLogger);
    sessionService = new SessionService(pool, db);
    adminCryptoService = new AdminCryptoService();
    adminAuthService = new AdminAuthService(
      db,
      adminCryptoService,
      redis,
      sessionService,
      tokenService,
      mockLogger,
    );
    authController = new AuthController(
      {} as any,
      tokenService,
      sessionService,
      adminAuthService,
    );

    // Clean up any test data from previous runs
    const testPhones = ['+6281987654321', '+6281112223334', '+6281777888999', '+6281555666777'];
    for (const phone of testPhones) {
      await pool.query('DELETE FROM users WHERE phone = $1', [phone]);
    }
  });

  after(async () => {
    redis.onModuleDestroy();
    await pool.end();
  });

  function createMockExecutionContext(userId: string, audience: string) {
    return {
      switchToHttp: () => ({
        getRequest: () => ({
          user: { id: userId, audience },
        }),
      }),
    } as any;
  }

  describe('1. Canonical User Resolution & Cross-App Profile Separation (No Auto-Creation)', () => {
    const canonicalPhone = '+6281987654321';
    let canonicalUserId: string;

    it('1. New phone authenticating through CUSTOMER_APP creates one canonical User and Customer profile, but NO Merchant/Driver profile', async () => {
      const customerSession = await sessionService.resolveOrCreateCanonicalUser(
        canonicalPhone,
        'CUSTOMER_APP',
      );
      assert.ok(customerSession.user.id);
      canonicalUserId = customerSession.user.id;
      assert.ok(customerSession.customerProfile?.id);
      assert.equal(customerSession.merchantProfile, null, 'Must NOT auto-create merchant profile');
      assert.equal(customerSession.driverProfile, null, 'Must NOT auto-create driver profile');
    });

    it('2. Same canonical User authenticating through PARTNER_APP without existing merchant profile succeeds with merchant_profile = null', async () => {
      const partnerSession = await sessionService.resolveOrCreateCanonicalUser(
        canonicalPhone,
        'PARTNER_APP',
      );
      assert.equal(
        partnerSession.user.id,
        canonicalUserId,
        'Partner login must resolve to the SAME canonical user',
      );
      assert.equal(partnerSession.merchantProfile, null, 'Must NOT auto-create merchant profile');

      // Verify in DB that no merchant profile row was inserted
      const dbMerchant = await db
        .select()
        .from(merchantProfiles)
        .where(eq(merchantProfiles.userId, canonicalUserId));
      assert.equal(dbMerchant.length, 0, 'No merchant_profiles row must exist in DB');

      // Verify /me (getUserIdentity) reports merchant_profile = null
      const me = await sessionService.getUserIdentity(canonicalUserId);
      assert.equal(me.merchantProfile, null);
    });

    it('2b. Dual-audience compatibility: same canonical User authenticating through legacy MERCHANT_APP also succeeds with merchant_profile = null', async () => {
      const merchantSession = await sessionService.resolveOrCreateCanonicalUser(
        canonicalPhone,
        'MERCHANT_APP',
      );
      assert.equal(
        merchantSession.user.id,
        canonicalUserId,
        'Merchant login must resolve to the SAME canonical user',
      );
      assert.equal(merchantSession.merchantProfile, null, 'Must NOT auto-create merchant profile');
    });

    it('3. Same canonical User authenticating through DRIVER_APP without existing driver profile succeeds with driver_profile = null', async () => {
      const driverSession = await sessionService.resolveOrCreateCanonicalUser(
        canonicalPhone,
        'DRIVER_APP',
      );
      assert.equal(
        driverSession.user.id,
        canonicalUserId,
        'Driver login must resolve to the SAME canonical user',
      );
      assert.equal(driverSession.driverProfile, null, 'Must NOT auto-create driver profile');

      // Verify in DB that no driver profile row was inserted
      const dbDriver = await db
        .select()
        .from(driverProfiles)
        .where(eq(driverProfiles.userId, canonicalUserId));
      assert.equal(dbDriver.length, 0, 'No driver_profiles row must exist in DB');

      // Verify /me (getUserIdentity) reports driver_profile = null
      const me = await sessionService.getUserIdentity(canonicalUserId);
      assert.equal(me.driverProfile, null);
    });

    it('4. Pre-existing Merchant profile: PENDING status allows authentication but ApprovedMerchantGuard rejects with 403', async () => {
      // Simulate Phase 2 onboarding having created a PENDING merchant profile
      const merchantProfileId = generateUuidV7();
      await db.insert(merchantProfiles).values({
        id: merchantProfileId,
        userId: canonicalUserId,
        businessName: 'Torang Cafe',
        status: 'PENDING',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Authentication succeeds and /me honestly reports PENDING status
      const partnerSession = await sessionService.resolveOrCreateCanonicalUser(
        canonicalPhone,
        'PARTNER_APP',
      );
      assert.ok(partnerSession.merchantProfile);
      assert.equal(partnerSession.merchantProfile.status, 'PENDING');

      // ApprovedMerchantGuard queries database and blocks operational action
      const guard = new ApprovedMerchantGuard(db);
      const ctx = createMockExecutionContext(canonicalUserId, 'PARTNER_APP');
      await assert.rejects(
        async () => guard.canActivate(ctx),
        (err: any) => {
          assert.ok(err instanceof AppError);
          assert.equal(err.statusCode, 403);
          assert.equal(err.code, 'AUTH_FORBIDDEN');
          assert.equal(err.details?.profile_status, 'PENDING');
          return true;
        },
      );
    });

    it('5. Pre-existing Merchant profile: APPROVED status allows operational requests through ApprovedMerchantGuard', async () => {
      // Update merchant status to APPROVED
      await db
        .update(merchantProfiles)
        .set({ status: 'APPROVED', updatedAt: new Date() })
        .where(eq(merchantProfiles.userId, canonicalUserId));

      const guard = new ApprovedMerchantGuard(db);
      const ctx = createMockExecutionContext(canonicalUserId, 'PARTNER_APP');
      const allowed = await guard.canActivate(ctx);
      assert.equal(allowed, true);
    });

    it('6. Pre-existing Driver profile: PENDING rejects and APPROVED allows through ApprovedDriverGuard', async () => {
      // Simulate pre-existing PENDING driver profile
      const driverProfileId = generateUuidV7();
      await db.insert(driverProfiles).values({
        id: driverProfileId,
        userId: canonicalUserId,
        fullName: 'Budi Manado',
        status: 'PENDING',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // PENDING check
      const guard = new ApprovedDriverGuard(db);
      const ctx = createMockExecutionContext(canonicalUserId, 'DRIVER_APP');
      await assert.rejects(
        async () => guard.canActivate(ctx),
        (err: any) => {
          assert.ok(err instanceof AppError);
          assert.equal(err.statusCode, 403);
          assert.equal(err.code, 'AUTH_FORBIDDEN');
          assert.equal(err.details?.profile_status, 'PENDING');
          return true;
        },
      );

      // Update driver status to APPROVED
      await db
        .update(driverProfiles)
        .set({ status: 'APPROVED', updatedAt: new Date() })
        .where(eq(driverProfiles.userId, canonicalUserId));

      const allowed = await guard.canActivate(ctx);
      assert.equal(allowed, true);
    });

    it('7. Concurrent authentication with identical phone resolves atomically to ONE canonical User', async () => {
      const concurrentPhone = '+6281555666777';

      // Concurrently authenticate across multiple apps (including PARTNER_APP and legacy MERCHANT_APP)
      const [res1, res2, res3, res4] = await Promise.all([
        sessionService.resolveOrCreateCanonicalUser(concurrentPhone, 'CUSTOMER_APP'),
        sessionService.resolveOrCreateCanonicalUser(concurrentPhone, 'PARTNER_APP'),
        sessionService.resolveOrCreateCanonicalUser(concurrentPhone, 'MERCHANT_APP'),
        sessionService.resolveOrCreateCanonicalUser(concurrentPhone, 'DRIVER_APP'),
      ]);

      assert.equal(res1.user.id, res2.user.id);
      assert.equal(res2.user.id, res3.user.id);
      assert.equal(res3.user.id, res4.user.id);

      // Verify exactly one row exists in users table
      const dbRows = await db.select().from(users).where(eq(users.phone, concurrentPhone));
      assert.equal(dbRows.length, 1);
    });
  });

  describe('2. Refresh Token Rotation & Reuse Detection (Family Revocation)', () => {
    it('rotates refresh token cleanly and marks old token consumed with replacement pointer', async () => {
      const testPhone = '+6281112223334';
      const resolution = await sessionService.resolveOrCreateCanonicalUser(
        testPhone,
        'CUSTOMER_APP',
      );

      const session = await sessionService.createSession({
        userId: resolution.user.id,
        audience: 'CUSTOMER_APP',
        ttlSeconds: 604800,
      });

      // 1. Issue initial token pair
      const tokens1 = await tokenService.issueTokenPair({
        sub: resolution.user.id,
        sid: session.sessionId,
        aud: 'CUSTOMER_APP',
      });
      assert.ok(tokens1.accessToken);
      assert.ok(tokens1.refreshToken);

      // 2. Rotate token pair with tokens1.refreshToken
      const tokens2 = await tokenService.rotateRefreshToken(tokens1.refreshToken);
      assert.ok(tokens2.accessToken);
      assert.ok(tokens2.refreshToken);
      assert.notEqual(tokens2.refreshToken, tokens1.refreshToken, 'New refresh token must be distinct');

      // 3. Verify in DB that old refresh token is marked consumed
      const oldHash = tokenService.hashToken(tokens1.refreshToken);
      const newHash = tokenService.hashToken(tokens2.refreshToken);

      const oldRows = await db
        .select()
        .from(refreshTokens)
        .where(eq(refreshTokens.tokenHash, oldHash));
      assert.equal(oldRows.length, 1);
      assert.equal(oldRows[0].isConsumed, true);
      assert.ok(oldRows[0].consumedAt);

      const newRows = await db
        .select()
        .from(refreshTokens)
        .where(eq(refreshTokens.tokenHash, newHash));
      assert.equal(newRows.length, 1);
      assert.equal(oldRows[0].familyId, newRows[0].familyId);

      // 4. REUSE DETECTION ATTACK: Attacker attempts to replay the already-rotated tokens1.refreshToken!
      await assert.rejects(
        async () => {
          await tokenService.rotateRefreshToken(tokens1.refreshToken);
        },
        (err: any) => {
          assert.ok(err instanceof AppError);
          assert.equal(err.code, 'AUTH_REFRESH_REUSE_DETECTED');
          assert.equal(err.statusCode, 401);
          return true;
        },
      );

      // 5. Verify session status was set to REVOKED due to reuse detection
      const sessionRows = await db
        .select()
        .from(authSessions)
        .where(eq(authSessions.id, session.sessionId));
      assert.equal(sessionRows[0].status, 'REVOKED', 'Session must be revoked after reuse detection');
    });
  });

  describe('3. Session Logout & Logout-All Operations', () => {
    it('revokes single session on logout and all user sessions on logout-all', async () => {
      const testPhone = '+6281777888999';
      const resolution = await sessionService.resolveOrCreateCanonicalUser(
        testPhone,
        'CUSTOMER_APP',
      );

      // Create session A
      const sessA = await sessionService.createSession({
        userId: resolution.user.id,
        audience: 'CUSTOMER_APP',
        ttlSeconds: 604800,
      });
      await tokenService.issueTokenPair({
        sub: resolution.user.id,
        sid: sessA.sessionId,
        aud: 'CUSTOMER_APP',
      });

      // Create session B
      const sessB = await sessionService.createSession({
        userId: resolution.user.id,
        audience: 'CUSTOMER_APP',
        ttlSeconds: 604800,
      });
      await tokenService.issueTokenPair({
        sub: resolution.user.id,
        sid: sessB.sessionId,
        aud: 'CUSTOMER_APP',
      });

      // Logout sessA
      await tokenService.revokeSession(sessA.sessionId);
      const checkA = await db.select().from(authSessions).where(eq(authSessions.id, sessA.sessionId));
      assert.equal(checkA[0].status, 'REVOKED');

      // sessB remains active
      const checkB = await db.select().from(authSessions).where(eq(authSessions.id, sessB.sessionId));
      assert.equal(checkB[0].status, 'ACTIVE');

      // Logout-all for user
      await tokenService.revokeAllUserSessions(resolution.user.id);
      const checkBAfter = await db.select().from(authSessions).where(eq(authSessions.id, sessB.sessionId));
      assert.equal(checkBAfter[0].status, 'REVOKED');
    });
  });

  describe('4. Admin Two-Step Authentication (Argon2id + TOTP + Recovery Codes)', () => {
    const adminEmail = 'security-audit@toranggo.com';
    const adminUsername = 'securityaudit';
    const adminPassword = 'AuditSecurePassword2026!';
    let adminId: string;
    let totpSecretPlain: string;
    let recoveryCodesPlain: string[];

    before(async () => {
      // Clean up previous test run if exists
      const existing = await db
        .select()
        .from(adminAccounts)
        .where(eq(adminAccounts.username, adminUsername));
      if (existing.length > 0) {
        await db.delete(adminAccounts).where(eq(adminAccounts.id, existing[0].id));
      }

      // Provision test admin account
      adminId = generateUuidV7();
      const passwordHash = await adminCryptoService.hashPassword(adminPassword);
      totpSecretPlain = adminCryptoService.generateTotpSecret();
      const totpEncrypted = adminCryptoService.encryptSecret(totpSecretPlain);
      const recovery = adminCryptoService.generateRecoveryCodes(4);
      recoveryCodesPlain = recovery.rawCodes;

      await db
        .insert(adminAccounts)
        .values({
          id: adminId,
          email: adminEmail,
          username: adminUsername,
          passwordHash,
          totpSecretEncrypted: totpEncrypted,
          status: 'ACTIVE',
        });

      // Insert recovery codes
      for (const hash of recovery.hashedCodes) {
        await db.insert(adminRecoveryCodes).values({
          id: generateUuidV7(),
          adminId,
          codeHash: hash,
        });
      }
    });

    it('Step 1: validates credentials and returns MFA challenge token without enumeration', async () => {
      // Valid credentials -> returns challenge
      const res = await adminAuthService.login(adminEmail, adminPassword);

      assert.equal(res.mfaRequired, true);
      assert.ok(res.mfaChallengeToken);

      // Non-existent admin -> timing-safe generic rejection
      await assert.rejects(
        async () => {
          await adminAuthService.login('nonexistent@toranggo.com', 'SomePassword123!');
        },
        (err: any) => {
          assert.equal(err.code, 'AUTH_INVALID_CREDENTIALS');
          assert.equal(err.statusCode, 401);
          return true;
        },
      );

      // Bad password -> identical generic rejection
      await assert.rejects(
        async () => {
          await adminAuthService.login(adminEmail, 'WrongPassword!');
        },
        (err: any) => {
          assert.equal(err.code, 'AUTH_INVALID_CREDENTIALS');
          assert.equal(err.statusCode, 401);
          return true;
        },
      );
    });

    it('Step 2 (TOTP): verifies 6-digit TOTP code and completes authentication', async () => {
      const step1 = await adminAuthService.login(adminUsername, adminPassword);

      const validTotp = adminCryptoService.generateTotpCode(totpSecretPlain);

      const verifyResult = await adminAuthService.verifyMfa({
        mfaChallengeToken: step1.mfaChallengeToken,
        code: validTotp,
      });

      assert.equal(verifyResult.admin.id, adminId);
      assert.equal(verifyResult.admin.email, adminEmail);
      assert.ok(verifyResult.csrfToken);
      assert.ok(verifyResult.csrfToken.length >= 32);
      assert.ok(verifyResult.accessToken);
    });

    it('Step 2 (Recovery Code): consumes single-use recovery code and prevents reuse', async () => {
      const step1 = await adminAuthService.login(adminEmail, adminPassword);

      const recoveryCode = recoveryCodesPlain[0];

      // 1st use succeeds
      const verifyResult = await adminAuthService.verifyMfa({
        mfaChallengeToken: step1.mfaChallengeToken,
        code: recoveryCode,
      });
      assert.equal(verifyResult.admin.id, adminId);

      // Verify in DB that code is marked used
      const codeHash = adminCryptoService.hashRecoveryCode(recoveryCode);
      const codeRows = await db
        .select()
        .from(adminRecoveryCodes)
        .where(eq(adminRecoveryCodes.codeHash, codeHash));
      assert.equal(codeRows[0].isUsed, true);
      assert.ok(codeRows[0].usedAt);

      // 2nd use of SAME recovery code must be rejected
      const step1Again = await adminAuthService.login(adminEmail, adminPassword);

      await assert.rejects(
        async () => {
          await adminAuthService.verifyMfa({
            mfaChallengeToken: step1Again.mfaChallengeToken,
            code: recoveryCode,
          });
        },
        (err: any) => {
          assert.equal(err.code, 'AUTH_MFA_INVALID');
          assert.equal(err.statusCode, 401);
          return true;
        },
      );
    });
  });

  describe('5. Admin Cookie Transport & HttpOnly Refresh Lifecycle', () => {
    const adminEmail = 'cookie-audit@toranggo.com';
    const adminUsername = 'cookieaudit';
    const adminPassword = 'AuditSecurePassword2026!';
    let adminId: string;
    let totpSecretPlain: string;
    let latestAccessCookie: string;
    let latestRefreshCookie: string;
    let adminSessionId: string;

    before(async () => {
      // Clean up previous test run if exists
      const existing = await db
        .select()
        .from(adminAccounts)
        .where(eq(adminAccounts.username, adminUsername));
      if (existing.length > 0) {
        await db.delete(adminAccounts).where(eq(adminAccounts.id, existing[0].id));
      }

      adminId = generateUuidV7();
      const passwordHash = await adminCryptoService.hashPassword(adminPassword);
      totpSecretPlain = adminCryptoService.generateTotpSecret();
      const totpEncrypted = adminCryptoService.encryptSecret(totpSecretPlain);

      await db.insert(adminAccounts).values({
        id: adminId,
        email: adminEmail,
        username: adminUsername,
        passwordHash,
        totpSecretEncrypted: totpEncrypted,
        status: 'ACTIVE',
      });
    });

    it('1-6: Admin MFA verification sets toranggo_admin_access, toranggo_admin_refresh, and toranggo_admin_csrf with HttpOnly and explicit SameSite', async () => {
      const step1 = await adminAuthService.login(adminUsername, adminPassword);
      const code = adminCryptoService.generateTotpCode(totpSecretPlain);

      const cookies: Record<string, { val: string; opts: any }> = {};
      const mockRes = {
        cookie: (name: string, val: string, opts: any) => {
          cookies[name] = { val, opts };
        },
      } as any;
      const mockReq = {
        headers: {},
        ip: '127.0.0.1',
      } as any;

      const result = await authController.adminMfaVerify(
        { mfa_challenge_token: step1.mfaChallengeToken, code },
        mockReq,
        mockRes,
      );

      assert.ok(result.access_token, 'Must return access token in response');
      assert.ok(result.csrf_token, 'Must return csrf token in response');
      assert.equal((result as any).refresh_token, undefined, 'Must NOT return raw refresh token in response body to Admin JS');

      // 1 & 3 & 5 & 6. Access Cookie checks
      assert.ok(cookies['toranggo_admin_access'], 'toranggo_admin_access cookie must be set');
      assert.equal(cookies['toranggo_admin_access'].opts.httpOnly, true, 'Access cookie must be HttpOnly');
      assert.equal(cookies['toranggo_admin_access'].opts.path, '/', 'Access cookie path must be /');
      assert.equal(cookies['toranggo_admin_access'].opts.sameSite, 'lax', 'Access cookie SameSite must be lax');
      assert.equal(cookies['toranggo_admin_access'].opts.secure, config.isProduction, 'Access cookie secure must match production mode');

      // 2 & 4 & 5 & 6. Refresh Cookie checks
      assert.ok(cookies['toranggo_admin_refresh'], 'toranggo_admin_refresh cookie must be set');
      assert.equal(cookies['toranggo_admin_refresh'].opts.httpOnly, true, 'Refresh cookie must be HttpOnly');
      assert.equal(cookies['toranggo_admin_refresh'].opts.path, '/api/v1/auth', 'Refresh cookie path must be /api/v1/auth');
      assert.equal(cookies['toranggo_admin_refresh'].opts.sameSite, 'lax', 'Refresh cookie SameSite must be lax');
      assert.equal(cookies['toranggo_admin_refresh'].opts.secure, config.isProduction, 'Refresh cookie secure must match production mode');

      // CSRF Cookie check
      assert.ok(cookies['toranggo_admin_csrf'], 'toranggo_admin_csrf cookie must be set');
      assert.equal(cookies['toranggo_admin_csrf'].opts.httpOnly, false, 'CSRF cookie must be browser-readable (httpOnly: false)');

      latestAccessCookie = cookies['toranggo_admin_access'].val;
      latestRefreshCookie = cookies['toranggo_admin_refresh'].val;

      // Extract session ID from access token
      const decoded: any = tokenService.verifyAccessToken(latestAccessCookie);
      adminSessionId = decoded.sid;
    });

    it('7-8: Admin refresh consumes toranggo_admin_refresh cookie without body and rotates both HttpOnly cookies', async () => {
      const cookies: Record<string, { val: string; opts: any }> = {};
      const mockRes = {
        cookie: (name: string, val: string, opts: any) => {
          cookies[name] = { val, opts };
        },
      } as any;
      const mockReq = {
        cookies: {
          toranggo_admin_refresh: latestRefreshCookie,
        },
        headers: {},
      } as any;

      // Call refreshTokens with empty body {}
      const refreshResult = await authController.refreshTokens(
        {} as any,
        mockReq,
        mockRes,
      );

      assert.ok(refreshResult.access_token, 'Must return new access token');
      assert.equal(refreshResult.refresh_token, '', 'Must NOT expose rotated refresh token in body to browser JS');
      assert.equal(refreshResult.audience, 'ADMIN_WEB');

      // Both HttpOnly cookies must be rotated
      assert.ok(cookies['toranggo_admin_access'], 'Must set rotated access cookie');
      assert.notEqual(cookies['toranggo_admin_access'].val, latestAccessCookie, 'Access cookie value must be rotated');
      assert.equal(cookies['toranggo_admin_access'].opts.httpOnly, true);

      assert.ok(cookies['toranggo_admin_refresh'], 'Must set rotated refresh cookie');
      assert.notEqual(cookies['toranggo_admin_refresh'].val, latestRefreshCookie, 'Refresh cookie value must be rotated');
      assert.equal(cookies['toranggo_admin_refresh'].opts.httpOnly, true);
      assert.equal(cookies['toranggo_admin_refresh'].opts.path, '/api/v1/auth');

      // Save for reuse test
      const consumedOldRefresh = latestRefreshCookie;
      latestAccessCookie = cookies['toranggo_admin_access'].val;
      latestRefreshCookie = cookies['toranggo_admin_refresh'].val;

      // 9. Old refresh token reuse triggers reuse detection & revocation
      const mockReuseRes = { cookie: () => {} } as any;
      const mockReuseReq = {
        cookies: { toranggo_admin_refresh: consumedOldRefresh },
      } as any;

      await assert.rejects(
        async () => {
          await authController.refreshTokens({} as any, mockReuseReq, mockReuseRes);
        },
        (err: any) => {
          assert.equal(err.code, 'AUTH_REFRESH_REUSE_DETECTED');
          assert.equal(err.statusCode, 401);
          return true;
        },
      );
    });

    it('10-12: Logout clears all three cookies (access, refresh, csrf) matching issuance paths', async () => {
      const clearedCookies: Record<string, any> = {};
      const mockRes = {
        clearCookie: (name: string, opts: any) => {
          clearedCookies[name] = opts;
        },
      } as any;
      const mockReq = {
        user: { id: adminId, sessionId: adminSessionId, audience: 'ADMIN_WEB' },
      } as any;

      const logoutRes = await authController.logout(mockReq, mockRes);
      assert.equal(logoutRes.success, true);

      // 10. Access cleared
      assert.ok(clearedCookies['toranggo_admin_access']);
      assert.equal(clearedCookies['toranggo_admin_access'].path, '/');
      assert.equal(clearedCookies['toranggo_admin_access'].httpOnly, true);

      // 11. Refresh cleared
      assert.ok(clearedCookies['toranggo_admin_refresh']);
      assert.equal(clearedCookies['toranggo_admin_refresh'].path, '/api/v1/auth');
      assert.equal(clearedCookies['toranggo_admin_refresh'].httpOnly, true);

      // 12. CSRF cleared
      assert.ok(clearedCookies['toranggo_admin_csrf']);
      assert.equal(clearedCookies['toranggo_admin_csrf'].path, '/');
    });

    it('13: Logout-all clears all three cookies and revokes all sessions', async () => {
      const clearedCookies: Record<string, any> = {};
      const mockRes = {
        clearCookie: (name: string, opts: any) => {
          clearedCookies[name] = opts;
        },
      } as any;
      const mockReq = {
        user: { id: adminId, sessionId: adminSessionId, audience: 'ADMIN_WEB' },
      } as any;

      const logoutAllRes = await authController.logoutAll(mockReq, mockRes);
      assert.equal(logoutAllRes.success, true);

      assert.ok(clearedCookies['toranggo_admin_access']);
      assert.ok(clearedCookies['toranggo_admin_refresh']);
      assert.ok(clearedCookies['toranggo_admin_csrf']);
    });

    it('16: Mobile refresh flow remains functional with typed body contract and does not set browser cookies', async () => {
      const mobilePhone = '+6281888999000';
      const userRes = await sessionService.resolveOrCreateCanonicalUser(mobilePhone, 'CUSTOMER_APP');
      const mobileSession = await sessionService.createSession({
        userId: userRes.user.id,
        audience: 'CUSTOMER_APP',
        ttlSeconds: 604800,
      });
      const tokenPair = await tokenService.issueTokenPair({
        sub: userRes.user.id,
        sid: mobileSession.sessionId,
        aud: 'CUSTOMER_APP',
      });

      const cookies: Record<string, any> = {};
      const mockRes = {
        cookie: (name: string, val: string, opts: any) => {
          cookies[name] = { val, opts };
        },
      } as any;
      const mockReq = {
        cookies: {},
        headers: {},
      } as any;

      // Mobile sends refresh_token in body
      const refreshed = await authController.refreshTokens(
        { refresh_token: tokenPair.refreshToken },
        mockReq,
        mockRes,
      );

      assert.ok(refreshed.access_token, 'Mobile must receive new access token');
      assert.ok(refreshed.refresh_token, 'Mobile must receive new refresh token in body');
      assert.notEqual(refreshed.refresh_token, '', 'Mobile refresh token must NOT be empty');
      assert.equal(refreshed.audience, 'CUSTOMER_APP');
      assert.equal(Object.keys(cookies).length, 0, 'Must NOT set browser cookies for mobile refresh');
    });
  });

  describe('8. Phase 2A1 Admin Core & RBAC Database Integration', () => {
    let testAdminId: string;

    it('17: Bootstraps RBAC idempotently and assigns SUPER_ADMIN role to admin in PostgreSQL', async () => {
      // 1. Run bootstrap
      const bootstrapRes = await bootstrapAdminRbac(pool);
      assert.ok(bootstrapRes.superAdminRoleId);
      assert.equal(bootstrapRes.permissionCodes.length, 4);

      // 2. Run repeated bootstrap (idempotency verification)
      const repeatRes = await bootstrapAdminRbac(pool);
      assert.equal(repeatRes.superAdminRoleId, bootstrapRes.superAdminRoleId);

      // 3. Create active admin account
      testAdminId = generateUuidV7();
      const pHash = await adminCryptoService.hashPassword('SuperAdminPass123!');
      await pool.query(
        `INSERT INTO admin_accounts (id, username, email, password_hash, status, mfa_enabled, created_at, updated_at)
         VALUES ($1, 'e2e-superadmin', 'e2e-superadmin@toranggo.local', $2, 'ACTIVE', false, NOW(), NOW())
         ON CONFLICT (username) DO NOTHING;`,
        [testAdminId, pHash],
      );

      // 4. Assign SUPER_ADMIN role
      await assignAdminRole(pool, testAdminId, SUPER_ADMIN_ROLE_NAME);

      // 5. Query permissions via SessionService
      const permSummary = await sessionService.getAdminPermissions(testAdminId);
      assert.equal(permSummary.admin.username, 'e2e-superadmin');
      assert.ok(permSummary.roles.includes('SUPER_ADMIN'));
      assert.ok(permSummary.permissions.includes(ADMIN_PERMISSIONS.ACCESS));
      assert.ok(permSummary.permissions.includes(ADMIN_PERMISSIONS.READ));
      assert.ok(permSummary.permissions.includes(ADMIN_PERMISSIONS.WRITE));
      assert.ok(permSummary.permissions.includes(ADMIN_PERMISSIONS.OPS));
    });

    it('18: AdminService.getOverview queries real database counts without mutations', async () => {
      const adminService = new AdminService(pool);

      // Initial query
      const initialOverview = await adminService.getOverview();
      assert.equal(typeof initialOverview.users.total, 'number');
      assert.equal(typeof initialOverview.merchants.total, 'number');
      assert.equal(typeof initialOverview.drivers.total, 'number');

      // Insert controlled test records
      const testUserId = generateUuidV7();
      await pool.query(
        `INSERT INTO users (id, phone, status, created_at, updated_at)
         VALUES ($1, '+6289990001111', 'ACTIVE', NOW(), NOW());`,
        [testUserId],
      );

      const testMerchantId = generateUuidV7();
      await pool.query(
        `INSERT INTO merchant_profiles (id, user_id, business_name, status, created_at, updated_at)
         VALUES ($1, $2, 'Test Warung 2A1', 'PENDING', NOW(), NOW());`,
        [testMerchantId, testUserId],
      );

      const testDriverId = generateUuidV7();
      await pool.query(
        `INSERT INTO driver_profiles (id, user_id, full_name, status, created_at, updated_at)
         VALUES ($1, $2, 'Test Driver 2A1', 'APPROVED', NOW(), NOW());`,
        [testDriverId, testUserId],
      );

      // Subsequent query must reflect real count increments
      const updatedOverview = await adminService.getOverview();
      assert.equal(updatedOverview.users.total, initialOverview.users.total + 1);
      assert.equal(updatedOverview.merchants.total, initialOverview.merchants.total + 1);
      assert.equal(updatedOverview.merchants.pending, initialOverview.merchants.pending + 1);
      assert.equal(updatedOverview.drivers.total, initialOverview.drivers.total + 1);
      assert.equal(updatedOverview.drivers.approved, initialOverview.drivers.approved + 1);

      // Clean up test records
      await pool.query('DELETE FROM driver_profiles WHERE id = $1', [testDriverId]);
      await pool.query('DELETE FROM merchant_profiles WHERE id = $1', [testMerchantId]);
      await pool.query('DELETE FROM users WHERE id = $1', [testUserId]);
    });
  });
});
