import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import Redis from 'ioredis';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = resolve(__dirname, '../../..');

/**
 * Parses simple KEY=VALUE pairs from a .env file if it exists.
 */
export function parseEnvFile(filePath) {
  if (!existsSync(filePath)) return {};
  try {
    const content = readFileSync(filePath, 'utf8');
    const env = {};
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx > 0) {
        const key = trimmed.substring(0, eqIdx).trim();
        let val = trimmed.substring(eqIdx + 1).trim();
        if (
          (val.startsWith('"') && val.endsWith('"')) ||
          (val.startsWith("'") && val.endsWith("'"))
        ) {
          val = val.slice(1, -1);
        }
        env[key] = val;
      }
    }
    return env;
  } catch {
    return {};
  }
}

/**
 * Resolves PostgreSQL admin database URL.
 * Prefers TEST_DATABASE_ADMIN_URL.
 * Alternatively derives an admin endpoint from DATABASE_URL by targeting the /postgres database.
 * Fails closed if no configuration is available.
 */
export function resolveAdminDatabaseUrl(env = process.env) {
  const source = env ?? process.env;
  if (source.TEST_DATABASE_ADMIN_URL) {
    const parsed = new URL(source.TEST_DATABASE_ADMIN_URL);
    if (!parsed.protocol.startsWith('postgres')) {
      throw new Error(`Invalid TEST_DATABASE_ADMIN_URL protocol: ${parsed.protocol}`);
    }
    return parsed.toString();
  }

  const rawDatabaseUrl =
    source.DATABASE_URL ??
    (source === process.env ? parseEnvFile(resolve(rootDir, '.env')).DATABASE_URL : undefined);
  if (rawDatabaseUrl) {
    const parsed = new URL(rawDatabaseUrl);
    parsed.pathname = '/postgres';
    return parsed.toString();
  }

  throw new Error(
    'Missing PostgreSQL configuration. TEST_DATABASE_ADMIN_URL or DATABASE_URL must be provided. ' +
      'Refusing to default to unsafe endpoints.',
  );
}

/**
 * Generates a unique, safe PostgreSQL identifier for temporary integration testing.
 */
export function generateTestDatabaseName(
  prefix = 'toranggo_test_',
  now = Date.now(),
  pid = process.pid,
  random = Math.random().toString(36).substring(2, 8),
) {
  return `${prefix}${now}_${pid}_${random}`;
}

/**
 * Enforces strict fail-safe validation on test database names.
 */
export function validateSafeTestDatabaseName(dbName) {
  if (typeof dbName !== 'string' || !dbName.trim()) {
    throw new Error('Test database name must be a non-empty string.');
  }

  if (dbName === 'toranggo_dev' || dbName.includes('toranggo_dev')) {
    throw new Error('CRITICAL SAFETY VIOLATION: Test database name cannot be toranggo_dev.');
  }

  if (dbName === 'postgres') {
    throw new Error('CRITICAL SAFETY VIOLATION: Test database name cannot be postgres.');
  }

  if (!dbName.startsWith('toranggo_test_')) {
    throw new Error(`Test database name must start with 'toranggo_test_', got: ${dbName}`);
  }

  if (!/^toranggo_test_[a-zA-Z0-9_]+$/.test(dbName)) {
    throw new Error(`Invalid characters in test database name identifier: ${dbName}`);
  }

  return true;
}

/**
 * Derives temporary database URL pointing to the given test database.
 */
export function deriveTestDatabaseUrl(adminUrlString, testDbName) {
  validateSafeTestDatabaseName(testDbName);
  const parsed = new URL(adminUrlString);
  parsed.pathname = `/${testDbName}`;
  return parsed.toString();
}

/**
 * Validates that database URL points safely to an internally generated test database.
 */
export function validateSafeTestDatabaseUrl(dbUrlString, expectedDbName = null) {
  const parsed = new URL(dbUrlString);
  const dbName = parsed.pathname.replace(/^\/+/, '');

  validateSafeTestDatabaseName(dbName);

  if (expectedDbName !== null && dbName !== expectedDbName) {
    throw new Error(
      `Database URL target mismatch: expected ${expectedDbName}, but URL points to ${dbName}`,
    );
  }

  return true;
}

/**
 * Resolves Redis test URL.
 * Requires a non-zero logical database (preferred: DB 15).
 * Fails closed if missing or pointing to DB 0.
 */
