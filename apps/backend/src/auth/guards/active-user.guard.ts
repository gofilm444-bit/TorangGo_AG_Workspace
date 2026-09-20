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
import { users } from '../../database/schema/identity.js';
import { AppError } from '../../common/errors/app-error.js';

@Injectable()
export class ActiveUserGuard implements CanActivate {
  constructor(
    @Inject(DRIZZLE_DB_TOKEN)
    private readonly db: DrizzleDb,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request>();
    const userId = req.user?.id;

    if (!userId) {
      throw new AppError(401, 'UNAUTHORIZED', 'User not authenticated');
    }

    const rows = await this.db
      .select({ status: users.status })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    const user = rows[0];
    if (!user || user.status !== 'ACTIVE') {
      throw new AppError(403, 'AUTH_FORBIDDEN', 'User account is not active');
    }

    return true;
  }
}
