import { z } from 'zod';
import type {
  Money,
  GeoPoint,
  AppAudience,
  CursorPaginationMeta,
} from '@platform/shared-types';

/**
 * Validates UUID string format (standard 8-4-4-4-12 hex representation).
 */
export const entityIdSchema = z
  .string()
  .uuid({ message: 'Invalid UUID identifier' });

/**
 * Validates ISO 8601 UTC timestamp format (YYYY-MM-DDTHH:mm:ss.sssZ).
 */
export const isoUtcTimestampSchema = z
  .string()
  .regex(
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/,
    { message: 'Timestamp must be an ISO 8601 UTC string (e.g. 2026-09-09T03:00:00.000Z)' },
  )
  .refine((val) => !isNaN(Date.parse(val)), {
    message: 'Timestamp must be a valid calendar date',
  });

/**
 * Currency code schema. Currently strictly 'IDR'.
 */
export const currencyCodeSchema = z.literal('IDR');

/**
 * Money schema.
 * Amount must be a non-negative whole integer Rupiah value within safe integer limit.
 * Fractional Rupiah (cents/sen) are strictly rejected.
 */
export const moneySchema: z.ZodType<Money> = z.object({
  amount: z
    .number()
    .int({ message: 'Money amount must be a whole integer Rupiah value' })
    .nonnegative({ message: 'Money amount must be non-negative' })
    .max(Number.MAX_SAFE_INTEGER, { message: 'Money amount exceeds maximum safe integer' }),
  currency: currencyCodeSchema,
});

/**
 * GeoPoint schema.
 * Validates WGS84 geographic coordinate boundaries.
 * lat: [-90, 90], lng: [-180, 180].
 */
export const geoPointSchema: z.ZodType<GeoPoint> = z.object({
  lat: z
    .number()
    .min(-90, { message: 'Latitude must be between -90 and 90 degrees' })
    .max(90, { message: 'Latitude must be between -90 and 90 degrees' }),
  lng: z
    .number()
    .min(-180, { message: 'Longitude must be between -180 and 180 degrees' })
    .max(180, { message: 'Longitude must be between -180 and 180 degrees' }),
});

/**
 * Distance meters schema.
 * Represents distance in whole integer meters (>= 0).
 */
export const distanceMetersSchema = z
  .number()
  .int({ message: 'Distance must be an integer number of meters' })
  .nonnegative({ message: 'Distance in meters must be non-negative' });

/**
 * Opaque cursor string schema.
 */
export const cursorSchema = z.string().min(1, { message: 'Cursor must not be empty' });

/**
 * Canonical sort direction schema.
 */
export const sortDirectionSchema = z.enum(['asc', 'desc']);

/**
 * AppAudience schema.
 */
export const appAudienceSchema: z.ZodType<AppAudience> = z.enum([
  'CUSTOMER_APP',
  'MERCHANT_APP',
  'DRIVER_APP',
  'ADMIN_WEB',
]);

/**
 * Cursor pagination metadata schema.
 */
export const cursorPaginationMetaSchema: z.ZodType<CursorPaginationMeta> = z.object({
  next_cursor: z.string().nullable(),
  has_more: z.boolean(),
});

