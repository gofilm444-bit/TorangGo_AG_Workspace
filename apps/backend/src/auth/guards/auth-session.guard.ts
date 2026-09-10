import {
  Injectable,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import type { Request } from 'express';
import { TokenService } from '../tokens/token.service.js';
import { SessionService } from '../session/session.service.js';
import { AppError } from '../../common/errors/app-error.js';
import type { AppAudience } from '@platform/shared-types';

export interface AuthenticatedUser {
  id: string;
  sessionId: string;
  audience: AppAudience;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

@Injectable()
export class AuthSessionGuard implements CanActivate {
  constructor(
    private readonly tokenService: TokenService,
    private readonly sessionService: SessionService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request>();

    let token: string | undefined;

    // 1. Bearer token in Authorization header
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7).trim();
    }

    // 2. Fallback to HttpOnly cookie for Admin Web
    if (!token && req.cookies && req.cookies['toranggo_admin_access']) {
      token = req.cookies['toranggo_admin_access'];
    }

    if (!token) {
      throw new AppError(401, 'UNAUTHORIZED', 'Authentication credentials missing');
    }

    // Verify JWT claims
    const claims = this.tokenService.verifyAccessToken(token);

    // Verify active session in PostgreSQL
    const session = await this.sessionService.getActiveSession(claims.sid);
    if (!session) {
      throw new AppError(401, 'AUTH_SESSION_REVOKED', 'Session has been revoked or expired');
    }

    req.user = {
      id: claims.sub,
      sessionId: claims.sid,
      audience: claims.aud,
    };

    return true;
  }
}
