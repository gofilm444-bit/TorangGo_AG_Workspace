import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import { TokenService } from './token.service.js';
import { AppError } from '../../common/errors/app-error.js';
import { loadAppConfig } from '../../config/app-config.js';

describe('TokenService Cryptographic & Claim Foundations', () => {
  const dummyPool = {} as any;
  const dummyDb = {} as any;
  const dummyLogger = {
    info: () => {},
    warn: () => {},
    error: () => {},
  } as any;

  const service = new TokenService(dummyPool, dummyDb, dummyLogger);
  const config = loadAppConfig();

  describe('Refresh Token Hashing (SHA-256)', () => {
    it('generates deterministic 64-character SHA-256 hex digest', () => {
      const rawToken = '4c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d';
      const hash1 = service.hashToken(rawToken);
      const hash2 = service.hashToken(rawToken);

      assert.equal(hash1, hash2, 'Hash must be deterministic');
      assert.equal(hash1.length, 64, 'SHA-256 must produce 64 hex characters');
      assert.notEqual(hash1, rawToken, 'Raw token must never equal hash');
    });
  });

  describe('Access Token Issuance & Claims', () => {
    it('signs access token with all required RFC claims and zero mutable business state', () => {
      const sub = '01956e12-3456-7890-abcd-ef0123456789';
      const sid = '01956e12-3456-7890-abcd-ef012345678a';
      const aud = 'CUSTOMER_APP';

      const token = service.signAccessToken({ sub, sid, aud });
      assert.ok(token, 'Access token must be generated');

      const claims = service.verifyAccessToken(token);
      assert.equal(claims.iss, config.authIssuer, 'Issuer must match config');
      assert.equal(claims.sub, sub, 'Subject must match user ID');
      assert.equal(claims.sid, sid, 'Session ID must match session');
      assert.equal(claims.aud, aud, 'Audience must match application');
      assert.ok(claims.jti, 'JWT ID must be present for revocation tracing');
      assert.ok(claims.iat, 'Issued-at timestamp must be present');
      assert.ok(claims.exp, 'Expiration timestamp must be present');
      assert.equal(claims.exp - claims.iat, config.authAccessTokenTtl, 'TTL must match config');

      // Crucial security guarantee: NO mutable business status in claims
      assert.equal((claims as any).status, undefined, 'Status must not be in token claims');
      assert.equal((claims as any).merchant_status, undefined, 'Merchant status must not be in claims');
      assert.equal((claims as any).roles, undefined, 'Roles must not be in mobile claims');
    });

    it('rejects expired access token with AUTH_SESSION_EXPIRED', () => {
      // Craft expired token with valid signature
      const expiredPayload = {
        iss: config.authIssuer,
        sub: 'user-123',
        sid: 'sess-123',
        aud: 'CUSTOMER_APP',
        jti: 'jti-123',
        iat: Math.floor(Date.now() / 1000) - 3600,
        exp: Math.floor(Date.now() / 1000) - 1800, // Expired 30 mins ago
      };

      const expiredToken = jwt.sign(expiredPayload, config.authJwtSecret, { algorithm: 'HS256' });

      assert.throws(
        () => service.verifyAccessToken(expiredToken),
        (err: any) => {
          assert.ok(err instanceof AppError);
          assert.equal(err.code, 'AUTH_SESSION_EXPIRED');
          assert.equal(err.statusCode, 401);
          return true;
        },
      );
    });

    it('rejects tampered access token signature with UNAUTHORIZED', () => {
      const token = service.signAccessToken({
        sub: 'user-123',
        sid: 'sess-123',
        aud: 'CUSTOMER_APP',
      });

      // Alter signature
      const tampered = token.slice(0, -4) + 'abcd';

      assert.throws(
        () => service.verifyAccessToken(tampered),
        (err: any) => {
          assert.ok(err instanceof AppError);
          assert.equal(err.code, 'UNAUTHORIZED');
          assert.equal(err.statusCode, 401);
          return true;
        },
      );
    });
  });
});
