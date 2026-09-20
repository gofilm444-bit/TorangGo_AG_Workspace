import {
  Injectable,
  SetMetadata,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { SessionService } from '../session/session.service.js';
import { AppError } from '../../common/errors/app-error.js';

export const PERMISSION_KEY = 'require_permission';
export const RequirePermission = (...permissions: string[]) =>
  SetMetadata(PERMISSION_KEY, permissions);

@Injectable()
export class AdminPermissionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly sessionService: SessionService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
      PERMISSION_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const req = context.switchToHttp().getRequest<Request>();
    const adminId = req.user?.id;
    const audience = req.user?.audience;

    if (!adminId || audience !== 'ADMIN_WEB') {
      throw new AppError(403, 'AUTH_FORBIDDEN', 'Admin access required');
    }

    const summary = await this.sessionService.getAdminPermissions(adminId);
    const hasPermission = requiredPermissions.every((p) => summary.permissions.includes(p));

    if (!hasPermission) {
      throw new AppError(
        403,
        'AUTH_FORBIDDEN',
        `Insufficient permissions. Missing required permission: ${requiredPermissions.join(', ')}`,
        { required: requiredPermissions, granted: summary.permissions },
      );
    }

    return true;
  }
}
