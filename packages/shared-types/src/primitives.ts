/**
 * Shared platform contract primitives for TorangGo.
 * All HTTP representations must follow snake_case.
 * Internal TypeScript representations use camelCase.
 */

/**
 * RFC 9562 UUIDv7 string identifier.
 */
export type EntityId = string;

/**
 * ISO 8601 UTC timestamp string formatted as YYYY-MM-DDTHH:mm:ss.sssZ.
 */
export type IsoUtcTimestamp = string;

/**
 * Canonical ISO currency code for TorangGo.
 */
export type CurrencyCode = 'IDR';

/**
 * Shared API-safe Money representation.
 * Represents whole Indonesian Rupiah without fractional cents/sen.
 * Amount must always be a non-negative integer within Number.MAX_SAFE_INTEGER.
 */
export interface Money {
  amount: number;
  currency: CurrencyCode;
}

/**
 * WGS84 geographic coordinate point (SRID 4326).
 * Distance calculations are expressed in meters.
 */
export interface GeoPoint {
  lat: number;
  lng: number;
}

/**
 * Canonical distance unit expressed in whole integer meters.
 */
export type DistanceMeters = number;

/**
 * Opaque cursor string for cursor-based pagination.
 * Clients must treat cursors as opaque tokens.
 */
export type Cursor = string;

/**
 * Canonical sort direction.
 */
export type SortDirection = 'asc' | 'desc';

/**
 * Platform application audience identifier.
 */
export type AppAudience =
  | 'CUSTOMER_APP'
  | 'MERCHANT_APP'
  | 'DRIVER_APP'
  | 'ADMIN_WEB';

