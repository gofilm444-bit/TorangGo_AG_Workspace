import {
  type ExceptionFilter,
  Catch,
  type ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { AppError } from '../errors/app-error.js';
import { ERROR_CODES, type ErrorCode } from '../errors/error-codes.js';
import { StructuredLogger } from '../logging/logger.service.js';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  constructor(private readonly logger?: StructuredLogger) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const requestId = request.id || (response.getHeader('X-Request-ID') as string) || 'unknown';

    let statusCode: number;
    let code: ErrorCode;
    let message: string;
    let details: Record<string, unknown> = {};

    if (exception instanceof AppError) {
      statusCode = exception.statusCode;
      code = exception.code;
      message = exception.message;
      details = exception.details;
    } else if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      const res = exception.getResponse();

      if (statusCode === HttpStatus.NOT_FOUND) {
        code = ERROR_CODES.NOT_FOUND;
        message = typeof res === 'object' && res !== null && 'message' in res ? String(res.message) : 'Resource not found';
      } else if (statusCode === HttpStatus.TOO_MANY_REQUESTS) {
        code = ERROR_CODES.RATE_LIMITED;
        message = 'Too Many Requests';
      } else if (statusCode === HttpStatus.PAYLOAD_TOO_LARGE) {
        code = ERROR_CODES.PAYLOAD_TOO_LARGE;
        message = 'Payload Too Large';
      } else if (statusCode === HttpStatus.BAD_REQUEST) {
        code = ERROR_CODES.BAD_REQUEST;
        message = typeof res === 'object' && res !== null && 'message' in res ? String(res.message) : 'Bad Request';
      } else if (statusCode === HttpStatus.UNAUTHORIZED) {
        code = ERROR_CODES.UNAUTHORIZED;
        message = 'Unauthorized';
      } else if (statusCode === HttpStatus.FORBIDDEN) {
        code = ERROR_CODES.FORBIDDEN;
        message = 'Forbidden';
      } else if (statusCode === HttpStatus.CONFLICT) {
        code = ERROR_CODES.CONFLICT;
        message = 'Conflict';
      } else {
        code = statusCode >= 500 ? ERROR_CODES.INTERNAL_ERROR : ERROR_CODES.BAD_REQUEST;
        message = typeof res === 'string' ? res : (typeof res === 'object' && res !== null && 'message' in res ? String(res.message) : 'Request processing error');
      }

      if (typeof res === 'object' && res !== null && !('error' in res)) {
        const rest = { ...(res as Record<string, unknown>) };
        delete rest['message'];
        delete rest['statusCode'];
        if (Object.keys(rest).length > 0) {
          details = rest;
        }
      }
    } else if (
      (exception as { status?: number; statusCode?: number })?.status === HttpStatus.PAYLOAD_TOO_LARGE ||
      (exception as { status?: number; statusCode?: number })?.statusCode === HttpStatus.PAYLOAD_TOO_LARGE ||
      (exception as { type?: string })?.type === 'entity.too.large'
    ) {
      statusCode = HttpStatus.PAYLOAD_TOO_LARGE;
      code = ERROR_CODES.PAYLOAD_TOO_LARGE;
      message = 'Payload Too Large';
    } else if (
      (exception as { status?: number; statusCode?: number })?.status === HttpStatus.BAD_REQUEST ||
      (exception as { status?: number; statusCode?: number })?.statusCode === HttpStatus.BAD_REQUEST
    ) {
      statusCode = HttpStatus.BAD_REQUEST;
      code = ERROR_CODES.BAD_REQUEST;
      message = 'Bad Request';
    } else {
      statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
      code = ERROR_CODES.INTERNAL_ERROR;
      message = 'An unexpected internal server error occurred';

      if (this.logger) {
        this.logger.error(
          {
            message: 'Unhandled exception',
            request_id: requestId,
            error: exception instanceof Error ? exception.message : String(exception),
          },
          exception instanceof Error ? exception.stack : undefined,
          'GlobalExceptionFilter',
        );
      }
    }

    if (!response.getHeader('X-Request-ID')) {
      response.setHeader('X-Request-ID', requestId);
    }

    response.status(statusCode).json({
      error: {
        code,
        message,
        details,
        request_id: requestId,
      },
    });
  }
}
