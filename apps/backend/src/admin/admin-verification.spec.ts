import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import { Reflector } from '@nestjs/core';
import { generateUuidV7 } from '@platform/utils';
import {
  ADMIN_PERMISSIONS,
  PROFILE_VERIFICATION_STATUSES,
  PROFILE_VERIFICATION_ACTIONS,
} from '@platform/shared-types';
import { AdminVerificationController } from './admin-verification.controller.js';
import { AdminVerificationService } from './admin-verification.service.js';
import { TransactionService, type DrizzleDb } from '../database/transaction/transaction.service.js';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from '../database/schema/index.js';
import { AdminPermissionGuard } from '../auth/guards/admin-permission.guard.js';
import { AppError, ConflictError, NotFoundError, BadRequestError } from '../common/errors/app-error.js';
import { PostgresIdempotencyStore } from '../database/idempotency/postgres-idempotency.store.js';
import { calculateFingerprint } from '../common/idempotency/idempotency.interceptor.js';
import { LocalDocumentStorage } from '../storage/local-document-storage.js';

const { Pool } = pg;

describe('Phase 2A2: Admin Verification Workflow Comprehensive Suite', () => {
  let pool: pg.Pool;
  let db: DrizzleDb;
  let transactionService: TransactionService;
  let storage: LocalDocumentStorage;
  let service: AdminVerificationService;
  let controller: AdminVerificationController;
  let testAdminId: string;

  before(async () => {
    const connStr = process.env.DATABASE_URL;
    if (!connStr) {
      throw new Error(
        'DATABASE_URL is required for Phase 2A2 admin verification integration tests',
      );
    }
    pool = new Pool({ connectionString: connStr });
    db = drizzle(pool, { schema });
    transactionService = new TransactionService(db);
    storage = new LocalDocumentStorage();
    service = new AdminVerificationService(pool, transactionService, storage);
    controller = new AdminVerificationController(service);

    // Create a seed admin account for audit log foreign keys
    testAdminId = generateUuidV7();
    await pool.query(
      `INSERT INTO admin_accounts (id, username, email, password_hash, status, mfa_enabled, created_at, updated_at)
       VALUES ($1, 'audit_admin', 'audit_admin@toranggo.id', 'dummy_hash', 'ACTIVE', false, now(), now())
       ON CONFLICT (username) DO UPDATE SET updated_at = now()
       RETURNING id;`,
      [testAdminId],
    );
  });

  after(async () => {
    // Cleanup audit logs and seed admin
    try {
      await pool.query(`DELETE FROM profile_verification_audit_logs WHERE actor_admin_id = $1;`, [testAdminId]);
      await pool.query(`DELETE FROM admin_accounts WHERE id = $1;`, [testAdminId]);
    } catch {
      // Ignore cleanup errors on tear-down
    }
    await pool.end();
  });

  // Helper to create synthetic test users and profiles
  async function createTestMerchant(status = 'PENDING', phoneSuffix = '') {
    const userId = generateUuidV7();
    const profileId = generateUuidV7();
    const phone = `+62812${Math.floor(10000000 + Math.random() * 90000000)}${phoneSuffix}`;
    const businessName = `Toko Uji ${phoneSuffix || Math.random().toString(36).substring(2, 7)}`;

    await pool.query(
      `INSERT INTO users (id, phone, status, created_at, updated_at)
       VALUES ($1, $2, 'ACTIVE', now(), now());`,
      [userId, phone],
    );
    await pool.query(
      `INSERT INTO merchant_profiles (id, user_id, business_name, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, now(), now());`,
      [profileId, userId, businessName, status],
    );

    return { userId, profileId, phone, businessName };
  }

  async function createTestDriver(status = 'PENDING', phoneSuffix = '') {
    const userId = generateUuidV7();
    const profileId = generateUuidV7();
    const phone = `+62813${Math.floor(10000000 + Math.random() * 90000000)}${phoneSuffix}`;
    const fullName = `Driver Uji ${phoneSuffix || Math.random().toString(36).substring(2, 7)}`;

    await pool.query(
      `INSERT INTO users (id, phone, status, created_at, updated_at)
       VALUES ($1, $2, 'ACTIVE', now(), now());`,
      [userId, phone],
    );
    await pool.query(
      `INSERT INTO driver_profiles (id, user_id, full_name, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, now(), now());`,
      [profileId, userId, fullName, status],
    );

    return { userId, profileId, phone, fullName };
  }

  // ===========================================================================
  // 1. RBAC & Security Guard Unit Tests
  // ===========================================================================
  describe('RBAC & Permission Authorization Guards', () => {
    function createMockCtx(user?: { id?: string; audience?: string }) {
      return {
        switchToHttp: () => ({
          getRequest: () => ({ user }),
          getResponse: () => ({}),
        }),
        getHandler: () => ({}),
        getClass: () => ({}),
      } as any;
    }

    it('allows read when admin has admin:access + admin:read', async () => {
      const reflector = new Reflector();
      reflector.getAllAndOverride = () => [ADMIN_PERMISSIONS.ACCESS, ADMIN_PERMISSIONS.READ];
      const mockSessionSvc = {
        getAdminPermissions: async () => ({
          roles: ['VIEWER'],
          permissions: [ADMIN_PERMISSIONS.ACCESS, ADMIN_PERMISSIONS.READ],
        }),
      } as any;

      const guard = new AdminPermissionGuard(reflector, mockSessionSvc);
      const ctx = createMockCtx({ id: 'adm-1', audience: 'ADMIN_WEB' });
      assert.equal(await guard.canActivate(ctx), true);
    });

    it('denies read with 403 when admin lacks admin:read', async () => {
      const reflector = new Reflector();
      reflector.getAllAndOverride = () => [ADMIN_PERMISSIONS.ACCESS, ADMIN_PERMISSIONS.READ];
      const mockSessionSvc = {
        getAdminPermissions: async () => ({
          roles: ['GUEST'],
          permissions: [ADMIN_PERMISSIONS.ACCESS],
        }),
      } as any;

      const guard = new AdminPermissionGuard(reflector, mockSessionSvc);
      const ctx = createMockCtx({ id: 'adm-1', audience: 'ADMIN_WEB' });
      await assert.rejects(
        async () => guard.canActivate(ctx),
        (err: any) => err instanceof AppError && err.statusCode === 403,
      );
    });

    it('allows approve/reject when admin has admin:access + admin:write', async () => {
      const reflector = new Reflector();
      reflector.getAllAndOverride = () => [ADMIN_PERMISSIONS.ACCESS, ADMIN_PERMISSIONS.WRITE];
      const mockSessionSvc = {
        getAdminPermissions: async () => ({
          roles: ['VERIFIER'],
          permissions: [ADMIN_PERMISSIONS.ACCESS, ADMIN_PERMISSIONS.WRITE],
        }),
      } as any;

      const guard = new AdminPermissionGuard(reflector, mockSessionSvc);
      const ctx = createMockCtx({ id: 'adm-2', audience: 'ADMIN_WEB' });
      assert.equal(await guard.canActivate(ctx), true);
    });

    it('denies approve/reject with 403 when admin lacks admin:write', async () => {
      const reflector = new Reflector();
      reflector.getAllAndOverride = () => [ADMIN_PERMISSIONS.ACCESS, ADMIN_PERMISSIONS.WRITE];
      const mockSessionSvc = {
        getAdminPermissions: async () => ({
          roles: ['VIEWER'],
          permissions: [ADMIN_PERMISSIONS.ACCESS, ADMIN_PERMISSIONS.READ],
        }),
      } as any;

      const guard = new AdminPermissionGuard(reflector, mockSessionSvc);
      const ctx = createMockCtx({ id: 'adm-3', audience: 'ADMIN_WEB' });
      await assert.rejects(
        async () => guard.canActivate(ctx),
        (err: any) => err instanceof AppError && err.statusCode === 403,
      );
    });

    it('allows suspend/reactivate when admin has admin:access + admin:write + admin:ops', async () => {
      const reflector = new Reflector();
      reflector.getAllAndOverride = () => [
        ADMIN_PERMISSIONS.ACCESS,
        ADMIN_PERMISSIONS.WRITE,
        ADMIN_PERMISSIONS.OPS,
      ];
      const mockSessionSvc = {
        getAdminPermissions: async () => ({
          roles: ['SUPER_ADMIN'],
          permissions: [
            ADMIN_PERMISSIONS.ACCESS,
            ADMIN_PERMISSIONS.READ,
            ADMIN_PERMISSIONS.WRITE,
            ADMIN_PERMISSIONS.OPS,
          ],
        }),
      } as any;

      const guard = new AdminPermissionGuard(reflector, mockSessionSvc);
      const ctx = createMockCtx({ id: 'adm-4', audience: 'ADMIN_WEB' });
      assert.equal(await guard.canActivate(ctx), true);
    });

    it('denies suspend/reactivate with 403 when admin lacks admin:ops', async () => {
      const reflector = new Reflector();
      reflector.getAllAndOverride = () => [
        ADMIN_PERMISSIONS.ACCESS,
        ADMIN_PERMISSIONS.WRITE,
        ADMIN_PERMISSIONS.OPS,
      ];
      const mockSessionSvc = {
        getAdminPermissions: async () => ({
          roles: ['VERIFIER'],
          permissions: [ADMIN_PERMISSIONS.ACCESS, ADMIN_PERMISSIONS.WRITE], // missing ops
        }),
      } as any;

      const guard = new AdminPermissionGuard(reflector, mockSessionSvc);
      const ctx = createMockCtx({ id: 'adm-5', audience: 'ADMIN_WEB' });
      await assert.rejects(
        async () => guard.canActivate(ctx),
        (err: any) => err instanceof AppError && err.statusCode === 403,
      );
    });

    it('denies requests from non-ADMIN_WEB audiences with 403', async () => {
      const reflector = new Reflector();
      reflector.getAllAndOverride = () => [ADMIN_PERMISSIONS.ACCESS, ADMIN_PERMISSIONS.READ];
      const guard = new AdminPermissionGuard(reflector, {} as any);
      const ctx = createMockCtx({ id: 'user-1', audience: 'CUSTOMER_APP' });
      await assert.rejects(
        async () => guard.canActivate(ctx),
        (err: any) => err instanceof AppError && err.statusCode === 403,
      );
    });
  });

  // ===========================================================================
  // 2. Merchant & Driver Query / Filter / Search / Pagination Tests
  // ===========================================================================
  describe('Queue Queries, Filtering, Search, and Pagination', () => {
    it('lists merchants with filtering by status, search by phone/name, and pagination', async () => {
      const m1 = await createTestMerchant('PENDING', '991');
      const m2 = await createTestMerchant('APPROVED', '992');
      const m3 = await createTestMerchant('SUSPENDED', '993');

      // Filter by PENDING
      const pendingList = await service.listMerchants({ status: 'PENDING', page: 1, limit: 10 });
      assert.ok(pendingList.items.length >= 1);
      assert.ok(pendingList.items.every((i) => i.status === 'PENDING'));
      assert.ok(pendingList.items.some((i) => i.profileId === m1.profileId));

      // Search by business name query
      const searchRes = await service.listMerchants({ q: m1.businessName, page: 1, limit: 10 });
      assert.ok(searchRes.items.length >= 1);
      assert.equal(searchRes.items[0]?.profileId, m1.profileId);

      // Search by phone query
      const searchPhone = await service.listMerchants({ q: m2.phone, page: 1, limit: 10 });
      assert.ok(searchPhone.items.length >= 1);
      assert.equal(searchPhone.items[0]?.profileId, m2.profileId);

      // Detail retrieval
      const detail = await service.getMerchantDetail(m1.profileId);
      assert.equal(detail.profileId, m1.profileId);
      assert.equal(detail.userId, m1.userId);
      assert.equal(detail.phone, m1.phone);
      assert.equal(detail.status, 'PENDING');
      assert.ok(Array.isArray(detail.auditLogs));
    });

    it('lists drivers with filtering by status, search by phone/name, and pagination', async () => {
      const d1 = await createTestDriver('PENDING', '881');
      const d2 = await createTestDriver('APPROVED', '882');

      // Filter by APPROVED
      const approvedList = await service.listDrivers({ status: 'APPROVED', page: 1, limit: 10 });
      assert.ok(approvedList.items.length >= 1);
      assert.ok(approvedList.items.every((i) => i.status === 'APPROVED'));
      assert.ok(approvedList.items.some((i) => i.profileId === d2.profileId));

      // Search by full name
      const searchName = await service.listDrivers({ q: d1.fullName, page: 1, limit: 10 });
      assert.ok(searchName.items.length >= 1);
      assert.equal(searchName.items[0]?.profileId, d1.profileId);

      // Detail retrieval
      const detail = await service.getDriverDetail(d1.profileId);
      assert.equal(detail.profileId, d1.profileId);
      assert.equal(detail.userId, d1.userId);
      assert.equal(detail.phone, d1.phone);
      assert.equal(detail.status, 'PENDING');
      assert.ok(Array.isArray(detail.auditLogs));
    });

    it('returns 404 for non-existent merchant and driver profile IDs', async () => {
      const nonExistentId = generateUuidV7();

      await assert.rejects(
        async () => service.getMerchantDetail(nonExistentId),
        (err: any) => err instanceof NotFoundError && err.statusCode === 404,
      );

      await assert.rejects(
        async () => service.getDriverDetail(nonExistentId),
        (err: any) => err instanceof NotFoundError && err.statusCode === 404,
      );
    });
  });

  // ===========================================================================
  // 3. Status Transition Matrix & Action Reason Rules
  // ===========================================================================
  describe('Canonical Transition Matrix & Reason Enforcement', () => {
    it('executes full Merchant transition lifecycle: PENDING -> APPROVED -> SUSPENDED -> APPROVED', async () => {
      const m = await createTestMerchant('PENDING');

      // 1. APPROVE (PENDING -> APPROVED): reason optional
      const approved = await service.approveMerchant(m.profileId, testAdminId, 'Profil valid terverifikasi', 'req-001');
      assert.equal(approved.status, 'APPROVED');
      assert.equal(approved.auditLogs.length, 1);
      assert.equal(approved.auditLogs[0]?.action, 'APPROVE');
      assert.equal(approved.auditLogs[0]?.fromStatus, 'PENDING');
      assert.equal(approved.auditLogs[0]?.toStatus, 'APPROVED');
      assert.equal(approved.auditLogs[0]?.actorAdminId, testAdminId);
      assert.equal(approved.auditLogs[0]?.reason, 'Profil valid terverifikasi');
      assert.equal(approved.auditLogs[0]?.requestId, 'req-001');

      // 2. SUSPEND (APPROVED -> SUSPENDED): reason required
      const suspended = await service.suspendMerchant(m.profileId, testAdminId, 'Pelanggaran ketentuan operasional', 'req-002');
      assert.equal(suspended.status, 'SUSPENDED');
      assert.equal(suspended.auditLogs.length, 2);
      assert.equal(suspended.auditLogs[0]?.action, 'SUSPEND');
      assert.equal(suspended.auditLogs[0]?.fromStatus, 'APPROVED');
      assert.equal(suspended.auditLogs[0]?.toStatus, 'SUSPENDED');
      assert.equal(suspended.auditLogs[0]?.reason, 'Pelanggaran ketentuan operasional');

      // 3. REACTIVATE (SUSPENDED -> APPROVED): reason required
      const reactivated = await service.reactivateMerchant(m.profileId, testAdminId, 'Sanksi operasional telah selesai', 'req-003');
      assert.equal(reactivated.status, 'APPROVED');
      assert.equal(reactivated.auditLogs.length, 3);
      assert.equal(reactivated.auditLogs[0]?.action, 'REACTIVATE');
      assert.equal(reactivated.auditLogs[0]?.fromStatus, 'SUSPENDED');
      assert.equal(reactivated.auditLogs[0]?.toStatus, 'APPROVED');
    });

    it('executes Merchant PENDING -> REJECTED transition and verifies REJECTED is terminal for Admin', async () => {
      const m = await createTestMerchant('PENDING');

      // Reject requires reason >= 3 chars
      const rejected = await service.rejectMerchant(m.profileId, testAdminId, 'Nama usaha tidak memenuhi syarat', 'req-rej');
      assert.equal(rejected.status, 'REJECTED');
      assert.equal(rejected.auditLogs.length, 1);
      assert.equal(rejected.auditLogs[0]?.action, 'REJECT');

      // Rejected profile cannot be approved in 2A2 -> 409
      await assert.rejects(
        async () => service.approveMerchant(m.profileId, testAdminId, 'Coba approve rejected'),
        (err: any) => err instanceof ConflictError && err.statusCode === 409,
      );

      // Rejected profile cannot be suspended in 2A2 -> 409
      await assert.rejects(
        async () => service.suspendMerchant(m.profileId, testAdminId, 'Coba suspend rejected'),
        (err: any) => err instanceof ConflictError && err.statusCode === 409,
      );

      // Rejected profile cannot be reactivated in 2A2 -> 409
      await assert.rejects(
        async () => service.reactivateMerchant(m.profileId, testAdminId, 'Coba reactivate rejected'),
        (err: any) => err instanceof ConflictError && err.statusCode === 409,
      );

      // Same-status reject on rejected -> 409
      await assert.rejects(
        async () => service.rejectMerchant(m.profileId, testAdminId, 'Tolak lagi'),
        (err: any) => err instanceof ConflictError && err.statusCode === 409,
      );
    });

    it('executes Driver PENDING -> REJECTED transition and verifies REJECTED is terminal for Admin', async () => {
      const d = await createTestDriver('PENDING');

      const rejected = await service.rejectDriver(d.profileId, testAdminId, 'Data SIM tidak valid', 'req-driver-rej');
      assert.equal(rejected.status, 'REJECTED');
      assert.equal(rejected.auditLogs.length, 1);
      assert.equal(rejected.auditLogs[0]?.action, 'REJECT');

      // REJECTED -> APPROVED = 409
      await assert.rejects(
        async () => service.approveDriver(d.profileId, testAdminId),
        (err: any) => err instanceof ConflictError && err.statusCode === 409,
      );

      // REJECTED -> SUSPEND = 409
      await assert.rejects(
        async () => service.suspendDriver(d.profileId, testAdminId, 'Coba suspend driver rejected'),
        (err: any) => err instanceof ConflictError && err.statusCode === 409,
      );

      // REJECTED -> REACTIVATE = 409
      await assert.rejects(
        async () => service.reactivateDriver(d.profileId, testAdminId, 'Coba reactivate driver rejected'),
        (err: any) => err instanceof ConflictError && err.statusCode === 409,
      );

      // Same-status reject on rejected = 409
      await assert.rejects(
        async () => service.rejectDriver(d.profileId, testAdminId, 'Tolak lagi driver'),
        (err: any) => err instanceof ConflictError && err.statusCode === 409,
      );
    });

    it('executes full Driver transition lifecycle: PENDING -> APPROVED -> SUSPENDED -> APPROVED', async () => {
      const d = await createTestDriver('PENDING');

      // 1. APPROVE without note/reason
      const approved = await service.approveDriver(d.profileId, testAdminId);
      assert.equal(approved.status, 'APPROVED');
      assert.equal(approved.auditLogs.length, 1);
      assert.equal(approved.auditLogs[0]?.action, 'APPROVE');
      assert.equal(approved.auditLogs[0]?.reason, null);

      // 2. SUSPEND with reason
      const suspended = await service.suspendDriver(d.profileId, testAdminId, 'Akun driver dilaporkan bermasalah');
      assert.equal(suspended.status, 'SUSPENDED');
      assert.equal(suspended.auditLogs.length, 2);
      assert.equal(suspended.auditLogs[0]?.action, 'SUSPEND');

      // 3. REACTIVATE with reason
      const reactivated = await service.reactivateDriver(d.profileId, testAdminId, 'Klarifikasi laporan selesai dan valid');
      assert.equal(reactivated.status, 'APPROVED');
      assert.equal(reactivated.auditLogs.length, 3);
      assert.equal(reactivated.auditLogs[0]?.action, 'REACTIVATE');
    });

    it('validates action reason strictly (missing or < 3 chars returns 400)', async () => {
      const m = await createTestMerchant('PENDING');

      // Missing reason for REJECT
      await assert.rejects(
        async () => service.rejectMerchant(m.profileId, testAdminId, ''),
        (err: any) => err instanceof BadRequestError && err.statusCode === 400,
      );

      // Whitespace-only reason for REJECT
      await assert.rejects(
        async () => service.rejectMerchant(m.profileId, testAdminId, '   '),
        (err: any) => err instanceof BadRequestError && err.statusCode === 400,
      );

      // Too short reason (< 3 chars)
      await assert.rejects(
        async () => service.rejectMerchant(m.profileId, testAdminId, 'ab'),
        (err: any) => err instanceof BadRequestError && err.statusCode === 400,
      );

      // Approve with reason > 1000 chars fails
      const overlyLongReason = 'a'.repeat(1001);
      await assert.rejects(
        async () => service.approveMerchant(m.profileId, testAdminId, overlyLongReason),
        (err: any) => err instanceof BadRequestError && err.statusCode === 400,
      );
    });

    it('rejects all forbidden transitions with 409 Conflict for both Merchant and Driver', async () => {
      const pendingM = await createTestMerchant('PENDING');
      const approvedM = await createTestMerchant('APPROVED');
      const suspendedM = await createTestMerchant('SUSPENDED');

      // PENDING -> SUSPEND is forbidden (409)
      await assert.rejects(
        async () => service.suspendMerchant(pendingM.profileId, testAdminId, 'Alasan suspend'),
        (err: any) => err instanceof ConflictError && err.statusCode === 409,
      );

      // PENDING -> REACTIVATE is forbidden
      // PENDING -> REACTIVATE is forbidden (409)
      await assert.rejects(
        async () => service.reactivateMerchant(pendingM.profileId, testAdminId, 'Alasan reactivate'),
        (err: any) => err instanceof ConflictError && err.statusCode === 409,
      );

      // APPROVED -> APPROVE is forbidden
      // APPROVED -> APPROVE is forbidden (same-status 409)
      await assert.rejects(
        async () => service.approveMerchant(approvedM.profileId, testAdminId),
        (err: any) => err instanceof ConflictError && err.statusCode === 409,
      );

      // APPROVED -> REJECT is forbidden
      // APPROVED -> REJECT is forbidden (409)
      await assert.rejects(
        async () => service.rejectMerchant(approvedM.profileId, testAdminId, 'Alasan reject'),
        (err: any) => err instanceof ConflictError && err.statusCode === 409,
      );

      // APPROVED -> REACTIVATE is forbidden
      // APPROVED -> REACTIVATE is forbidden (409)
      await assert.rejects(
        async () => service.reactivateMerchant(approvedM.profileId, testAdminId, 'Alasan reactivate'),
        (err: any) => err instanceof ConflictError && err.statusCode === 409,
      );

      // SUSPENDED -> REJECT is forbidden
      // SUSPENDED -> APPROVE is forbidden (must use REACTIVATE) (409)
      await assert.rejects(
        async () => service.approveMerchant(suspendedM.profileId, testAdminId),
        (err: any) => err instanceof ConflictError && err.statusCode === 409,
      );

      // SUSPENDED -> SUSPEND is forbidden (same-status 409)
      await assert.rejects(
        async () => service.suspendMerchant(suspendedM.profileId, testAdminId, 'Alasan suspend lagi'),
        (err: any) => err instanceof ConflictError && err.statusCode === 409,
      );

      // SUSPENDED -> REJECT is forbidden (409)
      await assert.rejects(
        async () => service.rejectMerchant(suspendedM.profileId, testAdminId, 'Alasan reject'),
        (err: any) => err instanceof ConflictError && err.statusCode === 409,
      );

      // Driver forbidden transitions
      const pendingD = await createTestDriver('PENDING');
      const approvedD = await createTestDriver('APPROVED');
      const suspendedD = await createTestDriver('SUSPENDED');

      // PENDING -> SUSPEND is forbidden (409)
      await assert.rejects(
        async () => service.suspendDriver(pendingD.profileId, testAdminId, 'Alasan suspend driver'),
        (err: any) => err instanceof ConflictError && err.statusCode === 409,
      );

      // PENDING -> REACTIVATE is forbidden (409)
      await assert.rejects(
        async () => service.reactivateDriver(pendingD.profileId, testAdminId, 'Alasan reactivate driver'),
        (err: any) => err instanceof ConflictError && err.statusCode === 409,
      );

      // APPROVED -> APPROVE is forbidden (same-status 409)
      await assert.rejects(
        async () => service.approveDriver(approvedD.profileId, testAdminId),
        (err: any) => err instanceof ConflictError && err.statusCode === 409,
      );

      // APPROVED -> REJECT is forbidden (409)
      await assert.rejects(
        async () => service.rejectDriver(approvedD.profileId, testAdminId, 'Alasan reject driver'),
        (err: any) => err instanceof ConflictError && err.statusCode === 409,
      );

      // APPROVED -> REACTIVATE is forbidden (409)
      await assert.rejects(
        async () => service.reactivateDriver(approvedD.profileId, testAdminId, 'Alasan reactivate driver'),
        (err: any) => err instanceof ConflictError && err.statusCode === 409,
      );

      // SUSPENDED -> APPROVE is forbidden (must use REACTIVATE) (409)
      await assert.rejects(
        async () => service.approveDriver(suspendedD.profileId, testAdminId),
        (err: any) => err instanceof ConflictError && err.statusCode === 409,
      );

      // SUSPENDED -> SUSPEND is forbidden (same-status 409)
      await assert.rejects(
        async () => service.suspendDriver(suspendedD.profileId, testAdminId, 'Alasan suspend driver lagi'),
        (err: any) => err instanceof ConflictError && err.statusCode === 409,
      );

      // SUSPENDED -> REJECT is forbidden (409)
      await assert.rejects(
        async () => service.rejectDriver(suspendedD.profileId, testAdminId, 'Alasan reject driver'),
        (err: any) => err instanceof ConflictError && err.statusCode === 409,
      );
    });

    it('persists canonical audit table fields: profile_type, profile_id, actor_admin_id, action, from_status, to_status, reason, request_id', async () => {
      const m = await createTestMerchant('PENDING');
      await service.approveMerchant(m.profileId, testAdminId, 'Verifikasi identitas merchant lengkap', 'req-audit-test');

      const res = await pool.query(
        `SELECT id, profile_type, profile_id, actor_admin_id, action, from_status, to_status, reason, request_id, created_at
         FROM profile_verification_audit_logs
         WHERE profile_id = $1;`,
        [m.profileId],
      );

      assert.equal(res.rows.length, 1);
      const row = res.rows[0];
      assert.equal(row.profile_type, 'MERCHANT');
      assert.equal(row.profile_id, m.profileId);
      assert.equal(row.actor_admin_id, testAdminId);
      assert.equal(row.action, 'APPROVE');
      assert.equal(row.from_status, 'PENDING');
      assert.equal(row.to_status, 'APPROVED');
      assert.equal(row.reason, 'Verifikasi identitas merchant lengkap');
      assert.equal(row.request_id, 'req-audit-test');
      assert.ok(row.created_at instanceof Date);
    });

  });

  // ===========================================================================
  // 4. Concurrency & Atomicity Tests
  // ===========================================================================
  describe('Concurrency & Atomicity Protections', () => {
    it('protects concurrent conflicting actions: only one succeeds, the other gets 409', async () => {
      const m = await createTestMerchant('PENDING');

      // Dispatch two conflicting transitions concurrently (APPROVE and REJECT against the same profile)
      const results = await Promise.allSettled([
        service.approveMerchant(m.profileId, testAdminId, 'Setuju dari operator A'),
        service.rejectMerchant(m.profileId, testAdminId, 'Tolak dari operator B'),
      ]);

      const fulfilled = results.filter((r) => r.status === 'fulfilled');
      const rejected = results.filter((r) => r.status === 'rejected');

      // Exactly one must succeed, and one must fail with 409 Conflict
      assert.equal(fulfilled.length, 1);
      assert.equal(rejected.length, 1);

      const err = (rejected[0] as PromiseRejectedResult).reason;
      assert.ok(err instanceof ConflictError);
      assert.equal(err.statusCode, 409);

      // Audit logs in DB must contain exactly 1 event
      const finalDetail = await service.getMerchantDetail(m.profileId);
      assert.equal(finalDetail.auditLogs.length, 1);
    });

    it('rolls back profile status update if audit log insertion fails (atomicity)', async () => {
      const m = await createTestMerchant('PENDING');
      const nonExistentAdminId = generateUuidV7(); // Will trigger FK violation on profile_verification_audit_logs

      await assert.rejects(
        async () => service.approveMerchant(m.profileId, nonExistentAdminId),
        (err: any) => {
          const msg = `${err.message} ${(err.cause as any)?.message ?? ''}`;
          return msg.includes('violates') || msg.includes('foreign key') || msg.includes('Failed query');
        },
      );

      // Verify that merchant profile status was NOT committed as APPROVED
      const profile = await service.getMerchantDetail(m.profileId);
      assert.equal(profile.status, 'PENDING');
      assert.equal(profile.auditLogs.length, 0);
    });
  });

  // ===========================================================================
  // 5. Idempotency Replay & Conflict Safety
  // ===========================================================================
  describe('PostgreSQL Idempotency Store & Mutation Protection', () => {
    it('replays identical mutation response with same Idempotency-Key without duplicating audit log', async () => {
      const idemStore = new PostgresIdempotencyStore(pool, db);
      const m = await createTestMerchant('PENDING');
      const idempotencyKey = generateUuidV7();
      const path = `/api/v1/admin/verifications/merchants/${m.profileId}/approve`;
      const body = { reason: 'Persetujuan berulang via idempotensi' };
      const fingerprint = calculateFingerprint('POST', path, body);

      // 1. First execution: claim key
      const claim1 = await idemStore.claim(idempotencyKey, fingerprint, path);
      assert.equal(claim1.status, 'claimed');

      // Execute action
      const result = await service.approveMerchant(m.profileId, testAdminId, body.reason);
      await idemStore.set(idempotencyKey, {
        statusCode: 200,
        responseBody: result,
        fingerprint,
        createdAt: Date.now(),
      }, path);

      // 2. Second execution with identical fingerprint
      const claim2 = await idemStore.claim(idempotencyKey, fingerprint, path);
      assert.equal(claim2.status, 'replayed');
      assert.ok(claim2.record);
      assert.equal(claim2.record.statusCode, 200);
      assert.equal((claim2.record.responseBody as any).status, 'APPROVED');

      // Ensure no duplicate audit log was inserted
      const detail = await service.getMerchantDetail(m.profileId);
      assert.equal(detail.auditLogs.length, 1);

      // 3. Execution with same key but DIFFERENT body/fingerprint -> conflict
      const conflictingFingerprint = calculateFingerprint('POST', path, { reason: 'Body berbeda' });
      const claimConflict = await idemStore.claim(idempotencyKey, conflictingFingerprint, path);
      assert.equal(claimConflict.status, 'conflict');
    });
  });
});
