import { pgTable, uuid, varchar, jsonb, timestamp, integer, unique, index } from 'drizzle-orm/pg-core';

export const idempotencyRecords = pgTable(
  'idempotency_records',
  {
    id: uuid('id').primaryKey(),
    idempotencyKey: varchar('idempotency_key', { length: 255 }).notNull(),
    scope: varchar('scope', { length: 255 }).notNull(),
    requestFingerprint: varchar('request_fingerprint', { length: 64 }).notNull(),
    responseStatus: integer('response_status'),
    responseHeaders: jsonb('response_headers'),
    responseBody: jsonb('response_body'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'date' }).notNull(),
  },
  (table) => [
    unique('uq_idempotency_scope_key').on(table.scope, table.idempotencyKey),
    index('idx_idempotency_expires_at').on(table.expiresAt),
  ],
);

export type IdempotencyRecordEntity = typeof idempotencyRecords.$inferSelect;
export type NewIdempotencyRecordEntity = typeof idempotencyRecords.$inferInsert;
