import { Injectable, Inject } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DRIZZLE_DB_TOKEN } from '../database.tokens.js';
import * as schema from '../schema/index.js';

export type DrizzleDb = NodePgDatabase<typeof schema>;
export type DrizzleTx = Parameters<Parameters<DrizzleDb['transaction']>[0]>[0];

@Injectable()
export class TransactionService {
  constructor(
    @Inject(DRIZZLE_DB_TOKEN)
    private readonly db: DrizzleDb,
  ) {}

  /**
   * Executes an operation inside a PostgreSQL database transaction with READ COMMITTED isolation.
   * Commits automatically on success, rolls back automatically on error.
   *
   * IMPORTANT:
   * DO NOT perform external network calls (HTTP requests, external APIs) inside database transactions.
   */
  async runInTransaction<T>(
    callback: (tx: DrizzleTx) => Promise<T>,
    isolationLevel?: 'read committed' | 'repeatable read' | 'serializable',
  ): Promise<T> {
    return this.db.transaction(
      async (tx) => {
        return callback(tx);
      },
      isolationLevel ? { isolationLevel } : undefined,
    );
  }
}
