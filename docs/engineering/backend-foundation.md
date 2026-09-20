# TorangGo Backend Foundation Architecture

## 1. Overview
The TorangGo backend foundation (`apps/backend`) provides an enterprise-grade, resilient runtime environment built on **NestJS 12** and **Node.js 24**, enforcing strict typing, security, error contracts, and observability.

This foundation strictly contains ZERO ORM entities, database migrations, or business domain logic (reserved for subsequent phases), serving purely as the application chassis.

---

## 2. Architecture & Bootstrap

The application uses an explicit factory pattern (`createApp()`) located in `src/bootstrap/create-app.ts` rather than monolithic bootstrapping:

- **Factory Pattern**: Separates application initialization from network binding, facilitating frictionless end-to-end testing with in-memory HTTP servers.
- **Graceful Shutdown**: `app.enableShutdownHooks()` ensures database and network connections drain on `SIGTERM` / `SIGINT`.
- **Global Routing Prefix**: Configurable via `API_PREFIX` (defaults to `api/v1`).
- **404 Handling**: Implemented via `AppModule.onApplicationBootstrap()`, ensuring unmapped routes are caught after controller resolution and return TorangGo's standard error contract.

---

## 3. Configuration & Validation

All configuration is strictly typed and validated at boot time via Zod (`src/config/env.schema.ts` and `src/config/app-config.ts`).

- **Fail-Fast**: If required environment variables are missing or invalid (e.g. invalid `PORT` or unrecognized `NODE_ENV`), the process exits immediately with descriptive errors.
- **Production Guardrails**: Wildcard CORS (`*`) is explicitly prohibited when `NODE_ENV=production`.
- **Supported Variables**:
  - `NODE_ENV`: `development` | `test` | `staging` | `production`
  - `PORT`: 1-65535 (default `4000`)
  - `HOST`: Bind host (default `0.0.0.0`)
  - `API_PREFIX`: Global route prefix (default `api/v1`)
  - `CORS_ORIGINS`: Comma-separated allowlist
  - `LOG_LEVEL`: `debug` | `info` | `warn` | `error` | `silent`
  - `API_DOCS_ENABLED`: Boolean flag to enable Swagger UI
  - `BODY_LIMIT`: Maximum payload size (default `1mb`)
  - `RATE_LIMIT_TTL`: Rate limit window in milliseconds (default `60000`)
  - `RATE_LIMIT_LIMIT`: Maximum requests per window (default `100`)

---

## 4. Request Correlation & Observability

### Request ID Middleware
- Extracts caller-supplied `X-Request-ID` or generates a standard UUID v4.
- Injects the ID into Express request objects (`req.id`) and response headers (`X-Request-ID`).
- Propagates throughout logging and exception handling.

### Structured JSON Logging & Sensitive Data Redaction
- Implemented in `src/common/logging/logger.service.ts` (`StructuredLogger`).
- Produces line-delimited JSON logs with timestamps, levels, context, message, and metadata.
- Automated redaction (`src/common/logging/log-redaction.ts`) masks sensitive HTTP headers (`authorization`, `cookie`, `set-cookie`) and body fields (`password`, `token`, `secret`, `credit_card`, etc.) to prevent secret leaks.

---

## 5. Standard Error Contract

All HTTP errors conform to TorangGo's unified error contract:

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable explanation",
    "details": {},
    "request_id": "7b8893d5-e5fc-4fa0-82a1-63806e23b207"
  }
}
```

### Error Codes
- `VALIDATION_ERROR`: Input payload failed schema validation (HTTP 400).
- `BAD_REQUEST`: Malformed request syntax or parameters (HTTP 400).
- `UNAUTHORIZED`: Missing or invalid authentication credentials (HTTP 401).
- `FORBIDDEN`: Insufficient permissions (HTTP 403).
- `NOT_FOUND`: Route or requested resource not found (HTTP 404).
- `CONFLICT`: Resource state conflict (HTTP 409).
- `IDEMPOTENCY_KEY_REUSED`: Replay attempted with different payload parameters (HTTP 409).
- `PAYLOAD_TOO_LARGE`: Request body exceeded configured limits (HTTP 413).
- `RATE_LIMITED`: Rate limit threshold exceeded (HTTP 429).
- `INTERNAL_ERROR`: Unexpected server error (HTTP 500, stack traces never leak to client).

### AppError Hierarchy
Defined in `src/common/errors/app-error.ts`, allowing domain services to throw typed exceptions that `GlobalExceptionFilter` serializes automatically without leaking internal structures.

---

## 6. Request Validation

Global input validation is configured in `src/common/pipes/validation.pipe.ts` using `class-validator` and `class-transformer`:
- `whitelist: true`: Strips undeclared properties.
- `forbidNonWhitelisted: true`: Immediately rejects payloads with unmapped fields.
- `transform: true`: Automatically coerces primitives to typed DTO classes.
- Formats validation errors into standard `VALIDATION_ERROR` responses with structured field maps.

---

## 7. Security & Rate Limiting

- **Helmet**: Applies standard security headers (`X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`, etc.).
- **CORS**: Enforces origin allowlists, methods, and exposed headers (`X-Request-ID`, `X-Idempotency-Replayed`).
- **Payload Limits**: Limits JSON and URL-encoded bodies via `express.json({ limit: config.bodyLimit })`.
- **Rate Limiting**: Configured globally with `@nestjs/throttler` (`ThrottlerGuard`), returning HTTP 429 `RATE_LIMITED` when exceeded. Individual endpoints can override limits using `@Throttle()`.

---

## 8. Idempotency Foundation

Critical mutation operations can be protected from duplicate execution:
- **Decorator**: `@Idempotent()` marks endpoints requiring idempotency protection.
- **Header**: Enforces `Idempotency-Key` on protected endpoints.
- **Fingerprinting**: Computes SHA-256 hash of `METHOD:PATH:JSON(body)`.
- **Replay**: If identical key and fingerprint are presented, returns the cached status and payload with `X-Idempotency-Replayed: true`.
- **Conflict**: If the same key is reused with a different payload, raises HTTP 409 `IDEMPOTENCY_KEY_REUSED`.
- **Storage**: Decoupled interface (`IdempotencyStore`). Uses `InMemoryIdempotencyStore` for Phase 1B testing/development; will swap to Redis in Phase 1C without modifying interceptor logic.

---

## 9. OpenAPI / Swagger Documentation

- **Interactive UI**: Hosted at `/api/docs` (JSON definition at `/api/docs-json`) when `API_DOCS_ENABLED=true`.
- **Static Export**: Generates `docs/api/openapi.json` without running an active network daemon:
  ```bash
  pnpm --filter backend openapi:export
  ```

---

## 10. Automated Testing

The native Node.js 24 test runner (`node:test`) is configured for rapid execution without Babel or Jest overhead:
- **Location**: `apps/backend/src/tests/foundation.spec.ts`
- **Execution**:
  ```bash
  pnpm --filter backend test
  ```
- **Coverage**:
  1. Health check (`/api/v1/health` -> 200)
  2. Request ID generation and client propagation
  3. Security headers (Helmet)
  4. 404 Route Not Found error contract
  5. AppError (401 Unauthorized) error contract
  6. 500 Unhandled error contract & secret hiding
  7. Global Validation Pipe (bad inputs & forbidden fields)
  8. Rate limiting (429 `RATE_LIMITED`)
  9. Idempotency execution, replay, and conflict rejection

