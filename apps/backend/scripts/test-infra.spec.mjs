import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  generateTestDatabaseName,
  validateSafeTestDatabaseName,
  deriveTestDatabaseUrl,
  validateSafeTestDatabaseUrl,
  resolveAdminDatabaseUrl,
  resolveTestRedisUrl,
  validateSafeTestRedisUrl,
} from './test-infra.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe('Test Infrastructure & Isolation Specification', () => {
  describe('1. Generated integration DB names', () => {
    it('starts with toranggo_test_ prefix', () => {
      const name = generateTestDatabaseName();
      assert.ok(
        name.startsWith('toranggo_test_'),
        `Expected prefix 'toranggo_test_', got ${name}`,
      );
    });

    it('generates unique database names across separate invocations', () => {
      const names = new Set();
      for (let i = 0; i < 100; i++) {
        const name = generateTestDatabaseName('toranggo_test_', Date.now(), process.pid, Math.random().toString(36).substring(2, 8));
        assert.equal(names.has(name), false, `Duplicate database name generated: ${name}`);
        names.add(name);
      }
      assert.equal(names.size, 100);
    });

    it('matches safe SQL identifier character set', () => {
      const name = generateTestDatabaseName();
      assert.match(name, /^toranggo_test_[a-zA-Z0-9_]+$/);
    });
  });

  describe('2. Safety guard rejects unsafe database targets', () => {
    it('strictly rejects toranggo_dev', () => {
      assert.throws(
        () => validateSafeTestDatabaseName('toranggo_dev'),
        /CRITICAL SAFETY VIOLATION: Test database name cannot be toranggo_dev/,
      );
    });

    it('strictly rejects postgres system database', () => {
      assert.throws(
        () => validateSafeTestDatabaseName('postgres'),
        /CRITICAL SAFETY VIOLATION: Test database name cannot be postgres/,
      );
    });

    it('rejects database names missing toranggo_test_ prefix', () => {
      assert.throws(
        () => validateSafeTestDatabaseName('my_production_db'),
        /Test database name must start with 'toranggo_test_'/,
      );
      assert.throws(
        () => validateSafeTestDatabaseName('dev_toranggo'),
        /Test database name must start with 'toranggo_test_'/,
      );
    });

    it('rejects invalid or dangerous identifier characters', () => {
      assert.throws(
        () => validateSafeTestDatabaseName('toranggo_test_db; DROP TABLE users;--'),
        /Invalid characters in test database name identifier/,
      );
      assert.throws(
        () => validateSafeTestDatabaseName('toranggo_test_db with spaces'),
        /Invalid characters in test database name identifier/,
      );
      assert.throws(
        () => validateSafeTestDatabaseName(''),
        /Test database name must be a non-empty string/,
      );
      assert.throws(
        () => validateSafeTestDatabaseName(null),
        /Test database name must be a non-empty string/,
      );
    });
  });

  describe('3. Derived test DATABASE_URL points to the temporary DB', () => {
    it('correctly constructs test DATABASE_URL pointing to generated test DB', () => {
      const adminUrl = 'postgresql://postgres:postgres@localhost:5433/postgres';
      const testDbName = 'toranggo_test_123456_789_abcdef';
      const testUrl = deriveTestDatabaseUrl(adminUrl, testDbName);

      const parsed = new URL(testUrl);
      assert.equal(parsed.pathname, `/${testDbName}`);
      assert.equal(parsed.hostname, 'localhost');
      assert.equal(parsed.port, '5433');
      assert.equal(parsed.username, 'postgres');
      assert.equal(parsed.password, 'postgres');

      // Passes fail-safe URL validation
      assert.equal(validateSafeTestDatabaseUrl(testUrl, testDbName), true);
    });

    it('validateSafeTestDatabaseUrl rejects URLs targeting toranggo_dev or postgres', () => {
      assert.throws(
        () => validateSafeTestDatabaseUrl('postgresql://postgres:postgres@localhost:5433/toranggo_dev'),
        /CRITICAL SAFETY VIOLATION/,
      );
      assert.throws(
        () => validateSafeTestDatabaseUrl('postgresql://postgres:postgres@localhost:5433/postgres'),
        /CRITICAL SAFETY VIOLATION/,
      );
    });

    it('validateSafeTestDatabaseUrl detects mismatch between expected and actual URL target', () => {
      const url = 'postgresql://postgres:postgres@localhost:5433/toranggo_test_db_a';
      assert.throws(
        () => validateSafeTestDatabaseUrl(url, 'toranggo_test_db_b'),
        /Database URL target mismatch/,
      );
    });
  });

  describe('4. Redis test isolation', () => {
    it('requires non-zero logical database and rejects DB 0', () => {
      assert.throws(
        () => validateSafeTestRedisUrl('redis://localhost:6380/0'),
        /Redis test database must not be logical DB 0/,
      );
      assert.throws(
        () => validateSafeTestRedisUrl('redis://localhost:6380/'),
        /Redis test database must not be logical DB 0/,
      );
      assert.throws(
        () => validateSafeTestRedisUrl('redis://localhost:6380'),
        /Redis test database must not be logical DB 0/,
      );
    });

    it('accepts non-zero logical database like DB 15', () => {
      assert.equal(validateSafeTestRedisUrl('redis://localhost:6380/15'), true);
      assert.equal(validateSafeTestRedisUrl('redis://localhost:6379/15'), true);
    });

    it('respects TEST_REDIS_URL override when valid non-zero DB is specified', () => {
      const env = { TEST_REDIS_URL: 'redis://custom-host:6380/14' };
      const resolved = resolveTestRedisUrl(env);
      assert.equal(resolved, 'redis://custom-host:6380/14');
    });

    it('rejects TEST_REDIS_URL pointing to DB 0', () => {
      const env = { TEST_REDIS_URL: 'redis://custom-host:6380/0' };
      assert.throws(
        () => resolveTestRedisUrl(env),
        /TEST_REDIS_URL must specify a non-zero logical database/,
      );
    });

    it('derives dedicated DB 15 when given base REDIS_URL', () => {
      const env = { REDIS_URL: 'redis://localhost:6380/0' };
      const resolved = resolveTestRedisUrl(env);
      assert.equal(resolved, 'redis://localhost:6380/15');
    });
  });

  describe('5. Missing unsafe configuration fails closed', () => {
    it('fails closed when neither TEST_REDIS_URL nor REDIS_URL is provided', () => {
      assert.throws(
        () => resolveTestRedisUrl({}),
        /Missing Redis configuration: TEST_REDIS_URL or REDIS_URL must be provided\. Refusing to silently default to localhost:6379/,
      );
      assert.throws(
        () => resolveTestRedisUrl(Object.create(null)),
        /Missing Redis configuration: TEST_REDIS_URL or REDIS_URL must be provided\. Refusing to silently default to localhost:6379/,
      );
    });

    it('fails closed when neither TEST_DATABASE_ADMIN_URL nor DATABASE_URL is provided', () => {
      assert.throws(
        () => resolveAdminDatabaseUrl({}),
        /Missing PostgreSQL configuration\. TEST_DATABASE_ADMIN_URL or DATABASE_URL must be provided/,
      );
      assert.throws(
        () => resolveAdminDatabaseUrl(Object.create(null)),
        /Missing PostgreSQL configuration\. TEST_DATABASE_ADMIN_URL or DATABASE_URL must be provided/,
      );
    });
  });

  describe('6. Cleanup code audit: FLUSHALL is strictly absent', () => {
    it('verifies test-infra.mjs source code does not contain FLUSHALL', () => {
      const source = readFileSync(resolve(__dirname, 'test-infra.mjs'), 'utf8');
      assert.equal(
        /flushall/i.test(source),
        false,
        'CRITICAL SAFETY VIOLATION: test-infra.mjs must NEVER contain or call FLUSHALL',
      );
      assert.ok(
        source.includes('flushdb'),
        'test-infra.mjs must use FLUSHDB for isolated database cleanup',
      );
    });
  });
});
