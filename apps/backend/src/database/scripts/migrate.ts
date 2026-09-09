import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import pg from 'pg';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

import { existsSync } from 'node:fs';

const { Pool } = pg;

export async function runMigrations(connectionString?: string, migrationsFolder?: string): Promise<void> {
  const url = connectionString ?? process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5433/toranggo_dev';
  const pool = new Pool({ connectionString: url });
  const db = drizzle(pool);

  let folder = migrationsFolder;
  if (!folder) {
    const candidates = [
      resolve(dirname(fileURLToPath(import.meta.url)), '../migrations'),
      resolve(dirname(fileURLToPath(import.meta.url)), '../../src/database/migrations'),
      resolve(process.cwd(), 'src/database/migrations'),
      resolve(process.cwd(), 'apps/backend/src/database/migrations'),
    ];
    folder = candidates.find((dir) => existsSync(resolve(dir, 'meta/_journal.json'))) ?? candidates[0];
  }

  try {
    console.log(`Applying migrations from ${folder}...`);
    await migrate(db, { migrationsFolder: folder });
    console.log('Migrations applied successfully.');
  } finally {
    await pool.end();
  }
}

// Direct execution entrypoint
if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  runMigrations()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Migration failed:', err);
      process.exit(1);
    });
}
