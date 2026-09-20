import {
  Injectable,
  type NestInterceptor,
  type ExecutionContext,
  type CallHandler,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { StructuredLogger } from './logger.service.js';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  constructor(private readonly logger: StructuredLogger) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const ctx = context.switchToHttp();
    const req = ctx.getRequest<Request>();
    const res = ctx.getResponse<Response>();

    const startTime = Date.now();
    const requestId = req.id ?? 'unknown';
    const method = req.method;
    const path = req.originalUrl || req.url;

    return next.handle().pipe(
      tap({
        next: () => {
          const duration_ms = Date.now() - startTime;
          const status_code = res.statusCode;
          this.logger.log({
            request_id: requestId,
            method,
            path,
            status_code,
            duration_ms,
            message: `${method} ${path} ${status_code} - ${duration_ms}ms`,
          }, 'HTTP');
        },
        error: (err) => {
          const duration_ms = Date.now() - startTime;
          const status_code = err?.status || err?.statusCode || 500;
          this.logger.log({
            request_id: requestId,
            method,
            path,
            status_code,
            duration_ms,
            message: `${method} ${path} ${status_code} - ${duration_ms}ms (error)`,
          }, 'HTTP');
        },
      }),
    );
  }
}