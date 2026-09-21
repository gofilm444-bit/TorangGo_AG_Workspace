# TorangGo — Master Context

This document records current product and engineering context. The precedence hierarchy is maintained in [README.md](README.md); locked decisions are maintained in [DECISIONS.md](DECISIONS.md).

## Product Vision and Active MVP

TorangGo is a local super-app/platform developed incrementally. Its strategy is to prove one complete operational vertical before expanding into additional services.

The current active MVP is **Local Commerce / Food + On-Demand Delivery**. It connects Customer discovery and checkout, Merchant preparation, Driver delivery, and ledger-backed financial attribution. These are the target end-to-end capabilities, not a claim that the full transaction loop is implemented.

Courier, Mart, Ride, Pharmacy Delivery, and Home / On-Demand Services are **FUTURE / NOT CURRENT MVP**. Dedicated Courier is distinct from delivery supporting current Food commerce.

## Four Application Containers

| Product container | Repository path | Responsibility |
| --- | --- | --- |
| TorangGo Customer | `apps/customer-mobile` | Customer authentication and, as roadmap phases deliver them, discovery, checkout, and order tracking. |
| TorangGo Mitra | `apps/merchant-mobile` | Partner application container; Merchant onboarding and commerce operations are its MVP capability. |
| TorangGo Driver | `apps/driver-mobile` | Dedicated Driver onboarding, availability, location, dispatch, and delivery experience as those phases are delivered. |
| TorangGo Admin | `apps/admin-web` | Administrative web control plane; core authentication/RBAC and overview foundation are complete, verification workflow is next. |

**ONE APP CONTAINER != ONE BACKEND DOMAIN.** TorangGo Mitra may later host other partner capabilities, but their backend domains must remain appropriately separated. Service Provider capability/domain is **PARKED**, not implemented or active.

The Mitra implementation path remains `apps/merchant-mobile`; no rename is part of this checkpoint. Driver remains separate because dispatch, availability, GPS/location, delivery execution, and realtime behavior require a distinct operational application.

## Backend Architecture

The current architecture is a **Modular Monolith** using one shared NestJS backend. Phase 2 remains within this architecture. Modules own their domain responsibilities and collaborate through explicit boundaries rather than separate backends per client.

Identity, commerce, delivery, administration, and finance retain distinct responsibilities. Roadmap domains are introduced in their assigned phases; naming a domain does not establish implementation completion.

Separate-service extraction is outside the current roadmap. A heavy domain could be extracted later only through explicit architecture review supported by demonstrated operational or technical need.

## Canonical Identity and Profile Provisioning

```text
USER
├── customer_profile
├── merchant_profile
└── driver_profile
```

The corresponding canonical profile collections are `customer_profiles`, `merchant_profiles`, and `driver_profiles`. Admin authentication/control-plane identity is separate from this tree.

Provisioning is intentionally asymmetric:

- A `customer_profile` MAY be created automatically after successful `CUSTOMER_APP` authentication when required by the active identity flow.
- A `merchant_profile` must not auto-create merely because authentication succeeds; Merchant capability requires onboarding.
- A `driver_profile` must not auto-create merely because authentication succeeds; Driver capability requires onboarding.

Merchant and Driver users may authenticate while not operationally approved to complete onboarding or view status. Only approved/eligible profiles may perform protected operational actions. Exact workflow states and authorization class names are not product invariants.

## Authorization and Admin Security

Authorization is **backend-authoritative**. Client navigation and UI visibility are usability features, not access-control boundaries. Mutable permissions, approval states, operational status, and business eligibility must not become durable authorization truth inside client tokens. Token/session implementation is not constrained to a permanently frozen JWT claim list.

Admin security requires username/email, password, MFA, revocable sessions/tokens, and granular backend permissions. The current authoritative permission catalog is:

- `admin:access`
- `admin:read`
- `admin:write`
- `admin:ops`

Backend checks determine effective access using authoritative account/session and permission data. Cookie implementation details and secret values do not belong in this product contract.

## Merchant, Business, and Outlet

The operational model is **USER → MERCHANT PROFILE → BUSINESS → OUTLET**. The User is the human identity; Merchant Profile represents partner capability; Business represents the commercial enterprise; Outlet represents the physical fulfillment location.

The MVP UX and operational assumption is **1 Merchant → 1 Business → 1 Outlet**. This does not establish a permanent User-to-Merchant cardinality or prohibit a Business from having multiple Outlets in future evolution. Multi-outlet management is outside current MVP execution.

