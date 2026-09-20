import { Injectable, Inject } from '@nestjs/common';
import { eq, and } from 'drizzle-orm';
import type pg from 'pg';
import { PG_POOL_TOKEN, DRIZZLE_DB_TOKEN } from '../../database/database.tokens.js';
import type { DrizzleDb } from '../../database/transaction/transaction.service.js';
import {
  users,
  customerProfiles,
  merchantProfiles,
  driverProfiles,
  authSessions,
  adminAccounts,
  adminAccountRoles,
  adminRolePermissions,
  adminRoles,
  adminPermissions,
  type UserEntity,
  type CustomerProfileEntity,
  type MerchantProfileEntity,
  type DriverProfileEntity,
} from '../../database/schema/identity.js';
import { AppError } from '../../common/errors/app-error.js';
import { generateUuidV7 } from '@platform/utils';
import type { AppAudience } from '@platform/shared-types';

export interface ResolvedUserIdentity {
  user: UserEntity;
  customerProfile: CustomerProfileEntity | null;
  merchantProfile: MerchantProfileEntity | null;
  driverProfile: DriverProfileEntity | null;
}

export interface AdminPermissionsSummary {
  admin: {
    id: string;
    username: string;
    email: string;
    status: string;
  };
  roles: string[];
  permissions: string[];
}

@Injectable()
export class SessionService {
  constructor(
    @Inject(PG_POOL_TOKEN)
    private readonly pool: pg.Pool,
    @Inject(DRIZZLE_DB_TOKEN)
    private readonly db: DrizzleDb,
  ) {}

  /**
   * Resolves or creates a canonical User by E.164 phone.
   * Ensures same phone number across Customer, Merchant, and Driver resolves to the same User.
   */
  async resolveOrCreateCanonicalUser(phone: string, audience: AppAudience): Promise<ResolvedUserIdentity> {
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');

      // 1. Transactional check or insert with ON CONFLICT for concurrent safety
      const userId = generateUuidV7();
      const now = new Date();

      const insertRes = await client.query(
        `INSERT INTO users (id, phone, status, created_at, updated_at)
         VALUES ($1, $2, 'ACTIVE', $3, $3)
         ON CONFLICT (phone) DO UPDATE
         SET updated_at = EXCLUDED.updated_at
         RETURNING id, phone, status, created_at, updated_at;`,
        [userId, phone, now],
      );

      const userRow = insertRes.rows[0];
      const resolvedUserId = userRow.id;

      if (userRow.status !== 'ACTIVE') {
        await client.query('ROLLBACK');
        throw new AppError(403, 'AUTH_FORBIDDEN', 'User account is suspended');
      }

      // 2. Customer profile auto-creation on CUSTOMER_APP login is permitted by locked identity rule.
      // PARTNER_APP, MERCHANT_APP, and DRIVER_APP must NOT automatically create merchant_profiles,
      // service_provider_profiles, or driver_profiles rows.
      // Profile creation belongs exclusively to Phase 2 onboarding.
      if (audience === 'CUSTOMER_APP') {
        const profileId = generateUuidV7();
        await client.query(
          `INSERT INTO customer_profiles (id, user_id, name, created_at, updated_at)
           VALUES ($1, $2, NULL, $3, $3)
           ON CONFLICT (user_id) DO NOTHING;`,
          [profileId, resolvedUserId, now],
        );
      }

      await client.query('COMMIT');

      // 3. Fetch all profiles for the canonical user
      return this.getUserIdentity(resolvedUserId);
    } catch (err) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackErr) {
        void rollbackErr;
      }
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Fetches full identity state: canonical user + all 3 profiles.
   */
  async getUserIdentity(userId: string): Promise<ResolvedUserIdentity> {
    const userRows = await this.db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!userRows[0]) {
      throw new AppError(404, 'NOT_FOUND', 'User not found');
    }

    const [customerRows, merchantRows, driverRows] = await Promise.all([
      this.db.select().from(customerProfiles).where(eq(customerProfiles.userId, userId)).limit(1),
      this.db.select().from(merchantProfiles).where(eq(merchantProfiles.userId, userId)).limit(1),
      this.db.select().from(driverProfiles).where(eq(driverProfiles.userId, userId)).limit(1),
    ]);

    return {
      user: userRows[0],
      customerProfile: customerRows[0] ?? null,
      merchantProfile: merchantRows[0] ?? null,
      driverProfile: driverRows[0] ?? null,
    };
  }

  /**
   * Create an audience-bound auth session in PostgreSQL.
   */
  async createSession(params: {
    userId?: string;
    adminId?: string;
    audience: AppAudience;
    ipAddress?: string;
    userAgent?: string;
    ttlSeconds: number;
  }): Promise<{ sessionId: string; expiresAt: Date }> {
    const sessionId = generateUuidV7();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + params.ttlSeconds * 1000);

    await this.db.insert(authSessions).values({
      id: sessionId,
      userId: params.userId ?? null,
      adminId: params.adminId ?? null,
      audience: params.audience,
      status: 'ACTIVE',
      ipAddress: params.ipAddress ?? null,
      userAgent: params.userAgent ?? null,
      createdAt: now,
      updatedAt: now,
      expiresAt,
    });

    return { sessionId, expiresAt };
  }

  /**
   * Get active session by ID.
   */
  async getActiveSession(sessionId: string) {
    const rows = await this.db
      .select()
      .from(authSessions)
      .where(and(eq(authSessions.id, sessionId), eq(authSessions.status, 'ACTIVE')))
      .limit(1);

    const session = rows[0];
    if (!session || session.expiresAt.getTime() <= Date.now()) {
      return null;
    }
    return session;
  }

  /**
   * Fetch admin RBAC permissions and roles.
   */
  async getAdminPermissions(adminId: string): Promise<AdminPermissionsSummary> {
    const adminRows = await this.db
      .select({
        id: adminAccounts.id,
        username: adminAccounts.username,
        email: adminAccounts.email,
        status: adminAccounts.status,
      })
      .from(adminAccounts)
      .where(eq(adminAccounts.id, adminId))
      .limit(1);

    const admin = adminRows[0];
    if (!admin) {
      throw new AppError(404, 'NOT_FOUND', 'Admin account not found');
    }

    // Query roles
    const roleRows = await this.db
      .select({
        roleName: adminRoles.name,
      })
      .from(adminAccountRoles)
      .innerJoin(adminRoles, eq(adminAccountRoles.roleId, adminRoles.id))
      .where(eq(adminAccountRoles.adminId, adminId));

    const roles = roleRows.map((r) => r.roleName);

    // Query permissions via roles
    const permissionRows = await this.db
      .select({
        permissionCode: adminPermissions.code,
      })
      .from(adminAccountRoles)
      .innerJoin(
        adminRolePermissions,
        eq(adminAccountRoles.roleId, adminRolePermissions.roleId),
      )
      .innerJoin(
        adminPermissions,
        eq(adminRolePermissions.permissionId, adminPermissions.id),
      )
      .where(eq(adminAccountRoles.adminId, adminId));

    const permissions = Array.from(new Set(permissionRows.map((p) => p.permissionCode)));

    return {
      admin,
      roles,
      permissions,
    };
  }
}
