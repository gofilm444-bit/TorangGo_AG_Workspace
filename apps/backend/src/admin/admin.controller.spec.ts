import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Reflector } from '@nestjs/core';
import { AdminController } from './admin.controller.js';
import { AdminService } from './admin.service.js';
import { AdminPermissionGuard, PERMISSION_KEY } from '../auth/guards/admin-permission.guard.js';
import { ADMIN_PERMISSIONS } from '../auth/admin/admin-permissions.js';
import { AppError } from '../common/errors/app-error.js';

describe('Admin Core Controller & Authorization Suite (Phase 2A1)', () => {
  function createMockExecutionContext(user?: { id?: string; audience?: string; claimedPermissions?: string[] }) {
    const req: any = { user };
    return {
      switchToHttp: () => ({
        getRequest: () => req,
        getResponse: () => ({}),
      }),
      getHandler: () => ({}),
      getClass: () => ({}),
    } as any;
  }

  // --- Requirement A: ADMIN_WEB + admin:access + admin:read -> 200 OK ---
  it('A. allows access to GET /overview when admin holds both admin:access and admin:read with ADMIN_WEB audience', async () => {
    const reflector = new Reflector();
    reflector.getAllAndOverride = () => [ADMIN_PERMISSIONS.ACCESS, ADMIN_PERMISSIONS.READ];

    const mockSessionService = {
      getAdminPermissions: async (adminId: string) => {
        assert.equal(adminId, 'adm-1');
        return {
          roles: ['SUPER_ADMIN'],
          permissions: [ADMIN_PERMISSIONS.ACCESS, ADMIN_PERMISSIONS.READ, ADMIN_PERMISSIONS.WRITE, ADMIN_PERMISSIONS.OPS],
        };
      },
    } as any;

    const guard = new AdminPermissionGuard(reflector, mockSessionService);
    const ctx = createMockExecutionContext({ id: 'adm-1', audience: 'ADMIN_WEB' });

    const canActivate = await guard.canActivate(ctx);
    assert.equal(canActivate, true);

    const mockAdminService = {
      getOverview: async () => ({
        users: { total: 10 },
        merchants: { total: 5, pending: 2, approved: 2, rejected: 1, suspended: 0 },
        drivers: { total: 8, pending: 3, approved: 4, rejected: 1, suspended: 0 },
      }),
    } as any;

    const controller = new AdminController(mockAdminService);
    const result = await controller.getOverview();
    assert.equal(result.users.total, 10);
    assert.equal(result.merchants.pending, 2);
    assert.equal(result.merchants.approved, 2);
    assert.equal(result.drivers.pending, 3);
    assert.equal(result.drivers.approved, 4);
  });

  // --- Requirement B: Missing admin:read -> 403 ---
  it('B. denies access with 403 AUTH_FORBIDDEN when authenticated admin lacks admin:read permission', async () => {
    const reflector = new Reflector();
    reflector.getAllAndOverride = () => [ADMIN_PERMISSIONS.ACCESS, ADMIN_PERMISSIONS.READ];

    const mockSessionService = {
      getAdminPermissions: async () => ({
        roles: ['LIMITED_ADMIN'],
        permissions: [ADMIN_PERMISSIONS.ACCESS], // missing admin:read
      }),
    } as any;

    const guard = new AdminPermissionGuard(reflector, mockSessionService);
    const ctx = createMockExecutionContext({ id: 'adm-limited', audience: 'ADMIN_WEB' });

    await assert.rejects(
      async () => guard.canActivate(ctx),
      (err: any) => {
        assert.ok(err instanceof AppError);
        assert.equal(err.statusCode, 403);
        assert.equal(err.code, 'AUTH_FORBIDDEN');
        assert.ok(err.message.includes('admin:read') || err.message.includes('Insufficient permissions'));
        assert.deepEqual(err.details?.required, [ADMIN_PERMISSIONS.ACCESS, ADMIN_PERMISSIONS.READ]);
        assert.deepEqual(err.details?.granted, [ADMIN_PERMISSIONS.ACCESS]);
        return true;
      },
    );
  });

  // --- Requirement C: Authenticated non-ADMIN_WEB audience -> rejected ---
  it('C. rejects requests from non-ADMIN_WEB audiences (e.g. CUSTOMER_APP, PARTNER_APP, DRIVER_APP)', async () => {
    const reflector = new Reflector();
    reflector.getAllAndOverride = () => [ADMIN_PERMISSIONS.ACCESS, ADMIN_PERMISSIONS.READ];

    const nonAdminAudiences = ['CUSTOMER_APP', 'PARTNER_APP', 'MERCHANT_APP', 'DRIVER_APP'];

    for (const aud of nonAdminAudiences) {
      const mockSessionService = {
        getAdminPermissions: async () => {
          assert.fail('SessionService must not be queried for non-ADMIN_WEB audience');
        },
      } as any;

      const guard = new AdminPermissionGuard(reflector, mockSessionService);
      const ctx = createMockExecutionContext({ id: 'user-1', audience: aud });

      await assert.rejects(
        async () => guard.canActivate(ctx),
        (err: any) => {
          assert.ok(err instanceof AppError);
          assert.equal(err.statusCode, 403);
          assert.equal(err.code, 'AUTH_FORBIDDEN');
          assert.equal(err.message, 'Admin access required');
          return true;
        },
      );
    }
  });

  // --- Requirement D: Unauthenticated request -> rejected ---
  it('D. rejects unauthenticated requests (missing user principal or id)', async () => {
    const reflector = new Reflector();
    reflector.getAllAndOverride = () => [ADMIN_PERMISSIONS.ACCESS, ADMIN_PERMISSIONS.READ];

    const mockSessionService = {
      getAdminPermissions: async () => {
        assert.fail('Must not query permissions when unauthenticated');
      },
    } as any;

    const guard = new AdminPermissionGuard(reflector, mockSessionService);

    // Completely unauthenticated (no user)
    const ctx1 = createMockExecutionContext(undefined);
    await assert.rejects(
      async () => guard.canActivate(ctx1),
      (err: any) => {
        assert.ok(err instanceof AppError);
        assert.equal(err.statusCode, 403);
        assert.equal(err.code, 'AUTH_FORBIDDEN');
        return true;
      },
    );

    // Missing adminId
    const ctx2 = createMockExecutionContext({ audience: 'ADMIN_WEB' });
    await assert.rejects(
      async () => guard.canActivate(ctx2),
      (err: any) => {
        assert.ok(err instanceof AppError);
        assert.equal(err.statusCode, 403);
        assert.equal(err.code, 'AUTH_FORBIDDEN');
        return true;
      },
    );
  });

  // --- Requirement E: Overview returns database-derived counts ---
  it('E. executes real aggregation queries and returns database-derived counts', async () => {
    const executedQueries: string[] = [];
    const mockPool = {
      query: async (sql: string) => {
        executedQueries.push(sql);
        if (sql.includes('FROM users')) {
          return { rows: [{ total: 100 }] };
        }
        if (sql.includes('FROM merchant_profiles')) {
          return { rows: [{ total: 20, pending: 5, approved: 12, rejected: 2, suspended: 1 }] };
        }
        if (sql.includes('FROM driver_profiles')) {
          return { rows: [{ total: 30, pending: 8, approved: 18, rejected: 3, suspended: 1 }] };
        }
        throw new Error(`Unexpected query: ${sql}`);
      },
    } as any;

    const service = new AdminService(mockPool);
    const overview = await service.getOverview();

    assert.equal(executedQueries.length, 3);
    assert.deepEqual(overview, {
      users: { total: 100 },
      merchants: { total: 20, pending: 5, approved: 12, rejected: 2, suspended: 1 },
      drivers: { total: 30, pending: 8, approved: 18, rejected: 3, suspended: 1 },
    });
  });

  // --- Requirement F: Overview performs NO database mutation ---
  it('F. guarantees overview queries are strictly read-only SELECT statements (no INSERT/UPDATE/DELETE)', async () => {
    const executedQueries: string[] = [];
    const mockPool = {
      query: async (sql: string) => {
        executedQueries.push(sql);
        return { rows: [{ total: 0, pending: 0, approved: 0, rejected: 0, suspended: 0 }] };
      },
    } as any;

    const service = new AdminService(mockPool);
    await service.getOverview();

    for (const sql of executedQueries) {
      const trimmedUpper = sql.trim().toUpperCase();
      assert.ok(trimmedUpper.startsWith('SELECT'), `Query must start with SELECT: ${sql}`);
      assert.ok(!trimmedUpper.includes('INSERT'), `Query must not contain INSERT: ${sql}`);
      assert.ok(!trimmedUpper.includes('UPDATE'), `Query must not contain UPDATE: ${sql}`);
      assert.ok(!trimmedUpper.includes('DELETE'), `Query must not contain DELETE: ${sql}`);
      assert.ok(!trimmedUpper.includes('DROP'), `Query must not contain DROP: ${sql}`);
      assert.ok(!trimmedUpper.includes('ALTER'), `Query must not contain ALTER: ${sql}`);
    }
  });

  // --- Requirement G: Permission resolution remains database-authoritative ---
  it('G. proves permissions are fetched dynamically from PostgreSQL and not cached on client', async () => {
    let dbQueryCount = 0;
    const reflector = new Reflector();
    reflector.getAllAndOverride = () => [ADMIN_PERMISSIONS.ACCESS, ADMIN_PERMISSIONS.READ];

    const mockSessionService = {
      getAdminPermissions: async (adminId: string) => {
        dbQueryCount++;
        // On first query, admin has permissions. On second query (simulating DB revocation), permissions removed.
        if (dbQueryCount === 1) {
          return {
            roles: ['SUPER_ADMIN'],
            permissions: [ADMIN_PERMISSIONS.ACCESS, ADMIN_PERMISSIONS.READ],
          };
        }
        return {
          roles: ['REVOKED'],
          permissions: [],
        };
      },
    } as any;

    const guard = new AdminPermissionGuard(reflector, mockSessionService);
    const ctx = createMockExecutionContext({ id: 'adm-dynamic', audience: 'ADMIN_WEB' });

    // Request 1: Granted
    const allowed1 = await guard.canActivate(ctx);
    assert.equal(allowed1, true);
    assert.equal(dbQueryCount, 1);

    // Request 2: Denied immediately when DB grants change
    await assert.rejects(
      async () => guard.canActivate(ctx),
      (err: any) => {
        assert.ok(err instanceof AppError);
        assert.equal(err.statusCode, 403);
        return true;
      },
    );
    assert.equal(dbQueryCount, 2, 'Must query DB again for each request');
  });

  // --- Requirement H: JWT/client claimed permissions cannot bypass DB grants ---
  it('H. proves client/JWT claimed permissions cannot bypass database grants', async () => {
    const reflector = new Reflector();
    reflector.getAllAndOverride = () => [ADMIN_PERMISSIONS.ACCESS, ADMIN_PERMISSIONS.READ];

    // Client/JWT claims it has all permissions
    const ctx = createMockExecutionContext({
      id: 'adm-malicious',
      audience: 'ADMIN_WEB',
      claimedPermissions: [ADMIN_PERMISSIONS.ACCESS, ADMIN_PERMISSIONS.READ, ADMIN_PERMISSIONS.WRITE, ADMIN_PERMISSIONS.OPS],
    });

    // But DB says admin has zero permissions
    const mockSessionService = {
      getAdminPermissions: async (adminId: string) => {
        assert.equal(adminId, 'adm-malicious');
        return {
          roles: ['GUEST'],
          permissions: [], // DB grants are authoritative!
        };
      },
    } as any;

    const guard = new AdminPermissionGuard(reflector, mockSessionService);

    await assert.rejects(
      async () => guard.canActivate(ctx),
      (err: any) => {
        assert.ok(err instanceof AppError);
        assert.equal(err.statusCode, 403);
        assert.equal(err.code, 'AUTH_FORBIDDEN');
        assert.deepEqual(err.details?.granted, []);
        return true;
      },
    );
  });
});
