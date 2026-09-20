import { Injectable, Inject } from '@nestjs/common';
import type pg from 'pg';
import { PG_POOL_TOKEN } from '../database/database.tokens.js';
import type { AdminOverviewResponseDto } from './dto/admin-overview.dto.js';

@Injectable()
export class AdminService {
  constructor(
    @Inject(PG_POOL_TOKEN)
    private readonly pool: pg.Pool,
  ) {}

  /**
   * Returns operational summary counts derived directly from PostgreSQL.
   * Completely read-only, non-mutating, zero N+1 queries.
   */
  async getOverview(): Promise<AdminOverviewResponseDto> {
    const [usersRes, merchantsRes, driversRes] = await Promise.all([
      this.pool.query<{ total: number }>(
        `SELECT count(*)::int AS total FROM users;`,
      ),
      this.pool.query<{
        total: number;
        pending: number;
        approved: number;
        rejected: number;
        suspended: number;
      }>(
        `SELECT
           count(*)::int AS total,
           count(*) FILTER (WHERE status = 'PENDING')::int AS pending,
           count(*) FILTER (WHERE status = 'APPROVED')::int AS approved,
           count(*) FILTER (WHERE status = 'REJECTED')::int AS rejected,
           count(*) FILTER (WHERE status = 'SUSPENDED')::int AS suspended
         FROM merchant_profiles;`,
      ),
      this.pool.query<{
        total: number;
        pending: number;
        approved: number;
        rejected: number;
        suspended: number;
      }>(
        `SELECT
           count(*)::int AS total,
           count(*) FILTER (WHERE status = 'PENDING')::int AS pending,
           count(*) FILTER (WHERE status = 'APPROVED')::int AS approved,
           count(*) FILTER (WHERE status = 'REJECTED')::int AS rejected,
           count(*) FILTER (WHERE status = 'SUSPENDED')::int AS suspended
         FROM driver_profiles;`,
      ),
    ]);

    const usersRow = usersRes.rows[0];
    const merchantsRow = merchantsRes.rows[0];
    const driversRow = driversRes.rows[0];

    return {
      users: {
        total: Number(usersRow?.total ?? 0),
      },
      merchants: {
        total: Number(merchantsRow?.total ?? 0),
        pending: Number(merchantsRow?.pending ?? 0),
        approved: Number(merchantsRow?.approved ?? 0),
        rejected: Number(merchantsRow?.rejected ?? 0),
        suspended: Number(merchantsRow?.suspended ?? 0),
      },
      drivers: {
        total: Number(driversRow?.total ?? 0),
        pending: Number(driversRow?.pending ?? 0),
        approved: Number(driversRow?.approved ?? 0),
        rejected: Number(driversRow?.rejected ?? 0),
        suspended: Number(driversRow?.suspended ?? 0),
      },
    };
  }
}
