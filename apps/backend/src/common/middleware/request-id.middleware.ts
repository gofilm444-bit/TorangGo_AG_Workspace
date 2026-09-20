import { Injectable, type NestMiddleware } from '@nestjs/common';
import type { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'node:crypto';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      id?: string;
    }
  }
}

export const MAX_REQUEST_ID_LENGTH = 128;
export const SAFE_REQUEST_ID_REGEX = /^[a-zA-Z0-9_-]{1,128}$/;

export function sanitizeRequestId(rawHeader: unknown): string {
  if (typeof rawHeader !== 'string') {
    return randomUUID();
  }

  const trimmed = rawHeader.trim();

  if (
    trimmed.length === 0 ||
    trimmed.length > MAX_REQUEST_ID_LENGTH ||
    !SAFE_REQUEST_ID_REGEX.test(trimmed)
  ) {
    return randomUUID();
  }

  return trimmed;
}

@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    const rawHeader = req.headers['x-request-id'];
    const requestId = sanitizeRequestId(rawHeader);

    req.id = requestId;
    res.setHeader('X-Request-ID', requestId);
    next();
  }
}
