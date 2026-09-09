import { Module, Global, Inject, type OnApplicationShutdown } from '@nestjs/common';
import { drizzle } from 'drizzle-orm/node-postgres';
import type pg from 'pg';
import { PG_POOL_TOKEN, DRIZZLE_DB_TOKEN } from './database.tokens.js';
import { createPgPool } from './connection.js';
import { TransactionService } from './transaction/transaction.service.js';
import { loadAppConfig } from '../config/app-config.js';
import * as schema from './schema/index.js';

@Global()
@Module({
  providers: [
    {
      provide: PG_POOL_TOKEN,
      useFactory: () => {
        const config = loadAppConfig();
        return createPgPool(config);
      },
    },
    {
      provide: DRIZZLE_DB_TOKEN,
      inject: [PG_POOL_TOKEN],
      useFactory: (pool: pg.Pool) => {
        return drizzle(pool, { schema });
      },
    },
    TransactionService,
  ],
  exports: [PG_POOL_TOKEN, DRIZZLE_DB_TOKEN, TransactionService],
})
export class DatabaseModule implements OnApplicationShutdown {
  constructor(
    @Inject(PG_POOL_TOKEN)
    private readonly pool: pg.Pool,
  ) {}

  async onApplicationShutdown(): Promise<void> {
    await this.pool.end();
  }
}
