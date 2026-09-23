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
  integer,
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
    currentSubmissionId: uuid('current_submission_id').references(
      (): any => merchantOnboardingSubmissions.id,
      { onDelete: 'set null' },
    ),
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
    index('idx_merchant_profiles_current_submission').on(table.currentSubmissionId),
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
    submissionId: uuid('submission_id').references(
      (): any => merchantOnboardingSubmissions.id,
      { onDelete: 'set null' },
    ),
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
    index('idx_profile_verification_audit_submission').on(table.submissionId),
  ],
);

export type ProfileVerificationAuditLogEntity = typeof profileVerificationAuditLogs.$inferSelect;
export type NewProfileVerificationAuditLogEntity = typeof profileVerificationAuditLogs.$inferInsert;

/**
 * Merchant Onboarding Documents table.
 * Private metadata for uploaded identity documents (KTP).
 * Physical blobs live outside PostgreSQL in private storage abstraction.
 */
export const merchantOnboardingDocuments = pgTable(
  'merchant_onboarding_documents',
  {
    id: uuid('id').primaryKey(),
    ownerUserId: uuid('owner_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    documentType: varchar('document_type', { length: 32 }).notNull().default('KTP_FRONT'),
    storageKey: varchar('storage_key', { length: 512 }).notNull(),
    sanitizedOriginalFilename: varchar('sanitized_original_filename', { length: 255 }).notNull(),
    mimeType: varchar('mime_type', { length: 64 }).notNull(),
    sizeBytes: integer('size_bytes').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('idx_merchant_onboarding_docs_owner').on(table.ownerUserId),
    unique('uq_merchant_onboarding_docs_key').on(table.storageKey),
  ],
);

export type MerchantOnboardingDocumentEntity = typeof merchantOnboardingDocuments.$inferSelect;
export type NewMerchantOnboardingDocumentEntity = typeof merchantOnboardingDocuments.$inferInsert;

/**
 * Merchant Onboarding Drafts table.
 * Exactly one mutable draft per user.
 */
export const merchantOnboardingDrafts = pgTable(
  'merchant_onboarding_drafts',
  {
    id: uuid('id').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    fullName: varchar('full_name', { length: 255 }),
    nik: varchar('nik', { length: 32 }),
    email: varchar('email', { length: 255 }),
    alternateContact: varchar('alternate_contact', { length: 64 }),
    proposedBusinessName: varchar('proposed_business_name', { length: 255 }),
    businessCategory: varchar('business_category', { length: 64 }),
    businessDescription: text('business_description'),
    province: varchar('province', { length: 128 }),
    regencyOrCity: varchar('regency_or_city', { length: 128 }),
    district: varchar('district', { length: 128 }),
    villageOrSubdistrict: varchar('village_or_subdistrict', { length: 128 }),
    addressDetail: text('address_detail'),
    ktpDocumentId: uuid('ktp_document_id').references(
      () => merchantOnboardingDocuments.id,
      { onDelete: 'set null' },
    ),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique('uq_merchant_onboarding_drafts_user_id').on(table.userId),
    index('idx_merchant_onboarding_drafts_user_id').on(table.userId),
  ],
);

export type MerchantOnboardingDraftEntity = typeof merchantOnboardingDrafts.$inferSelect;
export type NewMerchantOnboardingDraftEntity = typeof merchantOnboardingDrafts.$inferInsert;

/**
 * Merchant Onboarding Submissions table.
 * Immutable snapshot created upon submission.
 * Status: PENDING | APPROVED | REJECTED
 */
export const merchantOnboardingSubmissions = pgTable(
  'merchant_onboarding_submissions',
  {
    id: uuid('id').primaryKey(),
    merchantProfileId: uuid('merchant_profile_id')
      .notNull()
      .references(() => merchantProfiles.id, { onDelete: 'cascade' }),
    submittedByUserId: uuid('submitted_by_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    revisionNumber: integer('revision_number').notNull(),
    supersedesSubmissionId: uuid('supersedes_submission_id').references(
      (): any => merchantOnboardingSubmissions.id,
      { onDelete: 'set null' },
    ),
    status: varchar('status', { length: 32 }).notNull().default('PENDING'),
    fullName: varchar('full_name', { length: 255 }).notNull(),
    nik: varchar('nik', { length: 32 }).notNull(),
    accountPhoneSnapshot: varchar('account_phone_snapshot', { length: 32 }).notNull(),
    email: varchar('email', { length: 255 }),
    alternateContact: varchar('alternate_contact', { length: 64 }),
    proposedBusinessName: varchar('proposed_business_name', { length: 255 }).notNull(),
    businessCategory: varchar('business_category', { length: 64 }).notNull(),
    businessDescription: text('business_description'),
    province: varchar('province', { length: 128 }).notNull(),
    regencyOrCity: varchar('regency_or_city', { length: 128 }).notNull(),
    district: varchar('district', { length: 128 }).notNull(),
    villageOrSubdistrict: varchar('village_or_subdistrict', { length: 128 }).notNull(),
    addressDetail: text('address_detail').notNull(),
    ktpDocumentId: uuid('ktp_document_id')
      .notNull()
      .references(() => merchantOnboardingDocuments.id, { onDelete: 'restrict' }),
    dataAccuracyAcceptedAt: timestamp('data_accuracy_accepted_at', { withTimezone: true, mode: 'date' }).notNull(),
    merchantTermsAcceptedAt: timestamp('merchant_terms_accepted_at', { withTimezone: true, mode: 'date' }).notNull(),
    merchantTermsVersion: varchar('merchant_terms_version', { length: 32 }).notNull(),
    privacyConsentAcceptedAt: timestamp('privacy_consent_accepted_at', { withTimezone: true, mode: 'date' }).notNull(),
    privacyNoticeVersion: varchar('privacy_notice_version', { length: 32 }).notNull(),
    submittedAt: timestamp('submitted_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique('uq_merchant_submissions_profile_revision').on(table.merchantProfileId, table.revisionNumber),
    index('idx_merchant_submissions_profile_id').on(table.merchantProfileId),
    index('idx_merchant_submissions_user_id').on(table.submittedByUserId),
    index('idx_merchant_submissions_status').on(table.status),
  ],
);

export type MerchantOnboardingSubmissionEntity = typeof merchantOnboardingSubmissions.$inferSelect;
export type NewMerchantOnboardingSubmissionEntity = typeof merchantOnboardingSubmissions.$inferInsert;

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
