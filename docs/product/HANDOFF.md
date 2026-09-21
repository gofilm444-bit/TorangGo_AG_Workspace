# TorangGo — Current Project Handoff

Current operational context for the pre-2A2 documentation checkpoint. Updated 2026-09-21. Runtime statements below summarize previously completed verification; this documentation task does not repeat live login or infrastructure checks.

## Current Execution Status

- **Active Phase:** Phase 2 — Core Commerce & Delivery — **IN PROGRESS**.
- **Active MVP:** Local Commerce / Food + On-Demand Delivery. Courier and other verticals are future only.
- **Last Completed Implementation Subphase:** Phase 2A1 — Admin Core Foundation & RBAC Bootstrap — **COMPLETE / LOCKED**.
- **Office Admin Security & Runtime Verification:** **COMPLETE / LOCKED**.
- **Current Source-of-Truth Documentation Task:** Deterministic clean rewrite — **IN PROGRESS** until external audit/checkpoint succeeds.
- **Next Planned Product Subphase:** Phase 2A2 — Admin Verification Workflow — **NEXT / NOT STARTED**.

## Repository and Functional Baseline

| Reference | Value |
| --- | --- |
| Active repository | `D:\app\TorangGo_AG_Workspace` |
| Official GitHub repository | https://github.com/gofilm444-bit/TorangGo_AG_Workspace.git |
| Branch | `main` |
| Current Git HEAD after history normalization | `6d5965601b910862913cdcd0d74982dd99fabcb7` |
| Phase 2A1 functional baseline / checkpoint | `ebb3838888b11ede5a4a150d5a590bbabc05a26a` |
| Historical/stale checkout | `D:\app\toranggo` |

The merge/history normalization between the functional baseline and current HEAD did **not** change product implementation. A comparison of the two committed trees is empty. History normalization is not a new product phase.

Do not use the historical/stale checkout for active development or writes. Read-only historical inspection may be performed only when explicitly required. Do not operate on `integrate-master-from-main` during this task.

## Completed Admin Foundation

Phase 2A1 established backend-authoritative administrative access, granular role/permission bootstrap, protected overview data, and Admin Web consumption of real backend overview data. Administrative identity is separate from the canonical Customer/Merchant/Driver User profile tree.

Verification mutations for Merchant/Driver onboarding remain assigned to the next product subphase. This handoff does not define their states, endpoints, transitions, or document schemas.

## Prior Office Admin Runtime Verification

The accepted prior verification record reports:

- Admin account `junaedi` was `ACTIVE`, assigned `SUPER_ADMIN`, with `admin:access`, `admin:read`, `admin:write`, and `admin:ops`.
- MFA was enabled; rotated enrollment was previously verified through live login.
- `ADMIN_WEB` authenticated runtime and backend connectivity were verified.
- The Admin dashboard loaded real backend overview data.
- Temporary verification runtime was stopped safely.

These are prior verification results, not a claim that services are currently running. No credential, enrollment secret, recovery code, session value, or encryption key is recorded here.

## Office Development Infrastructure

| Service | Local target | Default port / configuration |
| --- | --- | --- |
| PostgreSQL + PostGIS | Host: `localhost`; database: `toranggo_dev` | `5433`; credentials supplied through local development environment/configuration. |
| Redis | `redis://localhost:6379` | `6379` |
| Backend | `http://localhost:4000` | `4000` |
| Admin Web | `http://localhost:3000` | `3000` |

Runtime verification previously used a temporary Admin Web port when the default was occupied. That temporary choice does not change the default configuration.

## Known Non-Blocking UI Drift

The static badge in `apps/admin-web/src/components/shell/Header.tsx` still displays "Admin Operator (Pra-Autentikasi / Fase 1G)". This is presentation text, not authorization state. Its cleanup remains **PARKED** for UI polish and is outside the documentation task.

## Documentation Checkpoint Boundary

Only README.md, MASTER_CONTEXT.md, ROADMAP.md, DECISIONS.md, and HANDOFF.md under `docs/product` are in scope. Application code, tests, schema, migrations, runtime configuration, app names/directories, and branch structure remain outside this task.

The agent must verify structure, consistency, sensitive-data exclusion, and Git scope, then provide a handoff for external audit. Do not stage, commit, push, reset, switch branches, restore files, or clean the working tree during this task.

## Next Action

Complete Source-of-Truth audit/checkpoint/push/CI, then prepare the dedicated Phase 2A2 Master Prompt.

The future authorized checkpoint follows TG-DEC-030 in DECISIONS.md. This instruction describes the next governance steps, not permission for this documentation task to execute them. The dedicated prompt must define Merchant/Driver review and controlled status changes with authorization/audit requirements before implementation begins.
