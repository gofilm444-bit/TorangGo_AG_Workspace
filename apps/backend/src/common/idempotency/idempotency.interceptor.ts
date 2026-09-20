import {
  Injectable,
  Inject,
  type NestInterceptor,
  type ExecutionContext,
  type CallHandler,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request, Response } from 'express';
import { Observable, of } from 'rxjs';
import { tap } from 'rxjs/operators';
import { createHash } from 'node:crypto';
import { IDEMPOTENT_METADATA_KEY } from './idempotent.decorator.js';
import {
  type IdempotencyStore,
  type IdempotencyRecord,
  IDEMPOTENCY_STORE_TOKEN,
} from './idempotency-store.interface.js';
import { BadRequestError, IdempotencyConflictError } from '../errors/app-error.js';

export function canonicalizeJson(value: unknown): unknown {
  if (value === null || typeof value !== 'object') {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => canonicalizeJson(item));
  }

  const sortedObj: Record<string, unknown> = {};
  const keys = Object.keys(value as Record<string, unknown>).sort();
  for (const key of keys) {
    sortedObj[key] = canonicalizeJson((value as Record<string, unknown>)[key]);
  }
  return sortedObj;
}

export function calculateFingerprint(method: string, path: string, body: unknown): string {
  const canonicalBody = body !== undefined && body !== null ? JSON.stringify(canonicalizeJson(body)) : '';
  const normalizedPath = path.toLowerCase().replace(/\/+$/, '') || '/';
  const data = `${method.toUpperCase()}:${normalizedPath}:${canonicalBody}`;
  return createHash('sha256').update(data).digest('hex');
}

@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    @Inject(IDEMPOTENCY_STORE_TOKEN)
    private readonly store: IdempotencyStore,
  ) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<unknown>> {
    const isIdempotent = this.reflector.getAllAndOverride<boolean>(IDEMPOTENT_METADATA_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!isIdempotent) {
      return next.handle();
    }

    const http = context.switchToHttp();
    const req = http.getRequest<Request>();
    const res = http.getResponse<Response>();

    const rawKey = req.headers['idempotency-key'];
    if (!rawKey || typeof rawKey !== 'string' || !rawKey.trim()) {
      throw new BadRequestError('Idempotency-Key header is required for this operation');
    }

    const idempotencyKey = rawKey.trim();
    const path = req.originalUrl || req.url;
    const fingerprint = calculateFingerprint(req.method, path, req.body);

    const claimableStore = this.store as {
      claim?: (
        key: string,
        fingerprint: string,
        scope?: string,
      ) => Promise<{ status: 'claimed' | 'replayed' | 'conflict'; record?: IdempotencyRecord }>;
      releaseClaim?: (key: string, scope?: string) => Promise<void>;
    };

    if (typeof claimableStore.claim === 'function') {
      const claimResult = await claimableStore.claim(idempotencyKey, fingerprint, path);
      if (claimResult.status === 'replayed' && claimResult.record) {
        res.status(claimResult.record.statusCode);
        res.setHeader('X-Idempotency-Replayed', 'true');
        return of(claimResult.record.responseBody);
      }
      if (claimResult.status === 'conflict') {
        throw new IdempotencyConflictError();
      }
    } else {
      const existingRecord = await this.store.get(idempotencyKey);

      if (existingRecord) {
        if (existingRecord.fingerprint === fingerprint) {
          res.status(existingRecord.statusCode);
          res.setHeader('X-Idempotency-Replayed', 'true');
          return of(existingRecord.responseBody);
        } else {
          throw new IdempotencyConflictError();
        }
      }
    }

    return next.handle().pipe(
      tap({
        next: async (responseBody) => {
          await (this.store as { set: (k: string, r: IdempotencyRecord, s?: string) => Promise<void> | void }).set(
            idempotencyKey,
            {
              fingerprint,
              statusCode: res.statusCode || 200,
              responseBody,
              createdAt: Date.now(),
            },
            path,
          );
        },
        error: async () => {
          await claimableStore.releaseClaim?.(idempotencyKey, path);
        },
      }),
    );
  }
}
