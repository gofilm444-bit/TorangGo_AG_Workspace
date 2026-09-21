import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  timestamp,
  unique,
  index,
  primaryKey,
} from 'drizzle-orm/pg-core';

/**
 * Canonical Users table.
 * Unique canonical mobile identity in E.164 format.
 */
export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey(),
    phone: varchar('phone', { length: 32 }).notNull(),
    status: varchar('status', { length: 32 }).notNull().default('ACTIVE'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique('uq_users_phone').on(table.phone),
    index('idx_users_status').on(table.status),
  ],
);

export type UserEntity = typeof users.$inferSelect;
export type NewUserEntity = typeof users.$inferInsert;

/**
 * Customer Profiles table.
 */
export const customerProfiles = pgTable(
  'customer_profiles',
  {
    id: uuid('id').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 128 }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique('uq_customer_profiles_user_id').on(table.userId),
    index('idx_customer_profiles_user_id').on(table.userId),
  ],
);

export type CustomerProfileEntity = typeof customerProfiles.$inferSelect;
export type NewCustomerProfileEntity = typeof customerProfiles.$inferInsert;

/**
 * Merchant Profiles table.
 * Status: PENDING | APPROVED | REJECTED | SUSPENDED
 */
export const merchantProfiles = pgTable(
  'merchant_profiles',
  {
    id: uuid('id').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    businessName: varchar('business_name', { length: 255 }),
    status: varchar('status', { length: 32 }).notNull().default('PENDING'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique('uq_merchant_profiles_user_id').on(table.userId),
    index('idx_merchant_profiles_user_status').on(table.userId, table.status),
    index('idx_merchant_profiles_status_created').on(table.status, table.createdAt),
  ],
);

export type MerchantProfileEntity = typeof merchantProfiles.$inferSelect;
export type NewMerchantProfileEntity = typeof merchantProfiles.$inferInsert;

/**
 * Driver Profiles table.
 * Status: PENDING | APPROVED | REJECTED | SUSPENDED
 */
export const driverProfiles = pgTable(
  'driver_profiles',
  {
    id: uuid('id').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    fullName: varchar('full_name', { length: 255 }),
    status: varchar('status', { length: 32 }).notNull().default('PENDING'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique('uq_driver_profiles_user_id').on(table.userId),
    index('idx_driver_profiles_user_status').on(table.userId, table.status),
    index('idx_driver_profiles_status_created').on(table.status, table.createdAt),
  ],
);

export type DriverProfileEntity = typeof driverProfiles.$inferSelect;
export type NewDriverProfileEntity = typeof driverProfiles.$inferInsert;

/**
 * Profile Verification Audit Logs table.
 * Append-only audit trail for administrative status mutations.
 */
export const profileVerificationAuditLogs = pgTable(
  'profile_verification_audit_logs',
  {
    id: uuid('id').primaryKey(),
    profileType: varchar('profile_type', { length: 32 }).notNull(),
    profileId: uuid('profile_id').notNull(),
    actorAdminId: uuid('actor_admin_id')
      .notNull()
      .references(() => adminAccounts.id, { onDelete: 'restrict' }),
    action: varchar('action', { length: 32 }).notNull(),
    fromStatus: varchar('from_status', { length: 32 }).notNull(),
    toStatus: varchar('to_status', { length: 32 }).notNull(),
    reason: text('reason'),
    requestId: varchar('request_id', { length: 128 }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('idx_profile_verification_audit_target').on(
      table.profileType,
      table.profileId,
      table.createdAt,
    ),
    index('idx_profile_verification_audit_actor').on(table.actorAdminId),
  ],
);

export type ProfileVerificationAuditLogEntity = typeof profileVerificationAuditLogs.$inferSelect;
export type NewProfileVerificationAuditLogEntity = typeof profileVerificationAuditLogs.$inferInsert;

/**
 * Admin Accounts table.
 * Password stored as Argon2id. MFA TOTP secret stored encrypted at rest.
 */
export const adminAccounts = pgTable(
  'admin_accounts',
  {
    id: uuid('id').primaryKey(),
    username: varchar('username', { length: 64 }).notNull(),
    email: varchar('email', { length: 255 }).notNull(),
    passwordHash: varchar('password_hash', { length: 255 }).notNull(),
    status: varchar('status', { length: 32 }).notNull().default('ACTIVE'),
    mfaEnabled: boolean('mfa_enabled').notNull().default(true),
    totpSecretEncrypted: text('totp_secret_encrypted'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique('uq_admin_accounts_username').on(table.username),
    unique('uq_admin_accounts_email').on(table.email),
    index('idx_admin_accounts_status').on(table.status),
  ],
);

export type AdminAccountEntity = typeof adminAccounts.$inferSelect;
export type NewAdminAccountEntity = typeof adminAccounts.$inferInsert;

/**
 * Admin Roles table.
 */
export const adminRoles = pgTable(
  'admin_roles',
  {
    id: uuid('id').primaryKey(),
    name: varchar('name', { length: 64 }).notNull(),
    description: text('description'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow(),
  },
  (table) => [unique('uq_admin_roles_name').on(table.name)],
);

export type AdminRoleEntity = typeof adminRoles.$inferSelect;
export type NewAdminRoleEntity = typeof adminRoles.$inferInsert;

/**
 * Admin Permissions table.
 */
export const adminPermissions = pgTable(
  'admin_permissions',
  {
    id: uuid('id').primaryKey(),
    code: varchar('code', { length: 64 }).notNull(),
    description: text('description'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow(),
  },
  (table) => [unique('uq_admin_permissions_code').on(table.code)],
);

export type AdminPermissionEntity = typeof adminPermissions.$inferSelect;
export type NewAdminPermissionEntity = typeof adminPermissions.$inferInsert;

/**
 * Admin Account Roles (many-to-many junction).
 */
export const adminAccountRoles = pgTable(
  'admin_account_roles',
  {
    adminId: uuid('admin_id')
      .notNull()
      .references(() => adminAccounts.id, { onDelete: 'cascade' }),
    roleId: uuid('role_id')
      .notNull()
      .references(() => adminRoles.id, { onDelete: 'cascade' }),
  },
  (table) => [
    primaryKey({ columns: [table.adminId, table.roleId], name: 'pk_admin_account_roles' }),
    index('idx_admin_account_roles_admin_id').on(table.adminId),
  ],
);

export type AdminAccountRoleEntity = typeof adminAccountRoles.$inferSelect;

/**
 * Admin Role Permissions (many-to-many junction).
 */
export const adminRolePermissions = pgTable(
  'admin_role_permissions',
  {
    roleId: uuid('role_id')
      .notNull()
      .references(() => adminRoles.id, { onDelete: 'cascade' }),
    permissionId: uuid('permission_id')
      .notNull()
      .references(() => adminPermissions.id, { onDelete: 'cascade' }),
  },
  (table) => [
    primaryKey({ columns: [table.roleId, table.permissionId], name: 'pk_admin_role_permissions' }),
    index('idx_admin_role_permissions_role_id').on(table.roleId),
  ],
);

export type AdminRolePermissionEntity = typeof adminRolePermissions.$inferSelect;

/**
 * Admin Recovery Codes table (single-use hashed recovery codes).
 */
export const adminRecoveryCodes = pgTable(
  'admin_recovery_codes',
  {
    id: uuid('id').primaryKey(),
    adminId: uuid('admin_id')
      .notNull()
      .references(() => adminAccounts.id, { onDelete: 'cascade' }),
    codeHash: varchar('code_hash', { length: 64 }).notNull(),
    isUsed: boolean('is_used').notNull().default(false),
    usedAt: timestamp('used_at', { withTimezone: true, mode: 'date' }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique('uq_admin_recovery_codes_hash').on(table.codeHash),
    index('idx_admin_recovery_codes_admin').on(table.adminId, table.isUsed),
  ],
);

export type AdminRecoveryCodeEntity = typeof adminRecoveryCodes.$inferSelect;
export type NewAdminRecoveryCodeEntity = typeof adminRecoveryCodes.$inferInsert;

/**
 * Authentication Sessions table.
 * Audience-bound: CUSTOMER_APP | MERCHANT_APP | DRIVER_APP | ADMIN_WEB
 */
export const authSessions = pgTable(
  'auth_sessions',
  {
    id: uuid('id').primaryKey(),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
    adminId: uuid('admin_id').references(() => adminAccounts.id, { onDelete: 'cascade' }),
    audience: varchar('audience', { length: 32 }).notNull(),
    status: varchar('status', { length: 32 }).notNull().default('ACTIVE'),
    ipAddress: varchar('ip_address', { length: 64 }),
    userAgent: text('user_agent'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow(),
    expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'date' }).notNull(),
  },
  (table) => [
    index('idx_auth_sessions_user_aud').on(table.userId, table.audience, table.status),
    index('idx_auth_sessions_admin_aud').on(table.adminId, table.audience, table.status),
    index('idx_auth_sessions_expires_at').on(table.expiresAt),
  ],
);

export type AuthSessionEntity = typeof authSessions.$inferSelect;
export type NewAuthSessionEntity = typeof authSessions.$inferInsert;

/**
 * Refresh Tokens table.
 * Stored hashed with SHA-256. Supports rotation, family reuse tracking.
 */
export const refreshTokens = pgTable(
  'refresh_tokens',
  {
    id: uuid('id').primaryKey(),
    sessionId: uuid('session_id')
      .notNull()
      .references(() => authSessions.id, { onDelete: 'cascade' }),
    tokenHash: varchar('token_hash', { length: 64 }).notNull(),
    familyId: uuid('family_id').notNull(),
    isConsumed: boolean('is_consumed').notNull().default(false),
    consumedAt: timestamp('consumed_at', { withTimezone: true, mode: 'date' }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow(),
    expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'date' }).notNull(),
  },
  (table) => [
    unique('uq_refresh_tokens_hash').on(table.tokenHash),
    index('idx_refresh_tokens_session').on(table.sessionId),
    index('idx_refresh_tokens_family').on(table.familyId),
  ],
);

export type RefreshTokenEntity = typeof refreshTokens.$inferSelect;
export type NewRefreshTokenEntity = typeof refreshTokens.$inferInsert;
