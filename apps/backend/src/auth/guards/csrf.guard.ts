import {
  Injectable,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import crypto from 'node:crypto';
import type { Request } from 'express';
import { AppError } from '../../common/errors/app-error.js';

@Injectable()
export class CsrfGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    const method = req.method.toUpperCase();

    // Safe read-only HTTP methods do not mutate state
    if (['GET', 'HEAD', 'OPTIONS'].includes(method)) {
      return true;
    }

    // CSRF protection applies when browser cookie transport is utilized
    const adminCookie = req.cookies?.['toranggo_admin_access'];
    const csrfCookie = req.cookies?.['toranggo_admin_csrf'];

    // If request is authenticated via cookie, CSRF token header is mandatory
    if (adminCookie || csrfCookie) {
      const csrfHeader = (req.headers['x-csrf-token'] as string | undefined)?.trim();

      if (!csrfHeader || !csrfCookie) {
        throw new AppError(403, 'FORBIDDEN', 'CSRF token missing from request');
      }

      const headerBuf = Buffer.from(csrfHeader);
      const cookieBuf = Buffer.from(csrfCookie);

      const isValid =
        headerBuf.length === cookieBuf.length &&
        crypto.timingSafeEqual(headerBuf, cookieBuf);

      if (!isValid) {
        throw new AppError(403, 'FORBIDDEN', 'Invalid CSRF token');
      }
    }

    return true;
  }
}
