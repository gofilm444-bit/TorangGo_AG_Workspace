# TorangGo — Current Project Handoff

Current operational context after Phase 2B lock and prior to Phase 2C implementation. Updated 2026-09-24. Runtime statements below summarize previously completed verification; this documentation task does not repeat live login or infrastructure checks.

## Current Execution Status

- **Active Phase:** Phase 2 — Core Commerce & Delivery — **IN PROGRESS**.
- **Active MVP:** Local Commerce / Food + On-Demand Delivery. Courier and other verticals are future only.
- **Office Admin Security & Runtime Verification:** **COMPLETE / LOCKED**.
- **Last Completed Implementation Subphase:** Phase 2B — Merchant Onboarding — **COMPLETE / LOCKED**.
- **Phase 2A2 — Admin Verification Workflow:** **COMPLETE / LOCKED**.
- **Phase 2A1 — Admin Core Foundation & RBAC Bootstrap:** **COMPLETE / LOCKED**.
- **Office Admin Security & Runtime Verification:** **COMPLETE / LOCKED**.
- **Current Source-of-Truth Documentation Task:** Pre-Phase 2C Documentation Checkpoint — **IN PROGRESS** until external audit/checkpoint succeeds.
- **Next Planned Product Subphase:** Phase 2C — Merchant Business + Single Outlet Foundation.
- **Phase 2C Concept Anchor:** v1.0 **LOCKED**.
- **Phase 2C Implementation:** **NOT STARTED**.

## Repository and Functional Baseline

| Reference | Value |
| --- | --- |
| Active repository | `D:\app\TorangGo_AG_Workspace` |
| Official GitHub repository | https://github.com/gofilm444-bit/TorangGo_AG_Workspace.git |
| Branch | `main` |
| Current Git HEAD | `63a1565140a35c7b9cb1bc48d09f0c83cebeaea3` |
| Phase 2A1 checkpoint | `ebb3838888b11ede5a4a150d5a590bbabc05a26a` |
| Phase 2A2 checkpoint | `f54f20550a84d1ddced958f84a8b5be35eb5082e` |
| Phase 2B checkpoint | `63a1565140a35c7b9cb1bc48d09f0c83cebeaea3` |
| Phase 2B CI Verification | GitHub Actions Run #10 = SUCCESS |
| Historical merge/normalization commit | `6d5965601b910862913cdcd0d74982dd99fabcb7` |
| Historical/stale checkout | `D:\app\toranggo` |

Historical note: The earlier merge/history normalization (`6d5965601b910862913cdcd0d74982dd99fabcb7`) between the Phase 2A1 functional baseline (`ebb3838888b11ede5a4a150d5a590bbabc05a26a`) and the repository history did not change product implementation. Current Git HEAD is now the locked Phase 2B checkpoint (`63a1565140a35c7b9cb1bc48d09f0c83cebeaea3`).

Do not use the historical/stale checkout for active development or writes. Read-only historical inspection may be performed only when explicitly required. Do not operate on `integrate-master-from-main` during this task.

## Completed Phase 2 Foundations Summary

1. **Phase 2A1 — Admin Core Foundation & RBAC Bootstrap (LOCKED):** Established backend-authoritative administrative access, granular role/permission bootstrap, protected overview metrics, and Admin Web consumption of real backend data.
2. **Phase 2A2 — Admin Verification Workflow (LOCKED):** Delivered the verification control plane for Merchant and Driver profiles, enforcing canonical status transitions (`PENDING`, `APPROVED`, `REJECTED`, `SUSPENDED`), mandatory reason tracking, append-only audit trail logging (`profile_verification_audit_logs`), row-level concurrency protection, and terminal rejected state enforcement.
3. **Phase 2B — Merchant Onboarding (LOCKED):** Delivered the full partner onboarding lifecycle from TorangGo Mitra application through Admin verification, including autosave draft management, 5-step form wizard, private KTP document handling with magic byte sniffing, immutable submission snapshots, reject with explicit repair, revision #2 lifecycle, Stale Admin Review Guard (409 Conflict via `expectedSubmissionId`), and atomic approval.


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
These are standard local development configurations. No credential, enrollment secret, recovery code, session value, or encryption key is recorded here.

## Known Non-Blocking UI Drift

The static badge in `apps/admin-web/src/components/shell/Header.tsx` still displays "Admin Operator (Pra-Autentikasi / Fase 1G)". This is presentation text, not authorization state. Its cleanup remains **PARKED** for UI polish and is outside the documentation task.

## Documentation Checkpoint Boundary

Only `README.md`, `MASTER_CONTEXT.md`, `ROADMAP.md`, `DECISIONS.md`, and `HANDOFF.md` under `docs/product` are in scope. Application code, tests, schema, migrations, runtime configuration, app names/directories, and branch structure remain outside this task.

The agent must verify structure, consistency, sensitive-data exclusion, and Git scope, then provide a handoff for external audit. Do not stage, commit, push, reset, switch branches, restore files, or clean the working tree during this task.

## Next Action


1. External audit of the synchronized Source-of-Truth documentation.
2. Formal documentation checkpoint commit and push to remote `main`.
3. Verification of GitHub Actions CI run on remote checkpoint.
4. Formulation of the dedicated Phase 2C Implementation Master Prompt based on the locked Phase 2C Concept Anchor v1.0.
5. Phase 2C implementation execution under TG-DEC-030 governance.
6. Phase 2C implementation remains **NOT STARTED** until the dedicated implementation prompt is issued.
