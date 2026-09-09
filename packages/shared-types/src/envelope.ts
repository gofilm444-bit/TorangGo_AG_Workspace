/**
 * Standard API response envelope contracts for TorangGo.
 * Preserves the Phase 1B standard success envelope and adds cursor pagination.
 */

import type { IsoUtcTimestamp, Cursor } from './primitives.js';

export interface ApiMetadata {
  request_id: string;
  timestamp: IsoUtcTimestamp;
}

export interface CursorPaginationMeta {
  next_cursor: Cursor | null;
  has_more: boolean;
}

/**
 * Standard single-entity or non-paginated API success envelope.
 */
export interface ApiSuccessResponse<T> {
  data: T;
  meta: ApiMetadata;
}

/**
 * Standard paginated list API response envelope.
 */
export interface ApiPaginatedResponse<T> {
  data: T[];
  meta: ApiMetadata & {
    pagination: CursorPaginationMeta;
  };
}

