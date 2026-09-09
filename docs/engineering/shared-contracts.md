# TorangGo — Shared Contracts Architecture

## 1. Overview & Source of Truth

The TorangGo monorepo enforces **one unified contract system** across the backend (`apps/backend`), mobile applications (`customer-mobile`, `merchant-mobile`, `driver-mobile`), and web administration (`admin-web`).

```
Backend NestJS DTO & Swagger Annotations
            ↓
    docs/api/openapi.json
            ↓
  openapi-typescript generator
            ↓
@platform/api-client (typed client & schemas)
            ↓
Mobile / Web Clients consume generated contracts
```

- **Single Source of Truth**: The backend HTTP implementation and its exported OpenAPI specification (`docs/api/openapi.json`) define the canonical API contract.
- **Zero Duplication**: Client applications do not manually duplicate DTOs or endpoints. They consume the typed schemas and client provided by `@platform/api-client`.
- **Zero Database Entity Leakage**: Drizzle persistence schemas (`outbox_events`, `idempotency_records`, etc.) are internal persistence models and must never be exposed as public API types.

---

## 2. HTTP vs. Internal TypeScript Naming Conventions

To ensure clean interoperability between public REST standards and idiomatic TypeScript:

| Layer | Convention | Examples |
| :--- | :--- | :--- |
| **Public HTTP JSON** | `snake_case` | `request_id`, `created_at`, `next_cursor`, `amount`, `currency` |
| **Internal TypeScript** | `camelCase` | `requestId`, `createdAt`, `nextCursor`, `amount`, `currency` |

Deterministic, recursive bidirectional mapping utilities (`snakeToCamel` and `camelToSnake`) are provided in `@platform/utils` to handle data crossing this boundary without boilerplate.

---

## 3. Platform Contract Primitives

Canonical primitives are defined in `@platform/shared-types` and validated at system boundaries via Zod schemas in `@platform/validation`:

### Money
- **Representation**: `{ amount: number, currency: 'IDR' }`
- **Rules**: Whole integer Indonesian Rupiah only. No decimal/fractional cents (sen). Values must be non-negative safe integers (`<= Number.MAX_SAFE_INTEGER`).
- **Database Mapping**: Stored as PostgreSQL `BIGINT`, mapped to JavaScript safe integer at the application layer.

### Timestamps
- **Representation**: `IsoUtcTimestamp` (e.g. `2026-09-09T03:00:00.000Z`).
- **Rules**: Must be ISO 8601 UTC strings terminating in `Z`. Database `Date` or `TIMESTAMPTZ` values are serialized to UTC strings before leaving the backend boundary.

### GeoPoint & Distance
- **GeoPoint**: `{ lat: number, lng: number }` (WGS84 / SRID 4326). Boundaries: `lat` [-90, 90], `lng` [-180, 180].
- **Distance**: `DistanceMeters` expressed strictly as integer meters (`>= 0`). UI kilometer formatting belongs to the display layer.

### Cursor Pagination
- **Envelope**:
  ```json
  {
    "data": [...],
    "meta": {
      "request_id": "...",
      "timestamp": "...",
      "pagination": {
        "next_cursor": "...",
        "has_more": true
      }
    }
  }
  ```
- **Rules**: Cursors are opaque strings to clients. No page-number assumptions.

### AppAudience
Identifies target client platform:
- `CUSTOMER_APP`
- `MERCHANT_APP`
- `DRIVER_APP`
- `ADMIN_WEB`

---

## 4. Error Contract

Preserves the standard TorangGo error contract from Phase 1B:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid payload provided",
    "details": [...],
    "request_id": "0191b7d5-0000-7000-8000-000000000001"
  }
}
```

### Foundation Error Codes
- `VALIDATION_ERROR` (400)
- `BAD_REQUEST` (400)
- `UNAUTHORIZED` (401)
- `FORBIDDEN` (403)
- `NOT_FOUND` (404)
- `CONFLICT` (409)
- `IDEMPOTENCY_KEY_REUSED` (409)
- `PAYLOAD_TOO_LARGE` (413)
- `RATE_LIMITED` (429)
- `INTERNAL_SERVER_ERROR` (500)

---

## 5. API Client & Portability

The platform client `@platform/api-client` wraps native `fetch`:
- **Portable**: Compatible with React Native / Expo, Next.js (Server & Client Components), and Node.js.
- **Request Correlation**: Automatically generates or propagates `X-Request-ID` headers.
- **Idempotency**: Supports caller-provided `Idempotency-Key` and inspects `X-Idempotency-Replayed`.
- **Typed Errors**: Automatically parses TorangGo error envelopes into instances of `ApiClientError`, exposing `code`, `message`, `details`, `requestId`, and HTTP `status`.
- **Zero Auth Drift**: No fake JWTs or session handlers in Phase 1D. Auth is deferred to Phase 1G.

---

## 6. Configuration & Boundary Safety

Client-safe configuration (`@platform/config/client-config.js`) enforces:
- Only public variables (`EXPO_PUBLIC_API_URL`, `NEXT_PUBLIC_API_URL`, `EXPO_PUBLIC_APP_ENV`, etc.) are consumed.
- Backend secrets (`DATABASE_URL`, `REDIS_URL`, encryption keys, SMS/payment secrets) are strictly isolated and never bundled or imported into client packages.

---

## 7. Contract Generation & Drift Detection

Commands available from repository root:

```bash
# Export OpenAPI specification and regenerate client contracts:
pnpm contract:generate

# Verify that committed contracts are synchronized with backend definitions:
pnpm contract:check
```

CI runs `pnpm contract:check` during quality gates to guarantee that no pull request introduces contract drift without updating generated artifacts.

