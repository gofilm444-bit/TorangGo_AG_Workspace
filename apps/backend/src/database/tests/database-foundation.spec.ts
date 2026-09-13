import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { eq } from 'drizzle-orm';
import { loadAppConfig } from '../../config/app-config.js';
import { createPgPool } from '../connection.js';
import { TransactionService, type DrizzleDb } from '../transaction/transaction.service.js';
import { PostgresIdempotencyStore } from '../idempotency/postgres-idempotency.store.js';
import { outboxEvents } from '../schema/outbox.js';
import { idempotencyRecords } from '../schema/idempotency.js';
import * as schema from '../schema/index.js';
import { generateUuidV7, isValidUuidV7 } from '@platform/utils';
import { runMigrations } from '../scripts/migrate.js';

describe('Phase 1C Database Foundation & Persistence Suite', () => {
  const config = loadAppConfig();
  let pool: pg.Pool;
  let db: DrizzleDb;
  let transactionService: TransactionService;
  let idempotencyStore: PostgresIdempotencyStore;

  before(async () => {
    pool = createPgPool(config);
    db = drizzle(pool, { schema });
    transactionService = new TransactionService(db);
    idempotencyStore = new PostgresIdempotencyStore(pool, db);
  });

  after(async () => {
    // Clean pool drain ensuring zero lingering sockets
    await pool.end();
  });

  describe('1. Database Connectivity & Pool', () => {
    test('connects successfully to PostgreSQL 17', async () => {
      const res = await pool.query('SELECT version();');
      assert.ok(res.rows[0].version.includes('PostgreSQL 17'));
    });

    test('verifies pool sizing configuration', () => {
      assert.equal(config.databasePoolMin, 2);
      assert.equal(config.databasePoolMax, 10);
    });

    test('proves migrations apply successfully to an isolated empty database', async () => {
      const adminUrlString =
        process.env.TEST_DATABASE_ADMIN_URL ??
        (() => {
          if (process.env.DATABASE_URL) {
            const u = new URL(process.env.DATABASE_URL);
            u.pathname = '/postgres';
            return u.toString();
          }
          throw new Error('TEST_DATABASE_ADMIN_URL is required for database foundation migration tests');
        })();

      const testDbName = `toranggo_test_empty_mig_${Date.now()}_${process.pid}_${Math.random().toString(36).substring(2, 8)}`;
      assert.ok(testDbName.startsWith('toranggo_test_'));
      assert.notEqual(testDbName, 'toranggo_dev');
      assert.notEqual(testDbName, 'postgres');

      const isolatedParsed = new URL(adminUrlString);
      isolatedParsed.pathname = `/${testDbName}`;
      const isolatedUrl = isolatedParsed.toString();

      const adminClient = new pg.Client({
        connectionString: adminUrlString,
      });
      await adminClient.connect();

      try {
        await adminClient.query(`CREATE DATABASE "${testDbName}";`);
        await runMigrations(isolatedUrl);

        const testClient = new pg.Client({ connectionString: isolatedUrl });
        await testClient.connect();

        try {
          // Verify PostGIS extension was loaded in fresh database
          const postgisRes = await testClient.query('SELECT PostGIS_Version();');
          assert.ok(postgisRes.rows[0].postgis_version.includes('3.5'));

          // Check drizzle migration table (stored in 'drizzle' schema by Drizzle ORM)
          const migrationTableRes = await testClient.query(`
            SELECT table_schema, table_name
            FROM information_schema.tables
            WHERE table_name = '__drizzle_migrations';
          `);
          assert.ok(migrationTableRes.rows.length > 0, '__drizzle_migrations tracking table must exist in database');

          // Verify tables created in public schema
          const tablesRes = await testClient.query(`
            SELECT table_name
            FROM information_schema.tables
            WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
            ORDER BY table_name;
          `);
          const publicTableNames = tablesRes.rows.map((r: { table_name: string }) => r.table_name);

          // Foundation tables must exist
          assert.ok(publicTableNames.includes('outbox_events'), 'outbox_events table must exist');
          assert.ok(publicTableNames.includes('idempotency_records'), 'idempotency_records table must exist');
          // Foundation & Phase 1G Identity/Auth tables must exist
          const expectedTables = [
            'outbox_events',
            'idempotency_records',
            'users',
            'customer_profiles',
            'merchant_profiles',
            'driver_profiles',
            'auth_sessions',
            'refresh_tokens',
            'admin_accounts',
            'admin_roles',
            'admin_permissions',
            'admin_account_roles',
            'admin_role_permissions',
            'admin_recovery_codes',
          ];
          for (const tbl of expectedTables) {
            assert.ok(publicTableNames.includes(tbl), `${tbl} table must exist in clean database`);
          }

          // Strict scope boundary: ZERO business domain tables (users, orders, merchants, etc.)
          const businessDomainTables = publicTableNames.filter(
            (t: string) => !['outbox_events', 'idempotency_records', 'spatial_ref_sys'].includes(t),
          );
          // Strict scope boundary: ZERO Phase 2 business domain tables (orders, carts, products, outlets, payments, etc.)
          const allowedTables = new Set([...expectedTables, 'spatial_ref_sys']);
          const forbiddenBusinessTables = publicTableNames.filter((t: string) => !allowedTables.has(t));
          assert.equal(
            forbiddenBusinessTables.length,
            0,
            `Zero business domain tables allowed, found: ${forbiddenBusinessTables.join(', ')}`,
          );

          // Verify unique canonical phone constraint on users table
          await testClient.query(
            `INSERT INTO users (id, phone, status, created_at, updated_at)
             VALUES ('018f0000-0000-7000-8000-000000000001', '+6281234567890', 'ACTIVE', NOW(), NOW());`,
          );

          await assert.rejects(
            async () => {
              await testClient.query(
                `INSERT INTO users (id, phone, status, created_at, updated_at)
                 VALUES ('018f0000-0000-7000-8000-000000000002', '+6281234567890', 'ACTIVE', NOW(), NOW());`,
              );
            },
            (err: any) => {
              assert.equal(err.code, '23505', 'PostgreSQL must reject duplicate canonical phone with 23505 unique violation');
              return true;
            },
          );
        } finally {
          await testClient.end();
        }
      } finally {
        try {
          await adminClient.query(
            `SELECT pg_terminate_backend(pid)
             FROM pg_stat_activity
             WHERE datname = $1 AND pid <> pg_backend_pid();`,
            [testDbName],
          );
          await adminClient.query(`DROP DATABASE IF EXISTS "${testDbName}";`);
        } finally {
          await adminClient.end();
        }
      }
    });
  });

  describe('2. PostGIS Extension & Spatial Calculations', () => {
    test('confirms PostGIS extension is loaded and functional', async () => {
      const res = await pool.query('SELECT PostGIS_Version();');
      assert.ok(res.rows[0].postgis_version.includes('3.5'));
    });

    test('computes real geodesic distance and radius filtering in Manado', async () => {
      // Coordinates:
      // Point A (Mantos): Lat 1.4855, Lon 124.8384
      // Point B (Megamall): Lat 1.4880, Lon 124.8395 (~300m away)
      // Point C (Airport MDC): Lat 1.5498, Lon 124.9262 (~12.5km away)
      const query = `
        SELECT
          ST_Distance(
            ST_SetSRID(ST_MakePoint(124.8384, 1.4855), 4326)::geography,
            ST_SetSRID(ST_MakePoint(124.8395, 1.4880), 4326)::geography
          ) AS distance_ab_meters,
          ST_Distance(
            ST_SetSRID(ST_MakePoint(124.8384, 1.4855), 4326)::geography,
            ST_SetSRID(ST_MakePoint(124.9262, 1.5498), 4326)::geography
          ) AS distance_ac_meters,
          ST_DWithin(
            ST_SetSRID(ST_MakePoint(124.8384, 1.4855), 4326)::geography,
            ST_SetSRID(ST_MakePoint(124.8395, 1.4880), 4326)::geography,
            1000
          ) AS within_1km_b,
          ST_DWithin(
            ST_SetSRID(ST_MakePoint(124.8384, 1.4855), 4326)::geography,
            ST_SetSRID(ST_MakePoint(124.9262, 1.5498), 4326)::geography,
            1000
          ) AS within_1km_c;
      `;

      const res = await pool.query(query);
      const row = res.rows[0];

      const distAB = parseFloat(row.distance_ab_meters);
      const distAC = parseFloat(row.distance_ac_meters);

      // Distance between Mantos and Megamall is approx 300m
      assert.ok(distAB > 250 && distAB < 350, `Distance AB was ${distAB}, expected ~300m`);
      // Distance to airport is approx 12-13km
      assert.ok(distAC > 11000 && distAC < 14000, `Distance AC was ${distAC}, expected ~12.5km`);

      // Radius check: Point B is within 1km, Point C is NOT
      assert.equal(row.within_1km_b, true);
      assert.equal(row.within_1km_c, false);
    });
  });

  describe('3. Transaction Management (Commit & Rollback)', () => {
    test('persists data on transaction commit', async () => {
      const eventId = generateUuidV7();
      const aggregateId = generateUuidV7();
      assert.ok(isValidUuidV7(eventId));
      assert.ok(isValidUuidV7(aggregateId));

      await transactionService.runInTransaction(async (tx) => {
        await tx.insert(outboxEvents).values({
          id: eventId,
          aggregateType: 'test_aggregate',
          aggregateId,
          eventType: 'TEST_COMMITTED',
          payload: { status: 'committed', amount: 50000 },
          occurredAt: new Date(),
          availableAt: new Date(),
        });
      });

      // Verify read outside transaction
      const rows = await db
        .select()
        .from(outboxEvents)
        .where(eq(outboxEvents.id, eventId));

      assert.equal(rows.length, 1);
      assert.equal(rows[0]?.eventType, 'TEST_COMMITTED');

      // Cleanup
      await db.delete(outboxEvents).where(eq(outboxEvents.id, eventId));
    });

    test('reverts data on transaction rollback', async () => {
      const eventId = generateUuidV7();
      const aggregateId = generateUuidV7();

      const intentionalError = new Error('Intentional transaction abort');

      await assert.rejects(
        async () => {
          await transactionService.runInTransaction(async (tx) => {
            await tx.insert(outboxEvents).values({
              id: eventId,
              aggregateType: 'test_aggregate',
              aggregateId,
              eventType: 'TEST_ROLLED_BACK',
              payload: { status: 'should_not_exist' },
              occurredAt: new Date(),
              availableAt: new Date(),
            });

            throw intentionalError;
          });
        },
        (err: Error) => err.message === intentionalError.message,
      );

      // Verify event was NOT committed to the database
      const rows = await db
        .select()
        .from(outboxEvents)
        .where(eq(outboxEvents.id, eventId));

      assert.equal(rows.length, 0);
    });
  });

  describe('4. PostgreSQL-Backed Idempotency', () => {
    test('persists, updates, and retrieves an idempotency record', async () => {
      const key = `test-key-${generateUuidV7()}`;
      const fingerprint = 'sha256-abc-123';

      const claim = await idempotencyStore.claim(key, fingerprint, 'test-route');
      assert.equal(claim.status, 'claimed');

      await idempotencyStore.set(key, {
        fingerprint,
        statusCode: 201,
        responseBody: { message: 'created', id: 42 },
        createdAt: Date.now(),
      }, 'test-route');

      const retrieved = await idempotencyStore.get(key, 'test-route');
      assert.ok(retrieved);
      assert.equal(retrieved?.statusCode, 201);
      assert.deepEqual(retrieved?.responseBody, { message: 'created', id: 42 });

      // Cleanup
      await idempotencyStore.delete(key, 'test-route');
    });

    test('replays finished response when same key and same fingerprint are claimed', async () => {
      const key = `test-replay-${generateUuidV7()}`;
      const fingerprint = 'sha256-replay-fingerprint';

      await idempotencyStore.claim(key, fingerprint, 'test-route');
      await idempotencyStore.set(key, {
        fingerprint,
        statusCode: 200,
        responseBody: { status: 'success' },
        createdAt: Date.now(),
      }, 'test-route');

      const replayedClaim = await idempotencyStore.claim(key, fingerprint, 'test-route');
      assert.equal(replayedClaim.status, 'replayed');
      assert.equal(replayedClaim.record?.statusCode, 200);
      assert.deepEqual(replayedClaim.record?.responseBody, { status: 'success' });

      // Cleanup
      await idempotencyStore.delete(key, 'test-route');
    });

    test('detects conflict when same key has differing fingerprint', async () => {
      const key = `test-conflict-${generateUuidV7()}`;
      const fingerprint1 = 'sha256-fingerprint-payload-1';
      const fingerprint2 = 'sha256-fingerprint-payload-2';

      await idempotencyStore.claim(key, fingerprint1, 'test-route');
      await idempotencyStore.set(key, {
        fingerprint: fingerprint1,
        statusCode: 200,
        responseBody: { original: true },
        createdAt: Date.now(),
      }, 'test-route');

      // Attempt claim with different fingerprint
      const conflictClaim = await idempotencyStore.claim(key, fingerprint2, 'test-route');
      assert.equal(conflictClaim.status, 'conflict');

      // Cleanup
      await idempotencyStore.delete(key, 'test-route');
    });

    test('guarantees single-winner atomic execution under high concurrency', async () => {
      const concurrentKey = `concurrent-key-${generateUuidV7()}`;
      const fingerprint = 'sha256-concurrent-fingerprint';
      const concurrencyCount = 5;

      // Launch 5 simultaneous claims in parallel
      const claimPromises = Array.from({ length: concurrencyCount }, () =>
        idempotencyStore.claim(concurrentKey, fingerprint, 'concurrent-route'),
      );

      // Simulate the winner taking 50ms to finish
      setTimeout(async () => {
        await idempotencyStore.set(
          concurrentKey,
          {
            fingerprint,
            statusCode: 200,
            responseBody: { processed_by_winner: true },
            createdAt: Date.now(),
          },
          'concurrent-route',
        );
      }, 50);

      const results = await Promise.all(claimPromises);

      // Exactly ONE claim must be 'claimed'
      const claimedCount = results.filter((r) => r.status === 'claimed').length;
      assert.equal(claimedCount, 1, `Expected exactly 1 claimed, got ${claimedCount}`);

      // The remaining claims must resolve to 'replayed'
      const replayedCount = results.filter((r) => r.status === 'replayed').length;
      assert.equal(replayedCount, concurrencyCount - 1, `Expected ${concurrencyCount - 1} replayed`);

      // Verify that exactly ONE row exists in database
      const rows = await db
        .select()
        .from(idempotencyRecords)
        .where(eq(idempotencyRecords.idempotencyKey, concurrentKey));

      assert.equal(rows.length, 1);
      assert.equal(rows[0]?.responseStatus, 200);

      // Cleanup
      await idempotencyStore.delete(concurrentKey, 'concurrent-route');
    });
  });
});
