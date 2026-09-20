# Architecture Documentation

## Monorepo Layout
- `apps/`: Customer Mobile, Merchant Mobile, Driver Mobile, Admin Web, Backend API.
- `packages/`: Reusable packages under `@platform/*` namespace.
- `infrastructure/`: Local Docker development infrastructure.

## Isolation Principles
- Shared packages must NOT import from application workspaces.
- Neutral `@platform` namespace protects against rebranding friction.
- No business logic or ORM in Phase 1A foundation.
