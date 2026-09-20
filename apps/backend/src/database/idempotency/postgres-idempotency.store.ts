import { Injectable, Inject } from '@nestjs/common';
import { eq, and } from 'drizzle-orm';
import type pg from 'pg';
import { PG_POOL_TOKEN, DRIZZLE_DB_TOKEN } from '../database.tokens.js';
import type { DrizzleDb } from '../transaction/transaction.service.js';
import { idempotencyRecords } from '../schema/idempotency.js';
import type {
  IdempotencyRecord,
  IdempotencyStore,
} from '../../common/idempotency/idempotency-store.interface.js';
import { generateUuidV7 } from '@platform/utils';

export interface ClaimResult {
  status: 'claimed' | 'replayed' | 'conflict';
  record?: IdempotencyRecord;
}

@Injectable()
export class PostgresIdempotencyStore implements IdempotencyStore {
  private readonly defaultTtlMs = 86400000; // 24 hours

  constructor(
    @Inject(PG_POOL_TOKEN)
    private readonly pool: pg.Pool,
    @Inject(DRIZZLE_DB_TOKEN)
    private readonly db: DrizzleDb,
  ) {}

  /**
   * Atomically claims an idempotency key or retrieves the existing record.
   * If claimed by another concurrent request that is still processing,
   * it waits until the winner finishes and replays the response.
   */
  async claim(
    key: string,
    fingerprint: string,
    scope = 'global',
    ttlMs = this.defaultTtlMs,
  ): Promise<ClaimResult> {
    const id = generateUuidV7();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + ttlMs);

    // Try to atomically claim the key via raw pg client for deterministic ON CONFLICT RETURNING behavior
    const insertResult = await this.pool.query(
      `INSERT INTO idempotency_records (id, idempotency_key, scope, request_fingerprint, response_status, created_at, expires_at)
       VALUES ($1, $2, $3, $4, NULL, $5, $6)
       ON CONFLICT (scope, idempotency_key) DO NOTHING
       RETURNING id;`,
      [id, key, scope, fingerprint, now, expiresAt],
    );

    if (insertResult.rowCount && insertResult.rowCount > 0) {
      // Successfully claimed the key as the winner
      return { status: 'claimed' };
    }

    // Key was already claimed; inspect existing record
    const existing = await this.findRecord(key, scope);
    if (!existing) {
      // Expired or deleted between conflict and read; retry claim
      return this.claim(key, fingerprint, scope, ttlMs);
    }

    if (existing.requestFingerprint !== fingerprint) {
      return { status: 'conflict' };
    }

    // Fingerprint matches. If winner already finished, return replayed record
    if (existing.responseStatus !== null && existing.responseStatus !== undefined) {
      return {
        status: 'replayed',
        record: {
          fingerprint: existing.requestFingerprint,
          statusCode: existing.responseStatus,
          responseBody: existing.responseBody,
          createdAt: existing.createdAt.getTime(),
        },
      };
    }

    // Winner is still processing in-flight. Wait for completion (up to 5 seconds)
    const maxWaitMs = 5000;
    const pollIntervalMs = 50;
    const startTime = Date.now();

    while (Date.now() - startTime < maxWaitMs) {
      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
      const updated = await this.findRecord(key, scope);
      if (!updated) {
        return this.claim(key, fingerprint, scope, ttlMs);
      }
      if (updated.requestFingerprint !== fingerprint) {
        return { status: 'conflict' };
      }
      if (updated.responseStatus !== null && updated.responseStatus !== undefined) {
        return {
          status: 'replayed',
          record: {
            fingerprint: updated.requestFingerprint,
            statusCode: updated.responseStatus,
            responseBody: updated.responseBody,
            createdAt: updated.createdAt.getTime(),
          },
        };
      }
    }

    // Timed out waiting for in-flight request
    return { status: 'conflict' };
  }

  /**
   * Updates a claimed idempotency record with the final response.
   */
  async set(
    key: string,
    record: IdempotencyRecord,
    scope = 'global',
    ttlMs = this.defaultTtlMs,
  ): Promise<void> {
    const expiresAt = new Date(Date.now() + ttlMs);

    const updateResult = await this.pool.query(
      `UPDATE idempotency_records
       SET response_status = $1, response_body = $2, expires_at = $3
       WHERE idempotency_key = $4 AND scope = $5;`,
      [record.statusCode, JSON.stringify(record.responseBody), expiresAt, key, scope],
    );

    // If record did not exist yet (e.g. set called directly without claim)
    if (updateResult.rowCount === 0) {
      const id = generateUuidV7();
      await this.pool.query(
        `INSERT INTO idempotency_records (id, idempotency_key, scope, request_fingerprint, response_status, response_body, created_at, expires_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW(), $7)
         ON CONFLICT (scope, idempotency_key)
         DO UPDATE SET response_status = EXCLUDED.response_status, response_body = EXCLUDED.response_body, expires_at = EXCLUDED.expires_at;`,
        [id, key, scope, record.fingerprint, record.statusCode, JSON.stringify(record.responseBody), expiresAt],
      );
    }
  }

  /**
   * Retrieves an idempotency record if not expired.
   */
  async get(key: string, scope = 'global'): Promise<IdempotencyRecord | undefined> {
    const record = await this.findRecord(key, scope);
    if (!record || record.responseStatus === null || record.responseStatus === undefined) {
      return undefined;
    }

    return {
      fingerprint: record.requestFingerprint,
      statusCode: record.responseStatus,
      responseBody: record.responseBody,
      createdAt: record.createdAt.getTime(),
    };
  }

  /**
   * Releases or deletes a claim if request processing fails with an unhandled exception.
   */
  async releaseClaim(key: string, scope = 'global'): Promise<void> {
    await this.pool.query(
      `DELETE FROM idempotency_records WHERE idempotency_key = $1 AND scope = $2 AND response_status IS NULL;`,
      [key, scope],
    );
  }

  /**
   * Deletes a record by key.
   */
  async delete(key: string, scope = 'global'): Promise<void> {
    await this.db
      .delete(idempotencyRecords)
      .where(and(eq(idempotencyRecords.idempotencyKey, key), eq(idempotencyRecords.scope, scope)));
  }

  private async findRecord(key: string, scope: string) {
    const rows = await this.db
      .select()
      .from(idempotencyRecords)
      .where(and(eq(idempotencyRecords.idempotencyKey, key), eq(idempotencyRecords.scope, scope)))
      .limit(1);

    const row = rows[0];
    if (!row) return undefined;

    // Check expiration
    if (row.expiresAt.getTime() < Date.now()) {
      await this.delete(key, scope);
      return undefined;
    }

    return row;
  }
}
