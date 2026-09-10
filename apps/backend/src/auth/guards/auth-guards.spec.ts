import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Reflector } from '@nestjs/core';
import type { ExecutionContext } from '@nestjs/common';
import { AudienceGuard } from './audience.guard.js';
import { ActiveUserGuard } from './active-user.guard.js';
import { ApprovedMerchantGuard } from './approved-merchant.guard.js';
import { ApprovedDriverGuard } from './approved-driver.guard.js';
import { AdminPermissionGuard } from './admin-permission.guard.js';
import { CsrfGuard } from './csrf.guard.js';
import { AppError } from '../../common/errors/app-error.js';

function createMockContext(req: any): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => req,
      getResponse: () => ({}),
      getNext: () => ({}),
    }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as unknown as ExecutionContext;
}

describe('Authentication & Authorization Guards Specification', () => {
  describe('AudienceGuard (Audience Isolation)', () => {
    it('allows access when token audience matches required metadata', () => {
      const reflector = new Reflector();
      reflector.getAllAndOverride = () => ['CUSTOMER_APP'];

      const guard = new AudienceGuard(reflector);
      const ctx = createMockContext({
        user: { id: 'usr-1', audience: 'CUSTOMER_APP' },
      });

      assert.equal(guard.canActivate(ctx), true);
    });

    it('rejects with AUTH_AUDIENCE_MISMATCH when audience does not match', () => {
      const reflector = new Reflector();
      reflector.getAllAndOverride = () => ['MERCHANT_APP'];

      const guard = new AudienceGuard(reflector);
      const ctx = createMockContext({
        user: { id: 'usr-1', audience: 'CUSTOMER_APP' },
      });

      assert.throws(
        () => guard.canActivate(ctx),
        (err: any) => {
          assert.ok(err instanceof AppError);
          assert.equal(err.statusCode, 403);
          assert.equal(err.code, 'AUTH_AUDIENCE_MISMATCH');
          return true;
        },
      );
    });
  });

  describe('ActiveUserGuard (Account Lifecycle)', () => {
    it('allows active users to proceed', async () => {
      const mockDb = {
        select: () => ({
          from: () => ({
            where: () => ({
              limit: async () => [{ status: 'ACTIVE' }],
            }),
          }),
        }),
      } as any;

      const guard = new ActiveUserGuard(mockDb);
      const ctx = createMockContext({
        user: { id: 'usr-1', status: 'ACTIVE' },
      });

      const allowed = await guard.canActivate(ctx);
      assert.equal(allowed, true);
    });

    it('blocks suspended or inactive users with 403 AUTH_FORBIDDEN', async () => {
      const mockDb = {
        select: () => ({
          from: () => ({
            where: () => ({
              limit: async () => [{ status: 'SUSPENDED' }],
            }),
          }),
        }),
      } as any;

      const guard = new ActiveUserGuard(mockDb);
      const ctx = createMockContext({
        user: { id: 'usr-1', status: 'SUSPENDED' },
      });

      await assert.rejects(
        async () => guard.canActivate(ctx),
        (err: any) => {
          assert.ok(err instanceof AppError);
          assert.equal(err.statusCode, 403);
          assert.equal(err.code, 'AUTH_FORBIDDEN');
          return true;
        },
      );
    });
  });

  describe('ApprovedMerchantGuard (Operational Boundary)', () => {
    it('allows operational requests when merchant profile is APPROVED', async () => {
      const mockDb = {
        select: () => ({
          from: () => ({
            where: () => ({
              limit: async () => [{ status: 'APPROVED' }],
            }),
          }),
        }),
      } as any;

      const guard = new ApprovedMerchantGuard(mockDb);
      const ctx = createMockContext({
        user: { id: 'usr-1', audience: 'MERCHANT_APP' },
      });

      const allowed = await guard.canActivate(ctx);
      assert.equal(allowed, true);
    });

    it('blocks non-approved merchant (e.g. PENDING onboarding) with 403 AUTH_FORBIDDEN', async () => {
      const mockDb = {
        select: () => ({
          from: () => ({
            where: () => ({
              limit: async () => [{ status: 'PENDING' }],
            }),
          }),
        }),
      } as any;

      const guard = new ApprovedMerchantGuard(mockDb);
      const ctx = createMockContext({
        user: { id: 'usr-1', audience: 'MERCHANT_APP' },
      });

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
  });

  describe('ApprovedDriverGuard (Operational Boundary)', () => {
    it('allows operational requests when driver profile is APPROVED', async () => {
      const mockDb = {
        select: () => ({
          from: () => ({
            where: () => ({
              limit: async () => [{ status: 'APPROVED' }],
            }),
          }),
        }),
      } as any;

      const guard = new ApprovedDriverGuard(mockDb);
      const ctx = createMockContext({
        user: { id: 'usr-1', audience: 'DRIVER_APP' },
      });

      const allowed = await guard.canActivate(ctx);
      assert.equal(allowed, true);
    });

    it('blocks suspended driver with 403 AUTH_FORBIDDEN', async () => {
      const mockDb = {
        select: () => ({
          from: () => ({
            where: () => ({
              limit: async () => [{ status: 'SUSPENDED' }],
            }),
          }),
        }),
      } as any;

      const guard = new ApprovedDriverGuard(mockDb);
      const ctx = createMockContext({
        user: { id: 'usr-1', audience: 'DRIVER_APP' },
      });

      await assert.rejects(
        async () => guard.canActivate(ctx),
        (err: any) => {
          assert.ok(err instanceof AppError);
          assert.equal(err.statusCode, 403);
          assert.equal(err.code, 'AUTH_FORBIDDEN');
          assert.equal(err.details?.profile_status, 'SUSPENDED');
          return true;
        },
      );
    });
  });

  describe('AdminPermissionGuard (RBAC)', () => {
    it('grants access when admin holds all required permissions', async () => {
      const reflector = new Reflector();
      reflector.getAllAndOverride = () => ['admin:users:read'];

      const mockSessionService = {
        getAdminPermissions: async () => ({
          roles: ['OPERATOR'],
          permissions: ['admin:users:read', 'admin:orders:read'],
        }),
      } as any;

      const guard = new AdminPermissionGuard(reflector, mockSessionService);
      const ctx = createMockContext({
        user: { id: 'adm-1', audience: 'ADMIN_WEB' },
      });

      const allowed = await guard.canActivate(ctx);
      assert.equal(allowed, true);
    });

    it('denies access with 403 when admin lacks required permission', async () => {
      const reflector = new Reflector();
      reflector.getAllAndOverride = () => ['admin:finance:manage'];

      const mockSessionService = {
        getAdminPermissions: async () => ({
          roles: ['OPERATOR'],
          permissions: ['admin:users:read'],
        }),
      } as any;

      const guard = new AdminPermissionGuard(reflector, mockSessionService);
      const ctx = createMockContext({
        user: { id: 'adm-1', audience: 'ADMIN_WEB' },
      });

      await assert.rejects(
        async () => guard.canActivate(ctx),
        (err: any) => {
          assert.ok(err instanceof AppError);
          assert.equal(err.statusCode, 403);
          assert.equal(err.code, 'AUTH_FORBIDDEN');
          return true;
        },
      );
    });
  });

  describe('CsrfGuard (Browser Cookie Transport Protection)', () => {
    const guard = new CsrfGuard();

    it('bypasses CSRF verification for safe read-only methods (GET)', () => {
      const ctx = createMockContext({
        method: 'GET',
        cookies: { toranggo_admin_access: 'sess-1' },
      });
      assert.equal(guard.canActivate(ctx), true);
    });

    it('bypasses CSRF verification for non-cookie API requests (mobile bearer tokens)', () => {
      const ctx = createMockContext({
        method: 'POST',
        cookies: {},
        headers: { authorization: 'Bearer jwt.token.here' },
      });
      assert.equal(guard.canActivate(ctx), true);
    });

    it('validates CSRF token header against cookie for mutating browser requests', () => {
      const csrfVal = 'c1234567890abcdef1234567890abcdef';
      const ctx = createMockContext({
        method: 'POST',
        cookies: {
          toranggo_admin_access: 'session-cookie',
          toranggo_admin_csrf: csrfVal,
        },
        headers: {
          'x-csrf-token': csrfVal,
        },
      });
      assert.equal(guard.canActivate(ctx), true);
    });

    it('rejects mutating browser request with missing X-CSRF-Token header', () => {
      const ctx = createMockContext({
        method: 'POST',
        cookies: {
          toranggo_admin_access: 'session-cookie',
          toranggo_admin_csrf: 'c1234567890abcdef',
        },
        headers: {},
      });

      assert.throws(
        () => guard.canActivate(ctx),
        (err: any) => {
          assert.ok(err instanceof AppError);
          assert.equal(err.statusCode, 403);
          assert.equal(err.code, 'FORBIDDEN');
          return true;
        },
      );
    });

    it('rejects mutating browser request with mismatched CSRF token', () => {
      const ctx = createMockContext({
        method: 'POST',
        cookies: {
          toranggo_admin_access: 'session-cookie',
          toranggo_admin_csrf: 'c1234567890abcdef',
        },
        headers: {
          'x-csrf-token': 'wrong-token-value',
        },
      });

      assert.throws(
        () => guard.canActivate(ctx),
        (err: any) => {
          assert.ok(err instanceof AppError);
          assert.equal(err.statusCode, 403);
          assert.equal(err.code, 'FORBIDDEN');
          return true;
        },
      );
    });
  });
});
