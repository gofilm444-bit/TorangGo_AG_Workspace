import { readdirSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { setupTestInfrastructure, teardownTestInfrastructure } from './test-infra.mjs';

const distDir = resolve(process.cwd(), 'dist');
if (!existsSync(distDir)) {
  console.error('Error: dist directory not found. Please compile TypeScript (tsc) before testing.');
  process.exit(1);
}

// 1. Discover compiled backend test suites
const entries = readdirSync(distDir, { recursive: true });
const compiledFiles = entries
  .map((e) => (typeof e === 'string' ? e : e.name))
  .filter((name) => name && name.endsWith('.spec.js'))
  .map((name) => resolve(distDir, name));

if (compiledFiles.length === 0) {
  console.log('No compiled test files found to execute.');
  process.exit(0);
}

// 2. Step 1: Run pure test-infrastructure safety regression suite first
const infraSpec = resolve(process.cwd(), 'scripts/test-infra.spec.mjs');
if (existsSync(infraSpec)) {
  console.log('[test-runner] Step 1: Running test-infrastructure safety regression suite...');
  const infraResult = spawnSync(process.execPath, ['--test', infraSpec], {
    stdio: 'inherit',
    env: process.env,
  });

  const infraExitCode = infraResult.status ?? (infraResult.signal ? 1 : 0);
  if (infraExitCode !== 0) {
    console.error('[test-runner] [FAIL] Test-infrastructure safety regression suite failed. Aborting integration tests.');
    process.exit(infraExitCode);
  }
  console.log('[test-runner] [PASS] Test-infrastructure safety regression suite passed (18 tests).\n');
} else {
  console.warn('[test-runner] Warning: scripts/test-infra.spec.mjs not found.');
}

// 3. Step 2: Provision isolated test infrastructure & run compiled integration/unit suite
let infra = null;
let testExitCode = 1;

try {
  console.log('[test-runner] Step 2: Provisioning isolated test infrastructure...');
  infra = await setupTestInfrastructure();
  console.log(`[test-runner] Isolated PostgreSQL database created: ${infra.testDbName}`);
  console.log(`[test-runner] Isolated Redis database ready: ${infra.testRedisUrl}`);

  console.log('[test-runner] Running schema migrations against temporary database...');
  const { runMigrations } = await import('../dist/database/scripts/migrate.js');
  await runMigrations(infra.testDbUrl);
  console.log('[test-runner] Schema migrations completed.');

  console.log(`[test-runner] Launching ${compiledFiles.length} compiled test suite(s)...`);
  const childEnv = {
    ...process.env,
    NODE_ENV: 'test',
    DATABASE_URL: infra.testDbUrl,
    REDIS_URL: infra.testRedisUrl,
    TEST_DATABASE_ADMIN_URL: infra.adminUrl,
    TEST_REDIS_URL: infra.testRedisUrl,
  };

  const result = spawnSync(process.execPath, ['--test', ...compiledFiles], {
    stdio: 'inherit',
    env: childEnv,
  });

  testExitCode = result.status ?? (result.signal ? 1 : 0);
} catch (err) {
  console.error('[test-runner] Fatal error during test execution:', err);
  testExitCode = 1;
} finally {
  if (infra) {
    console.log('[test-runner] Tearing down isolated test infrastructure...');
    try {
      await teardownTestInfrastructure(infra);
      console.log(`[test-runner] Dropped temporary database: ${infra.testDbName}`);
      console.log('[test-runner] Cleaned test Redis logical database.');
    } catch (cleanupErr) {
      console.error('[test-runner] Cleanup failure:', cleanupErr);
      testExitCode = testExitCode !== 0 ? testExitCode : 1;
    }
  }
}

process.exit(testExitCode);
