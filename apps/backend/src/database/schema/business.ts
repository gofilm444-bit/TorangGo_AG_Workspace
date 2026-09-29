import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  timestamp,
  unique,
  uniqueIndex,
  index,
  integer,
  jsonb,
  time,
  check,
  customType,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { merchantProfiles, merchantOnboardingSubmissions } from './identity.js';

/**
 * Custom PostGIS geography(Point, 4326) column type.
 * Persists WGS84 coordinates as PostGIS spatial Point (lon, lat).
 */
export const geographyPoint = customType<{
  data: { latitude: number; longitude: number };
  driverData: string;
}>({
  dataType() {
    return 'geography(Point,4326)';
  },
  toDriver(value: { latitude: number; longitude: number }): string {
    return `POINT(${value.longitude} ${value.latitude})`;
  },
  fromDriver(value: string): { latitude: number; longitude: number } {
    return { latitude: 0, longitude: 0 };
  },
});

/**
 * Merchant Business Setup Drafts table.
 * Mutable draft holding setup wizard state before atomic operational entity creation.
 * Exactly one ACTIVE draft per Merchant Profile (enforced by partial unique index).
 */
export const merchantBusinessSetupDrafts = pgTable(
  'merchant_business_setup_drafts',
  {
    id: uuid('id').primaryKey(),
    merchantProfileId: uuid('merchant_profile_id')
      .notNull()
      .references(() => merchantProfiles.id, { onDelete: 'cascade' }),
    sourceOnboardingSubmissionId: uuid('source_onboarding_submission_id').references(
      (): any => merchantOnboardingSubmissions.id,
      { onDelete: 'set null' },
    ),
    businessSetupPayload: jsonb('business_setup_payload'),
    outletSetupPayload: jsonb('outlet_setup_payload'),
    operatingHoursPayload: jsonb('operating_hours_payload'),
    currentStep: integer('current_step').notNull().default(1),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow(),
    completedAt: timestamp('completed_at', { withTimezone: true, mode: 'date' }),
  },
  (table) => [
    index('idx_merchant_business_setup_drafts_profile').on(table.merchantProfileId),
    index('idx_merchant_business_setup_drafts_submission').on(table.sourceOnboardingSubmissionId),
    uniqueIndex('uq_merchant_business_setup_drafts_active')
      .on(table.merchantProfileId)
      .where(sql`${table.completedAt} IS NULL`),
  ],
);

export type MerchantBusinessSetupDraftEntity = typeof merchantBusinessSetupDrafts.$inferSelect;
export type NewMerchantBusinessSetupDraftEntity = typeof merchantBusinessSetupDrafts.$inferInsert;

/**
 * Businesses table.
 * Operational commercial enterprise entity. Created upon setup completion.
 * MVP: 1 Merchant Profile -> 1 Business.
 */
export const businesses = pgTable(
  'businesses',
  {
    id: uuid('id').primaryKey(),
    merchantProfileId: uuid('merchant_profile_id')
      .notNull()
      .references(() => merchantProfiles.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 255 }).notNull(),
    categoryCode: varchar('category_code', { length: 64 }).notNull(),
    description: text('description'),
    sourceOnboardingSubmissionId: uuid('source_onboarding_submission_id').references(
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
    unique('uq_businesses_merchant_profile_id').on(table.merchantProfileId),
    index('idx_businesses_merchant_profile_id').on(table.merchantProfileId),
    index('idx_businesses_source_submission').on(table.sourceOnboardingSubmissionId),
  ],
);

export type BusinessEntity = typeof businesses.$inferSelect;
export type NewBusinessEntity = typeof businesses.$inferInsert;

/**
 * Outlets table.
 * Operational fulfillment location entity.
 * Ownership: Outlet -> Business -> Merchant Profile.
 * Business -> Outlet schema is 1:N capable (no UNIQUE(business_id)).
 * Primary Outlet uniqueness per business is enforced via partial unique index.
 */
export const outlets = pgTable(
  'outlets',
  {
    id: uuid('id').primaryKey(),
    businessId: uuid('business_id')
      .notNull()
      .references(() => businesses.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 255 }).notNull(),
    contactPhone: varchar('contact_phone', { length: 32 }).notNull(),
    province: varchar('province', { length: 128 }).notNull(),
    regencyOrCity: varchar('regency_or_city', { length: 128 }).notNull(),
    district: varchar('district', { length: 128 }).notNull(),
    villageOrSubdistrict: varchar('village_or_subdistrict', { length: 128 }).notNull(),
    addressDetail: text('address_detail').notNull(),
    postalCode: varchar('postal_code', { length: 16 }),
    location: geographyPoint('location').notNull(),
    timezone: varchar('timezone', { length: 64 }).notNull(),
    isPrimary: boolean('is_primary').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('idx_outlets_business_id').on(table.businessId),
    uniqueIndex('uq_outlets_business_primary')
      .on(table.businessId)
      .where(sql`${table.isPrimary} = true`),
    index('idx_outlets_location').using('gist', table.location),
  ],
);

export type OutletEntity = typeof outlets.$inferSelect;
export type NewOutletEntity = typeof outlets.$inferInsert;

/**
 * Outlet Operating Hours table.
 * Deterministic Monday-Sunday weekly operating schedule (7 rows per outlet).
 * day_of_week: 1 = Monday, 7 = Sunday.
 */
export const outletOperatingHours = pgTable(
  'outlet_operating_hours',
  {
    id: uuid('id').primaryKey(),
    outletId: uuid('outlet_id')
      .notNull()
      .references(() => outlets.id, { onDelete: 'cascade' }),
    dayOfWeek: integer('day_of_week').notNull(),
    isClosed: boolean('is_closed').notNull().default(false),
    openTime: time('open_time'),
    closeTime: time('close_time'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique('uq_outlet_operating_hours_outlet_day').on(table.outletId, table.dayOfWeek),
    index('idx_outlet_operating_hours_outlet_id').on(table.outletId),
    check(
      'chk_operating_hours_validity',
      sql`("is_closed" = true AND "open_time" IS NULL AND "close_time" IS NULL) OR ("is_closed" = false AND "open_time" IS NOT NULL AND "close_time" IS NOT NULL AND "open_time" < "close_time")`,
    ),
  ],
);

export type OutletOperatingHoursEntity = typeof outletOperatingHours.$inferSelect;
export type NewOutletOperatingHoursEntity = typeof outletOperatingHours.$inferInsert;
