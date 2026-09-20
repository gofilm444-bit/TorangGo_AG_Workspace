/**
 * Standard error codes and response envelope types for TorangGo APIs.
 * Preserves the Phase 1B standard error contract.
 */

export type ApiErrorCode =
  | 'VALIDATION_ERROR'
  | 'BAD_REQUEST'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'IDEMPOTENCY_KEY_REUSED'
  | 'PAYLOAD_TOO_LARGE'
  | 'RATE_LIMITED'
  | 'INTERNAL_SERVER_ERROR';

export interface ApiErrorBody {
  code: ApiErrorCode | string;
  message: string;
  details?: unknown;
  request_id: string;
}

/**
 * Standard public HTTP error envelope for all TorangGo APIs.
 */
export interface ApiErrorResponse {
  error: ApiErrorBody;
}

