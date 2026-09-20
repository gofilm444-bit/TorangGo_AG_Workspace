import { ERROR_CODES, type ErrorCode } from './error-codes.js';

export interface AppErrorOptions {
  code: ErrorCode;
  message: string;
  statusCode?: number;
  details?: Record<string, unknown>;
  cause?: unknown;
}

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly statusCode: number;
  readonly details: Record<string, unknown>;
  override readonly cause?: unknown;

  constructor(options: AppErrorOptions);
  constructor(
    statusCode: number,
    code: ErrorCode | string,
    message: string,
    details?: Record<string, unknown>,
  );
  constructor(
    optionsOrStatus: AppErrorOptions | number,
    maybeCode?: ErrorCode | string,
    maybeMessage?: string,
    maybeDetails?: Record<string, unknown>,
  ) {
    if (typeof optionsOrStatus === 'number') {
      super(maybeMessage ?? 'An error occurred');
      this.name = this.constructor.name;
      this.statusCode = optionsOrStatus;
      this.code = (maybeCode as ErrorCode) ?? ERROR_CODES.INTERNAL_ERROR;
      this.details = maybeDetails ?? {};
    } else {
      super(optionsOrStatus.message);
      this.name = this.constructor.name;
      this.code = optionsOrStatus.code;
      this.statusCode = optionsOrStatus.statusCode ?? 500;
      this.details = optionsOrStatus.details ?? {};
      this.cause = optionsOrStatus.cause;
    }
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class BadRequestError extends AppError {
  constructor(message = 'Bad Request', details?: Record<string, unknown>) {
    super({ code: ERROR_CODES.BAD_REQUEST, message, statusCode: 400, details });
  }
}

export class ValidationError extends AppError {
  constructor(message = 'Validation failed', details?: Record<string, unknown>) {
    super({ code: ERROR_CODES.VALIDATION_ERROR, message, statusCode: 400, details });
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized', details?: Record<string, unknown>) {
    super({ code: ERROR_CODES.UNAUTHORIZED, message, statusCode: 401, details });
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Forbidden', details?: Record<string, unknown>) {
    super({ code: ERROR_CODES.FORBIDDEN, message, statusCode: 403, details });
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Not Found', details?: Record<string, unknown>) {
    super({ code: ERROR_CODES.NOT_FOUND, message, statusCode: 404, details });
  }
}

export class ConflictError extends AppError {
  constructor(message = 'Conflict', details?: Record<string, unknown>) {
    super({ code: ERROR_CODES.CONFLICT, message, statusCode: 409, details });
  }
}

export class IdempotencyConflictError extends AppError {
  constructor(
    message = 'An operation with this Idempotency-Key was already executed with different parameters',
    details?: Record<string, unknown>,
  ) {
    super({ code: ERROR_CODES.IDEMPOTENCY_KEY_REUSED, message, statusCode: 409, details });
  }
}

export class RateLimitedError extends AppError {
  constructor(message = 'Too Many Requests', details?: Record<string, unknown>) {
    super({ code: ERROR_CODES.RATE_LIMITED, message, statusCode: 429, details });
  }
}

export class PayloadTooLargeError extends AppError {
  constructor(message = 'Payload Too Large', details?: Record<string, unknown>) {
    super({ code: ERROR_CODES.PAYLOAD_TOO_LARGE, message, statusCode: 413, details });
  }
}

export class InternalServerError extends AppError {
  constructor(message = 'Internal Server Error', cause?: unknown) {
    super({ code: ERROR_CODES.INTERNAL_ERROR, message, statusCode: 500, cause });
  }
}
