import {
  Injectable,
  Inject,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import { eq } from 'drizzle-orm';
import type { Request } from 'express';
import { DRIZZLE_DB_TOKEN } from '../../database/database.tokens.js';
import type { DrizzleDb } from '../../database/transaction/transaction.service.js';
import { driverProfiles } from '../../database/schema/identity.js';
import { AppError } from '../../common/errors/app-error.js';

@Injectable()
export class ApprovedDriverGuard implements CanActivate {
  constructor(
    @Inject(DRIZZLE_DB_TOKEN)
    private readonly db: DrizzleDb,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request>();
    const userId = req.user?.id;

    if (!userId) {
      throw new AppError(401, 'UNAUTHORIZED', 'Driver identity not authenticated');
    }

    // Dynamic database-authoritative verification of driver profile status
    const rows = await this.db
      .select({ status: driverProfiles.status })
      .from(driverProfiles)
      .where(eq(driverProfiles.userId, userId))
      .limit(1);

    const profile = rows[0];

    if (!profile) {
      throw new AppError(
        403,
        'AUTH_FORBIDDEN',
        'Operational action requires an approved driver profile, but no driver profile exists',
        { profile_status: 'NOT_FOUND' },
      );
    }

    if (profile.status !== 'APPROVED') {
      throw new AppError(
        403,
        'AUTH_FORBIDDEN',
        `Operational action requires APPROVED status, but current status is ${profile.status}`,
        { profile_status: profile.status },
      );
    }

    return true;
  }
}
