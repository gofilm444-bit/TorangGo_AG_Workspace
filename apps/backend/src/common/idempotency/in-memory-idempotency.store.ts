import { Injectable } from '@nestjs/common';
import type { IdempotencyRecord, IdempotencyStore } from './idempotency-store.interface.js';

/**
 * InMemoryIdempotencyStore
 *
 * NOTE: This is process-local and non-durable, created strictly as a Phase 1B
 * development and testing foundation. It does NOT provide multi-instance or production
 * durability guarantees.
 *
 * In Phase 1C, this will be replaced with canonical PostgreSQL persistence.
 */
@Injectable()
export class InMemoryIdempotencyStore implements IdempotencyStore {
  private readonly store = new Map<string, IdempotencyRecord>();
  private readonly ttlMs = 86400000; // 24 hours default

  constructor() {}

  get(key: string): IdempotencyRecord | undefined {
    const record = this.store.get(key);
    if (!record) return undefined;

    if (Date.now() - record.createdAt > this.ttlMs) {
      this.store.delete(key);
      return undefined;
    }

    return record;
  }

  set(key: string, record: IdempotencyRecord): void {
    this.store.set(key, record);
  }

  delete(key: string): void {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }
}