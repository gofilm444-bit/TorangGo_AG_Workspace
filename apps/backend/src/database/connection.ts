import pg from 'pg';
import type { AppConfig } from '../config/app-config.js';
import type { StructuredLogger } from '../common/logging/logger.service.js';

const { Pool } = pg;

export function createPgPool(config: AppConfig, logger?: StructuredLogger): pg.Pool {
  const pool = new Pool({
    connectionString: config.databaseUrl,
    min: config.databasePoolMin,
    max: config.databasePoolMax,
    ssl: config.databaseSsl ? { rejectUnauthorized: false } : false,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  });

  pool.on('error', (err) => {
    if (logger) {
      logger.error(`Unexpected idle PostgreSQL client error: ${err.message}`, err.stack);
    } else {
      console.error('Unexpected idle PostgreSQL client error:', err);
    }
  });

  return pool;
}
