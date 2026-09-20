# TorangGo — Engineering Monorepo

> **Working Brand Status**: TorangGo is a provisional working brand. The brand may change in the future. All internal shared packages use neutral technical namespaces (`@platform/*`) to prevent tight coupling to the provisional brand identity.

## Overview

TorangGo is being developed as a modern local commerce and on-demand delivery platform.

**Current Active Product Direction:**
- Local Commerce / Food Delivery
- On-Demand Delivery
- Single-outlet merchant model (no multi-outlet or franchise complexity in early phases)

**Current Phase:**
- **Phase 1A — Project & Monorepo Foundation**
- *Important*: No business logic, authentication, database schemas, ORMs, or later-phase features are implemented in this phase.

---

## Monorepo Architecture

The monorepo uses **pnpm workspaces** and **Turborepo** to orchestrate five independent applications and five shared packages.

### Applications (`apps/`)

1. **`backend`**: NestJS + TypeScript API service (Port `4000`, prefix `/api/v1`).
2. **`admin-web`**: Next.js App Router web management portal (Port `3000`).
3. **`customer-mobile`**: Expo + React Native + Expo Router consumer application.
4. **`merchant-mobile`**: Expo + React Native + Expo Router merchant application.
5. **`driver-mobile`**: Expo + React Native + Expo Router driver partner application.

*Note on Mobile Apps*: Customer, Merchant, and Driver are three distinct applications with independent lifecycles, permissions, and configurations.

### Shared Packages (`packages/`)

- **`@platform/shared-types`**: Core shared interfaces and contract types (e.g. `ApiHealthStatus`).
- **`@platform/validation`**: Foundation validation schemas (powered by Zod).
- **`@platform/api-client`**: Strongly-typed API client for cross-application communication.
- **`@platform/config`**: Neutral configuration constants, ports, and API paths (strictly no secrets).
- **`@platform/utils`**: Reusable general-purpose utilities.

### Infrastructure (`infrastructure/`)

- **`infrastructure/docker/`**: Docker Compose configurations for local development services (PostgreSQL 17 and Redis 7).
- **`infrastructure/scripts/`**: Development and operational maintenance scripts.

---

## Prerequisites

- **Node.js**: `24.x` LTS (managed via `.nvmrc` or `fnm`)
- **pnpm**: `11.x` (or `9.x+` with Corepack / pinned packageManager)
- **Docker Desktop**: For PostgreSQL and Redis containers
- **Git**

---

## Local Port Allocation

| Service | Port | Description |
| :--- | :--- | :--- |
| **Admin Web** | `3000` | Next.js App Router |
| **Backend API** | `4000` | NestJS REST API (`/api/v1`) |
| **PostgreSQL** | `5432` | Local development database (`toranggo_dev`) |
| **Redis** | `6379` | Local cache / pub-sub |

---

## Getting Started

### 1. Environment Configuration

Copy the sample environment file:
```bash
cp .env.example .env
```

### 2. Dependency Installation

Install all workspace dependencies using `pnpm`:
```bash
pnpm install
```

### 3. Local Infrastructure

Start the PostgreSQL and Redis containers:
```bash
pnpm docker:up
# Or directly via docker compose:
docker compose -f infrastructure/docker/docker-compose.yml up -d
```

### 4. Development Commands

Run all services concurrently:
```bash
pnpm dev
```

Or target specific applications via workspace filters:
```bash
# Run backend API (http://localhost:4000/api/v1/health)
pnpm --filter backend dev

# Run Admin Web (http://localhost:3000)
pnpm --filter admin-web dev

# Run Mobile Apps
pnpm --filter customer-mobile dev
pnpm --filter merchant-mobile dev
pnpm --filter driver-mobile dev
```

---

## Quality Checks & Testing

Turborepo handles caching and dependency ordering across packages:

```bash
# Build all packages and applications
pnpm build

# Typecheck the entire repository
pnpm typecheck

# Lint all workspaces
pnpm lint

# Run automated tests
pnpm test
```

---

## CI / CD

A GitHub Actions workflow is located at `.github/workflows/ci.yml`. It runs on every `push` to `main` and all `pull_request` events, validating dependency installation (`--frozen-lockfile`), linting, typechecking, tests, and builds.