Driver Profile and Vehicle are separate concepts; their onboarding belongs to Phase 2H.

## Order and Financial Principles

Order Core is the authoritative transactional lifecycle shared by the clients. The Food MVP stays concrete: discovery, cart/quote, order creation, Merchant handling, dispatch, pickup, and delivery. Exact order states belong to dedicated Phase 2G design.

Future transaction types must not be permanently forced to require Merchant semantics where inappropriate. This readiness does not justify a universal JSONB transaction model or implementation of inactive verticals.

Financial source-of-truth must be **ledger-backed**. Order totals, status fields, and mutable balance columns alone are insufficient. Merchant earnings, Driver earnings, and Platform revenue require traceable financial attribution.

Phase 2M will define the accounting model, posting rules, reconciliation, settlement, and payout mechanics. No particular accounting method, debit/credit schema, posting moment, settlement algorithm, or payout implementation is locked here.

## Geospatial and Location Foundation

PostgreSQL with PostGIS provides relational/geospatial persistence. Redis may support high-frequency/latest active Driver location where appropriate. Durable location persistence and any sampling/history policy belong to the dedicated location design; every live Driver update is not presumed to be written directly to PostGIS.

## Future-Readiness Boundaries

Keep explicit module boundaries and extension points that serve the active vertical. Do not introduce speculative schemas, APIs, placeholders, service launchers, universal booking engines, or universal dispatch/pricing abstractions for unstarted verticals.

Phase 2J dispatch is **FOOD_DELIVERY-first**; the exact algorithm is deferred. Phase 2L covers Payment without selecting permanent methods/providers here. Future Service Provider capabilities, Torang Jual/C2C, and multi-market/Kabupaten expansion remain parked. Prove one operational market first.

Future vertical order and phase numbering are not locked. Architecture review is required for material changes to locked decisions.

## Locked Technology Stack

The established stack remains the Phase 2 baseline. Manifest ranges below describe repository declarations, not claims about newly installed versions.

| Layer | Technology baseline |
| --- | --- |
| Runtime and workspace | Node.js 24.x; pnpm 11.22.0; Turborepo (`^2.4.4` root declaration). |
| Language | TypeScript; `~6.0.3` at root/mobile and `^5.8.2` in backend/Admin declarations. |
| Backend | NestJS (`^12.0.1`), Modular Monolith. |
| Persistence | PostgreSQL 17 with PostGIS 3.5; Drizzle ORM (`^0.45.2`) and pg (`^8.23.0`). |
| Cache/ephemeral data | Redis 7; ioredis (`^5.4.2`). |
| Admin Web | Next.js App Router (`^16.3.4`), React 19.2.3. |
| Mobile | Expo SDK 57, React Native 0.86.3, Expo Router 57, React 19.2.3. |
| Local infrastructure | Docker Compose. |
| Shared contracts | Shared TypeScript types, validation schemas, OpenAPI, and generated typed API client. |

## Engineering and Governance

Critical mutations require deliberate idempotency and consistency design, with verification appropriate to their phase. Shared contracts must stay aligned across backend and clients. Mobile functionality is implemented alongside its domain phase rather than deferred until all APIs exist.

Keep credentials out of documentation and source. Protect password/MFA material appropriately and restrict access to verification documents; document schemas and access implementation require dedicated design, not invention in this recovery task.

Follow the full governance workflow in TG-DEC-030. Agents implement and verify authorized scope, then provide a HANDOFF for external audit; they do not self-lock. This documentation task does not authorize staging, committing, pushing, or beginning the next implementation phase.

## Current Phase Status

| Milestone | Current status |
| --- | --- |
| Phase 0 — Product Definition / Specification History | Historical foundation |
| Phase 1 — Engineering Foundation (1A–1G) | COMPLETE / LOCKED |
| Post-Phase-1 Stabilization | COMPLETE / LOCKED |
| Phase 2 — Core Commerce & Delivery | IN PROGRESS |
| Phase 2A1 — Admin Core Foundation & RBAC Bootstrap | COMPLETE / LOCKED |
| Office Admin Security & Runtime Verification | COMPLETE / LOCKED |
| Phase 2A2 — Admin Verification Workflow | NEXT / NOT STARTED |

The Phase 2A1 functional checkpoint is `ebb3838888b11ede5a4a150d5a590bbabc05a26a`. Git history normalization did not introduce a new product phase. Current HEAD and next operational actions are recorded in [HANDOFF.md](HANDOFF.md).