export function resolveTestRedisUrl(env = process.env) {
  const source = env ?? process.env;
  if (source.TEST_REDIS_URL) {
    const parsed = new URL(source.TEST_REDIS_URL);
    const dbNum = parseInt(parsed.pathname.replace(/^\/+/, '') || '0', 10);
    if (dbNum === 0 || isNaN(dbNum)) {
      throw new Error(
        `TEST_REDIS_URL must specify a non-zero logical database (e.g. redis://localhost:6380/15). Got DB ${dbNum}.`,
      );
    }
    return parsed.toString();
  }

  const rawRedisUrl =
    source.REDIS_URL ??
    (source === process.env ? parseEnvFile(resolve(rootDir, '.env')).REDIS_URL : undefined);
  if (rawRedisUrl) {
    const parsed = new URL(rawRedisUrl);
    parsed.pathname = '/15';
    return parsed.toString();
  }

  throw new Error(
    'Missing Redis configuration: TEST_REDIS_URL or REDIS_URL must be provided. ' +
      'Refusing to silently default to localhost:6379 to prevent accidental contamination.',
  );
}

/**
 * Validates that Redis test URL uses a dedicated non-zero logical database.
 */
export function validateSafeTestRedisUrl(redisUrlString) {
  const parsed = new URL(redisUrlString);
  const dbNum = parseInt(parsed.pathname.replace(/^\/+/, '') || '0', 10);
  if (dbNum === 0 || isNaN(dbNum)) {
    throw new Error(`Redis test database must not be logical DB 0. Got: ${dbNum}`);
  }
  return true;
}

/**
 * Creates temporary database via admin connection.
 */
export async function createTestDatabase(adminUrlString, testDbName) {
  validateSafeTestDatabaseName(testDbName);
  const client = new pg.Client({ connectionString: adminUrlString });
  await client.connect();
  try {
    await client.query(`CREATE DATABASE "${testDbName}";`);
  } finally {
    await client.end();
  }
}

/**
 * Drops temporary database via admin connection after terminating remaining connections.
 */
export async function dropTestDatabase(adminUrlString, testDbName) {
  validateSafeTestDatabaseName(testDbName);
  const client = new pg.Client({ connectionString: adminUrlString });
  await client.connect();
  try {
    await client.query(
      `SELECT pg_terminate_backend(pid)
       FROM pg_stat_activity
       WHERE datname = $1 AND pid <> pg_backend_pid();`,
      [testDbName],
    );
    await client.query(`DROP DATABASE IF EXISTS "${testDbName}";`);
  } finally {
    await client.end();
  }
}

/**
 * Cleans isolated Redis logical database using FLUSHDB.
 * Strict isolation: operates on selected logical DB only.
 */
export async function cleanTestRedis(redisUrlString) {
  validateSafeTestRedisUrl(redisUrlString);
  const redis = new Redis(redisUrlString, {
    maxRetriesPerRequest: 1,
    retryStrategy: () => null,
    lazyConnect: false,
  });

  try {
    await redis.flushdb();
  } finally {
    redis.disconnect();
  }
}

/**
 * Sets up isolated test infrastructure (temporary DB + clean Redis DB 15).
 */
export async function setupTestInfrastructure(options = {}) {
  const env = options.env ?? process.env;
  const adminUrl = resolveAdminDatabaseUrl(env);
  const testDbName = generateTestDatabaseName();

  validateSafeTestDatabaseName(testDbName);

  const testDbUrl = deriveTestDatabaseUrl(adminUrl, testDbName);
  validateSafeTestDatabaseUrl(testDbUrl, testDbName);

  const testRedisUrl = resolveTestRedisUrl(env);
  validateSafeTestRedisUrl(testRedisUrl);

  const infra = {
    adminUrl,
    testDbName,
    testDbUrl,
    testRedisUrl,
  };

  try {
    await createTestDatabase(adminUrl, testDbName);
    await cleanTestRedis(testRedisUrl);
    return infra;
  } catch (err) {
    await teardownTestInfrastructure(infra).catch(() => {});
    throw err;
  }
}

/**
 * Tears down isolated test infrastructure (cleans Redis test DB + drops temporary DB).
 */
export async function teardownTestInfrastructure(infra) {
  if (!infra) return;

  const errors = [];

  if (infra.testRedisUrl) {
    try {
      await cleanTestRedis(infra.testRedisUrl);
    } catch (err) {
      errors.push(`Redis cleanup error: ${err.message}`);
    }
  }

  if (infra.adminUrl && infra.testDbName) {
    try {
      await dropTestDatabase(infra.adminUrl, infra.testDbName);
    } catch (err) {
      errors.push(`PostgreSQL drop error: ${err.message}`);
    }
  }

  if (errors.length > 0) {
    throw new Error(`Teardown encountered errors:\n${errors.join('\n')}`);
  }
}
