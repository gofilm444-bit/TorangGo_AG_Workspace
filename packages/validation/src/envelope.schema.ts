import { z } from 'zod';
import { isoUtcTimestampSchema, cursorPaginationMetaSchema } from './primitives.schema.js';
import type {
  ApiErrorCode,
  ApiErrorBody,
  ApiErrorResponse,
} from '@platform/shared-types';

/**
 * Standard API error codes schema.
 */
export const apiErrorCodeSchema: z.ZodType<ApiErrorCode> = z.enum([
  'VALIDATION_ERROR',
  'BAD_REQUEST',
  'UNAUTHORIZED',
  'FORBIDDEN',
  'NOT_FOUND',
  'CONFLICT',
  'IDEMPOTENCY_KEY_REUSED',
  'PAYLOAD_TOO_LARGE',
  'RATE_LIMITED',
  'INTERNAL_SERVER_ERROR',
]);

/**
 * Standard API error body schema.
 */
export const apiErrorBodySchema: z.ZodType<ApiErrorBody> = z.object({
  code: z.string(),
  message: z.string(),
  details: z.unknown().optional(),
  request_id: z.string(),
});

/**
 * Standard API error response envelope schema.
 */
export const apiErrorResponseSchema: z.ZodType<ApiErrorResponse> = z.object({
  error: apiErrorBodySchema,
});

/**
 * Standard API metadata schema.
 */
export const apiMetadataSchema = z.object({
  request_id: z.string(),
  timestamp: isoUtcTimestampSchema,
});

/**
 * Factory for single-entity or non-paginated API success envelope schema.
 */
export function createApiSuccessResponseSchema<T extends z.ZodTypeAny>(dataSchema: T) {
  return z.object({
    data: dataSchema,
    meta: apiMetadataSchema,
  });
}

/**
 * Factory for paginated API success envelope schema.
 */
export function createApiPaginatedResponseSchema<T extends z.ZodTypeAny>(itemSchema: T) {
  return z.object({
    data: z.array(itemSchema),
    meta: apiMetadataSchema.extend({
      pagination: cursorPaginationMetaSchema,
    }),
  });
}

