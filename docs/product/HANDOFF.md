# TorangGo — Current Project Handoff

Current operational context after Phase 2C lock and prior to Phase 2D design/implementation. Updated 2026-09-29.

## Current Execution Status

- **Active Phase:** Phase 2 — Core Commerce & Delivery — **IN PROGRESS**.
- **Active MVP:** Local Commerce / Food + On-Demand Delivery. Courier and other verticals are future only.
- **Phase 2A1 — Admin Core Foundation & RBAC Bootstrap:** **COMPLETE / LOCKED** (checkpoint `ebb3838888b11ede5a4a150d5a590bbabc05a26a`).
- **Office Admin Security & Runtime Verification:** **COMPLETE / LOCKED**.
- **Phase 2A2 — Admin Verification Workflow:** **COMPLETE / LOCKED** (checkpoint `f54f20550a84d1ddced958f84a8b5be35eb5082e`).
- **Phase 2B — Merchant Onboarding:** **COMPLETE / LOCKED** (checkpoint `63a1565140a35c7b9cb1bc48d09f0c83cebeaea3`, CI Run #10 = SUCCESS).
- **Phase 2C — Merchant Business + Single Outlet Foundation:** **COMPLETE / LOCKED** (implementation checkpoint `50ec32fb716a14e74cfa54fa937c7f1a6df49f68`, follow-up whitespace checkpoint `5c14656bceb0955d431ffffba8a5607d496383d6`, CI Run #12 & #13 = SUCCESS per user anchor).
- **Current Documentation Task:** Post-Phase 2C Documentation Reconciliation — **IN PROGRESS / AWAITING AUDIT** (this documentation task has not been self-approved, committed, or locked; awaiting external audit and its own checkpoint).
- **Next Planned Product Subphase:** Phase 2D — Catalog (Status: **NOT STARTED**; Scope: Food catalog, item information, pricing, availability, and Merchant catalog management; detailed concept/design not yet approved).

## Repository and Workspace Baseline

| Reference | Value |
| --- | --- |
| Official active repository / workspace | `D:\app\TorangGo_AG_Workspace` |
| Prohibited archived folder (DO NOT USE) | `D:\app\TorangGo_AG_Workspace_OFFICE_OLD_20260929` |
| Historical / stale checkout (DO NOT USE) | `D:\app\toranggo` |
| Official GitHub repository | https://github.com/gofilm444-bit/TorangGo_AG_Workspace.git |
| Branch | `main` |
| Current Git HEAD (verified locally) | `5c14656bceb0955d431ffffba8a5607d496383d6` |
| Phase 2A1 checkpoint | `ebb3838888b11ede5a4a150d5a590bbabc05a26a` |
| Phase 2A2 checkpoint | `f54f20550a84d1ddced958f84a8b5be35eb5082e` |
| Phase 2B checkpoint | `63a1565140a35c7b9cb1bc48d09f0c83cebeaea3` |
| Phase 2B CI Verification | GitHub Actions Run #10 = SUCCESS |
| Phase 2C implementation checkpoint | `50ec32fb716a14e74cfa54fa937c7f1a6df49f68` |
| Phase 2C follow-up whitespace checkpoint | `5c14656bceb0955d431ffffba8a5607d496383d6` |
| Phase 2C CI Verification | GitHub Actions Run #12 & #13 = SUCCESS (user anchor) |
| Historical merge/normalization commit | `6d5965601b910862913cdcd0d74982dd99fabcb7` |

**Workspace Boundaries:**
- The canonical active workspace for development and documentation is exclusively `D:\app\TorangGo_AG_Workspace`.
- `D:\app\TorangGo_AG_Workspace_OFFICE_OLD_20260929` is an archived snapshot and must **never** be used for work.
- `D:\app\toranggo` is a stale historical checkout and must **never** be used for active development or writes.

## Evidence Categorization

Evidence sources are explicitly segregated across locally verified findings, user-provided anchors, and unverified/open checks:

### 1. Locally Verified Evidence (by AG during this task)
- **Git State:** Branch is `main`, HEAD is `5c14656bceb0955d431ffffba8a5607d496383d6`, and precheck working tree was clean (`git status --short` empty).
- **Lineage Verification:** Git commit history confirms the ancestry path: `5c14656` (whitespace fix) → `50ec32f` (Phase 2C implementation) → `83da3b2` (pre-2C doc lock) → `63a1565` (Phase 2B) → `f54f205` (Phase 2A2) → `ebb3838` (Phase 2A1).
- **Scope Isolation:** Changes in this task are strictly confined to the 5 authorized files in `docs/product/`.

### 2. User-Provided Evidence (Master Context Anchor)
- **Phase 2C Status:** COMPLETE & LOCKED.
- **GitHub CI:** Run #12 and Run #13 reported as SUCCESS.
- **Monorepo Build:** Root build reported 11/11 tasks successful.
- **Backend Build:** Standalone backend build reported as PASS.
- **Mobile Build:** Mobile build scripts contain echo placeholders only; not accepted as proof of native mobile builds.
- **Office Database Audit:** PostgreSQL healthy, PostGIS extension active, 5 migration history entries recorded, and 4 Phase 2C tables exist with row count 0 (`businesses`, `outlets`, `outlet_operating_hours`, `merchant_business_setup_drafts`). Migrations were not executed during the reported audit/bootstrap (which does not indicate absence of Phase 2C tables, as they already exist).

### 3. Open Verifications / Unverified Items
- **CI Direct Verification:** AG has not directly verified GitHub Actions CI run logs on remote.
- **Migration Hash Equality:** Hash equality between source migration files (`0000_...` through `0004_...`) and the database migration history table has not yet been verified.
- **Office Test/Runtime Baseline:** Latest office test and runtime execution has not been proven by build alone; unit/integration test suites and live services were not executed during this documentation task.
- **Live Runtime State:** No services (PostgreSQL, Redis, Backend, Admin Web) are assumed to be currently running live.

## Separation of Build, Database, Test, and Runtime Status

- **Build Status:** Build succeeds at root monorepo (11/11 tasks) and backend standalone per user anchor. Mobile build scripts are echo placeholders only.
- **Database Status:** Office database contains PostgreSQL 17, PostGIS 3.5, 5 migration entries, and the four Phase 2C tables with 0 rows. Migration hash synchronization between source and database remains an open verification item.
- **Test Status:** The latest office test baseline has not been established by the evidence reviewed in this documentation task. Build PASS does not establish test-suite PASS. Phase 2C remains locked according to the accepted user anchor.
- **Runtime Status:** Prior admin login, MFA, and web control plane checks are historical verification records, not a live runtime assertion.

## Completed Phase 2 Foundations Summary

1. **Phase 2A1 — Admin Core Foundation & RBAC Bootstrap (LOCKED):** Established backend-authoritative administrative access, granular role/permission bootstrap, protected overview metrics, and Admin Web consumption of real backend data (`ebb3838`).
2. **Phase 2A2 — Admin Verification Workflow (LOCKED):** Delivered the verification control plane for Merchant and Driver profiles, enforcing canonical status transitions (`PENDING`, `APPROVED`, `REJECTED`, `SUSPENDED`), mandatory reason tracking, append-only audit trail logging (`profile_verification_audit_logs`), row-level concurrency protection, and terminal rejected state enforcement (`f54f205`).
3. **Phase 2B — Merchant Onboarding (LOCKED):** Delivered the full partner onboarding lifecycle from TorangGo Mitra application through Admin verification, including autosave draft management, 5-step form wizard, private KTP document handling with magic byte sniffing, immutable submission snapshots, reject with explicit repair, revision #2 lifecycle, Stale Admin Review Guard (409 Conflict via `expectedSubmissionId`), and atomic approval (`63a1565`, CI Run #10: SUCCESS).
4. **Phase 2C — Merchant Business + Single Outlet Foundation (LOCKED):** Delivered operational commercial Business and Primary Outlet setup for approved merchants: 4-step wizard with autosave/resume draft, atomic creation of Business, Primary Outlet, and Monday–Sunday operating hours, PostGIS `geography(Point, 4326)` geospatial location, IANA timezone assignment, post-setup operational mutability (without modifying 2B onboarding submissions), suspension data preservation, read-only Admin visibility, and strict scope firewall (`50ec32f`, `5c14656`, CI Run #12 & #13: SUCCESS per user anchor).

## Next Planned Subphase: Phase 2D — Catalog

- **Status:** **NOT STARTED**. Detailed concept and design have not been approved.
- **Scope Boundary:** Strictly confined to the ROADMAP specification: Food catalog, item information, pricing, availability, and Merchant catalog management.
- **Design Status:** Description/category fields, availability toggles, and other specific details await dedicated Phase 2D design and are not approved design decisions.
- **Strict Prohibitions:** Do NOT invent schema, endpoints, stock models, variants, add-ons/modifier groups, image upload policies, cart/order integration, or any other unapproved features prior to formal design review and approval.

## Office Development Infrastructure

| Service | Local target | Default port / configuration |
| --- | --- | --- |
| PostgreSQL + PostGIS | Host: `localhost`; database: `toranggo_dev` | `5433`; credentials supplied through local development environment/configuration. |
| Redis | `redis://localhost:6379` | `6379` |
| Backend | `http://localhost:4000` | `4000` |
| Admin Web | `http://localhost:3000` | `3000` |

*Note: Infrastructure settings represent default configurations. Prior live verifications were executed historically; no services are assumed live during this documentation task.*

## Known Non-Blocking UI Drift

The static badge in `apps/admin-web/src/components/shell/Header.tsx` still displays "Admin Operator (Pra-Autentikasi / Fase 1G)". This is presentation text, not authorization state. Its cleanup remains **PARKED** for UI polish and is outside the documentation task.

## Documentation Reconciliation Boundary

Only `README.md`, `MASTER_CONTEXT.md`, `ROADMAP.md`, `DECISIONS.md`, and `HANDOFF.md` under `docs/product` are in scope. Application code, tests, schema, migrations, runtime configuration, app names/directories, and branch structure remain completely untouched.

The agent does not self-approve, self-lock, stage, commit, push, reset, switch branches, restore files, or clean the working tree.

## Next Action

1. External documentation audit (ChatGPT Audit and Canonical / Full Audit) → PASS.
2. Explicit authorization → documentation checkpoint commit and push to remote main.
3. Verify GitHub CI success for the exact pushed checkpoint SHA.
4. Mark this documentation checkpoint COMPLETE & LOCKED only then.
5. Complete remaining office configuration/migration alignment (verifying source migration files against database migration history hash) and test/runtime baseline checks before Phase 2D implementation.
6. Prepare and approve Phase 2D (Catalog) concept and design specification before issuing its implementation master prompt. Phase 2D implementation execution remains **NOT STARTED** until authorized.
