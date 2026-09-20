import {
  Injectable,
  SetMetadata,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { AppError } from '../../common/errors/app-error.js';
import type { AppAudience } from '@platform/shared-types';

export const AUDIENCE_KEY = 'require_audience';
export const RequireAudience = (...audiences: AppAudience[]) =>
  SetMetadata(AUDIENCE_KEY, audiences);

@Injectable()
export class AudienceGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredAudiences = this.reflector.getAllAndOverride<AppAudience[]>(
      AUDIENCE_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredAudiences || requiredAudiences.length === 0) {
      return true;
    }

    const req = context.switchToHttp().getRequest<Request>();
    const userAudience = req.user?.audience;

    if (!userAudience) {
      throw new AppError(401, 'UNAUTHORIZED', 'Authenticated audience missing');
    }

    if (!requiredAudiences.includes(userAudience)) {
      throw new AppError(
        403,
        'AUTH_AUDIENCE_MISMATCH',
        `Access denied. Endpoint requires audience: ${requiredAudiences.join(', ')} but token was issued for ${userAudience}`,
      );
    }

    return true;
  }
}
