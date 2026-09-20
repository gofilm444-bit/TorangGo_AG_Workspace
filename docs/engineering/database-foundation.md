# TorangGo — Database Foundation & Persistence

## 1. Overview & Stack Rationale

TorangGo uses **PostgreSQL 17** with **PostGIS 3.5**, accessed via **node-postgres (`pg`)** connection pooling and typed through **Drizzle ORM**.

### Why Drizzle ORM + `pg`?
- **Zero Runtime Bloat**: Generates pure, predictable SQL queries without heavyweight active-record metadata or hidden runtime overhead.
- **SQL-First Type Safety**: Full TypeScript inference matching PostgreSQL types (TIMESTAMPTZ, JSONB, UUID) directly.
- **Production Migration Integrity**: Separates schema definition (`drizzle-kit generate`) from execution (`db:migrate`), ensuring zero auto-generated or uncontrolled DDL operations in production.
- **Connection Management**: Backed by battle-tested `pg.Pool` for robust connection pooling, automatic failover, and predictable connection lifecycle.

---

## 2. Database Naming & Type Conventions

| Aspect | Convention | Example | Rationale |
|---|---|---|---|
| **SQL Identifiers** | `snake_case` | `idempotency_records`, `occurred_at` | Standard PostgreSQL convention |
| **TypeScript Properties** | `camelCase` | `idempotencyKey`, `occurredAt` | Standard TypeScript/JavaScript convention |
| **Primary Keys** | RFC 9562 `UUIDv7` | `01934e8f-7c1a-7b2a-8b01-2e1c9d4e5f6a` | Time-sortable, distributed, non-enumerable |
| **Timestamps** | `TIMESTAMPTZ` | `2026-09-09T12:00:00.000Z` | Standardized UTC storage, timezone-aware |
| **Monetary Values** | `BIGINT` | `50000` (Rp 50.000) | Whole Indonesian Rupiah integer; zero floating-point error |
| **Spatial Columns** | PostGIS `geography` (SRID 4326) | `ST_SetSRID(ST_MakePoint(lon, lat), 4326)::geography` | Real ellipsoidal geodesic calculations |
| **Categorical / States** | `VARCHAR` + CHECK constraints | `varchar(100)` | Evolvable without heavy Postgres enum type migrations |

---

## 3. PostGIS Spatial Conventions

- **Default SRID**: `4326` (WGS 84 GPS coordinate system).
- **Coordinate Order**: PostGIS functions use `(longitude, latitude)`, not `(latitude, longitude)`.
- **Geodesic Distance**: Use `ST_Distance(geom1::geography, geom2::geography)` for ellipsoidal distance in meters.
- **Radius Filtering**: Use `ST_DWithin(geom1::geography, geom2::geography, radius_in_meters)`.
- **Indexing**: Use PostGIS GIST indexes (`CREATE INDEX ... USING gist(...)`) on spatial columns once domain tables arrive.

---

## 4. Transaction Management & Concurrency Rules

### Critical Rule: No External Network Calls in Transactions
> [!CAUTION]
> **NEVER execute external network requests (HTTP calls, payment gateway APIs, notification triggers) inside a database transaction.**
>
> Transactions hold row and table locks. Network latency or timeouts will block database connection pools and exhaust Postgres connections.

### Transaction Helper Usage
```typescript
await transactionService.runInTransaction(async (tx) => {
  // Database operations only
  await tx.insert(outboxEvents).values({ ... });
});
```

### Approved Concurrency Patterns
1. **Single-Winner Idempotency**: `INSERT ... ON CONFLICT (scope, idempotency_key) DO NOTHING RETURNING id`.
2. **Pessimistic Locking**: `SELECT ... FOR UPDATE` for strict state transition locks.
3. **Queue Processing**: `SELECT ... FOR UPDATE SKIP LOCKED` for outbox event publishers and background workers.
4. **Optimistic Guarding**: `UPDATE ... WHERE id = $1 AND version = $2 RETURNING *`.

---

## 5. Foundation Tables

### `outbox_events`
Transactional outbox table designed for reliable at-least-once event delivery:
- `id`: UUIDv7 primary key
- `aggregate_type`: Category of the aggregate (e.g. `order`, `driver`)
- `aggregate_id`: ID of the entity
- `event_type`: Event identifier
- `payload`: JSONB event body
- `occurred_at`: Event occurrence time
- `available_at`: Earliest dispatch time
- `published_at`: Completion timestamp (`NULL` if pending)
- `attempts`: Processing retry count
- `last_error`: Trace of last failure

### `idempotency_records`
Durable idempotency table guaranteeing single-winner execution and deterministic replay:
- `id`: UUIDv7 primary key
- `idempotency_key`: Client-supplied unique key
- `scope`: Endpoint or operation route
- `request_fingerprint`: SHA-256 hash of canonicalized JSON request payload
- `response_status`: Cached HTTP status code (`NULL` while in-flight)
- `response_headers`: Cached response headers
- `response_body`: Cached JSON response body
- `created_at`: Creation timestamp
- `expires_at`: 24-hour expiration threshold

---

## 6. Migration Workflow & Production Safety

### Development Workflow
```bash
# 1. Update or define schemas in apps/backend/src/database/schema/
# 2. Generate versioned SQL migration
pnpm --filter backend db:generate

# 3. Review the generated SQL file in apps/backend/src/database/migrations/
# 4. Apply migration to local PostgreSQL
pnpm --filter backend db:migrate
```

### Production Safety Policy
- **NO `drizzle-kit push` in production**: Only versioned migration scripts (`db:migrate`) may run against non-development environments.
- **Backward Compatibility**: Migrations must be non-destructive and safe for zero-downtime deployments.

---

## 7. Running Integration Tests

Integration tests connect to real PostgreSQL (`toranggo-postgres`) and verify live PostGIS distance, transaction atomicity, and multi-threaded idempotency concurrency:

```bash
# Run backend tests (includes foundation + database integration tests)
pnpm --filter backend test

# Run monorepo test suite
pnpm test
```
