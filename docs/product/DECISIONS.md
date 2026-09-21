# TorangGo — Locked Decisions Register

These 30 stable decision IDs record current product, architecture, and governance decisions. LOCKED decisions require explicit review to change. Existing decision status does not self-approve or lock this documentation rewrite, which remains subject to external audit.

## TG-DEC-001: Super-App Capability with Strict Single-Vertical MVP Scope

**Status:** LOCKED

**Decision:** TorangGo is a local super-app/platform developed incrementally. The active MVP is **Local Commerce / Food + On-Demand Delivery**. Courier is future only, alongside Mart, Ride, Pharmacy Delivery, and Home / On-Demand Services.

**Rationale / consequence:** Prove one complete operational vertical before expansion; future readiness does not authorize inactive service implementation.

## TG-DEC-002: Unified Modular Monolith Backend

**Status:** LOCKED

**Decision:** All four application containers use one shared NestJS Modular Monolith backend with explicit domain boundaries.

**Rationale / consequence:** Shared platform foundations support consistent transactions without creating a separate backend per client.

## TG-DEC-003: Single Unified Customer Application Container

**Status:** LOCKED

**Decision:** TorangGo Customer is the unified customer application container at `apps/customer-mobile`. Future prioritized consumer capabilities may be added within this container.

**Rationale / consequence:** The super-app product direction does not authorize current implementation of future verticals.

## TG-DEC-004: Unified Partner Mobile Container (TorangGo Mitra)

**Status:** LOCKED

**Decision:** TorangGo Mitra is the partner application container. Merchant capability serves the MVP; future Service Provider capability/domain is PARKED. The repository path remains `apps/merchant-mobile` and must not be renamed in this task.

**Rationale / consequence:** ONE APP CONTAINER != ONE BACKEND DOMAIN. Shared client distribution must preserve separate domain responsibilities.

## TG-DEC-005: Dedicated Driver Operational Mobile Application

**Status:** LOCKED

**Decision:** TorangGo Driver remains a separate application at `apps/driver-mobile`.

**Rationale / consequence:** Dispatch, availability, GPS/location, delivery execution, and realtime behavior have a distinct operational lifecycle.

## TG-DEC-006: Dedicated Web Control Plane for Administration

**Status:** LOCKED

**Decision:** TorangGo Admin is the dedicated Next.js web control plane at `apps/admin-web`.

**Rationale / consequence:** Administrative authentication, permissions, verification, and audit responsibilities remain separate from mobile client experiences.

## TG-DEC-007: Canonical User Identity with Distinct Role Profiles

**Status:** LOCKED

**Decision:** The canonical User model has `customer_profiles`, `merchant_profiles`, and `driver_profiles`. Admin authentication/control-plane identity is separate from that profile tree.

**Rationale / consequence:** Authentication identifies the user; domain capability and eligibility are evaluated independently.

## TG-DEC-008: Asymmetric Profile Provisioning Rules

**Status:** LOCKED

**Decision:** A `customer_profile` MAY auto-create after successful `CUSTOMER_APP` authentication when required by the active identity flow. Merchant and Driver profiles must not auto-create merely because authentication succeeds; they require onboarding.

**Rationale / consequence:** Low-friction customer access does not bypass partner onboarding.

## TG-DEC-009: Authentication Permitted for Non-Approved Profiles

**Status:** LOCKED

**Decision:** Non-approved Merchant/Driver users may authenticate for onboarding and status purposes. Only approved/eligible profiles may execute protected operational actions.

**Rationale / consequence:** Session validity is distinct from operational authorization. Exact workflow states and guard class names are not locked here.

## TG-DEC-010: Backend-Authoritative Authorization

**Status:** LOCKED

**Decision:** The backend authoritatively evaluates access. Mutable permissions, approval states, operational status, and business eligibility must not be treated as durable authorization truth inside client tokens.

**Rationale / consequence:** Frontend visibility is not an authorization boundary. No permanent exact JWT claim list is established.

## TG-DEC-011: Hardened Admin Authentication with Granular RBAC

**Status:** LOCKED

**Decision:** Admin access requires username/email, password, MFA, revocable sessions/tokens, and granular backend permissions. The current authoritative catalog is `admin:access`, `admin:read`, `admin:write`, and `admin:ops`.

**Rationale / consequence:** Administrative authority is verified on the backend. Cookie names/flags and credential or token values are not product locks.

## TG-DEC-012: Conceptual Separation of Merchant, Business, and Outlet

**Status:** LOCKED

**Decision:** The operational model is USER → MERCHANT PROFILE → BUSINESS → OUTLET. Merchant Profile is partner capability, Business is the commercial enterprise, and Outlet is the fulfillment location.

**Rationale / consequence:** Keep these concepts distinct so later evolution does not require treating them as one entity.

## TG-DEC-013: MVP Scope: One Merchant, One Business, One Outlet

**Status:** LOCKED

**Decision:** The MVP UX and operational assumption is **1 Merchant → 1 Business → 1 Outlet**.

**Rationale / consequence:** This is not a permanent User-to-Merchant 1:1 invariant or a permanent database prohibition on multiple Outlets per Business. Multi-outlet operations are outside the MVP.

## TG-DEC-014: Decoupling of Driver Identity from Vehicle Assets

**Status:** LOCKED

**Decision:** Driver Profile and Vehicle are distinct domain concepts, addressed together during Phase 2H onboarding.

**Rationale / consequence:** Personal eligibility and vehicle information can be evaluated without conflating the person and the asset.

## TG-DEC-015: Order as the Transactional Source of Truth

**Status:** LOCKED

**Decision:** Order Core owns the authoritative commerce transaction lifecycle. Customer, Mitra, and Driver clients do not own competing order lifecycles.

**Rationale / consequence:** Phase 2G defines concrete Food order behavior and exact states in dedicated design.

## TG-DEC-016: Ledger-Backed Financial Source of Truth

**Status:** LOCKED

**Decision:** Financial truth must be ledger-backed, with traceable attribution for Merchant earnings, Driver earnings, and Platform revenue. Order status or mutable balances alone are insufficient.

**Rationale / consequence:** Phase 2M defines accounting design, debit/credit schema if applicable, posting timing, settlement, reconciliation, and payout mechanics. No particular accounting method is committed here.

## TG-DEC-017: Modular Monolith Platform Architecture

**Status:** LOCKED

**Decision:** The current architecture is a Modular Monolith, and Phase 2 remains within it. The established NestJS, Next.js, and Expo / React Native stack remains the baseline.

**Rationale / consequence:** Separate-service extraction is outside the current roadmap. Future extraction of a heavy domain requires explicit architecture review if justified; it is not permanently forbidden.

## TG-DEC-018: PostgreSQL and PostGIS for Relational and Spatial Persistence

**Status:** LOCKED

**Decision:** PostgreSQL with PostGIS provides relational/geospatial persistence. Redis may support high-frequency/latest active Driver location where appropriate.

**Rationale / consequence:** Dedicated location design determines durable history and sampling; every live location update is not presumed to persist directly to PostGIS.

## TG-DEC-019: Prohibited Premature Multi-Vertical Artifacts

**Status:** LOCKED

**Decision:** Do not create schemas, APIs, or UI placeholders for unstarted Courier, Mart, Ride, Pharmacy Delivery, or Home / On-Demand Services during the active MVP work.

**Rationale / consequence:** Clean boundaries provide future readiness without speculative implementation.

## TG-DEC-020: Concrete Commerce Order Semantics

**Status:** LOCKED

**Decision:** Current Food Delivery remains concrete. Do not introduce a universal JSONB transaction model. Order Core must also avoid permanently requiring Merchant semantics for future transaction types where inappropriate.

**Rationale / consequence:** Use explicit Food commerce behavior now, with extension decisions made when another vertical becomes active.

## TG-DEC-021: Decoupling of Service Provider from Driver Entities

**Status:** LOCKED

**Decision:** Future Service Provider capability/domain is PARKED and must remain conceptually separate from Driver and Vehicle. It may later be hosted in TorangGo Mitra.

**Rationale / consequence:** A shared partner container does not imply a shared backend domain. No Service Provider schema or implementation is authorized now.

## TG-DEC-022: Vertical-Specific Pricing Strategies

**Status:** LOCKED

**Decision:** Phase 2F covers Cart + Food Delivery Pricing / Checkout Quote. Pricing is designed for the active vertical rather than a universal multi-service engine.

**Rationale / consequence:** Exact fees and formulas require phase-specific design; future services receive their own design when prioritized.

## TG-DEC-023: Food-Delivery First Dispatch

**Status:** LOCKED

**Decision:** Phase 2J is **FOOD_DELIVERY-first**.

**Rationale / consequence:** Prove dispatch against the current operational vertical. Exact dispatch and food-ready-time algorithms are not locked.

## TG-DEC-024: Multi-Market Regional Expansion is Parked

**Status:** LOCKED / PARKED

**Decision:** Multi-market / Kabupaten expansion is **PARKED**.

**Rationale / consequence:** Prove one operational market first before introducing regional expansion models.

## TG-DEC-025: Torang Jual (C2C Marketplace) is Parked

**Status:** LOCKED / PARKED

**Decision:** Torang Jual and C2C open marketplace functionality are **PARKED**.

**Rationale / consequence:** Consumer listings and their operational requirements are outside the active Food commerce/delivery MVP.

## TG-DEC-026: Admin Scope Prioritization Bound to Transactional MVP

**Status:** LOCKED

**Decision:** Admin work supports the transactional MVP roadmap and must not replace or indefinitely delay core commerce/delivery progression.

**Rationale / consequence:** Build necessary verification and control-plane capabilities while preserving progress toward the Customer → Merchant → Driver operational loop.

## TG-DEC-027: Integrated Mobile Development per Domain Phase

**Status:** LOCKED

**Decision:** Mobile functionality is delivered alongside its backend domain phase.

**Rationale / consequence:** TorangGo Mitra begins substantial real business functionality in 2B; TorangGo Customer begins substantial real commerce functionality in 2E; TorangGo Driver begins substantial operational functionality in 2H.

## TG-DEC-028: Historical Master Product Blueprint Precedence

**Status:** LOCKED

**Decision:** The Historical Master Product Blueprint is important foundational specification history, not authority over current locked decisions.

**Rationale / consequence:** Apply the single precedence hierarchy in README.md when historical and current requirements differ.

## TG-DEC-029: Designated Office Canonical Workspace

**Status:** LOCKED

**Decision:** The active repository is `D:\app\TorangGo_AG_Workspace`. The historical/stale checkout is `D:\app\toranggo` and must not be used for active development or writes.

**Rationale / consequence:** Read-only historical inspection is permitted only when explicitly required. Current work uses the active repository.

## TG-DEC-030: Phase-Gated Review and Governance Discipline

**Status:** LOCKED

**Decision:** Use exactly this governance workflow:

Master Prompt
→ Agent implementation
→ Agent verification
→ HANDOFF
→ ChatGPT audit
→ canonical/full audit
→ PASS / LOCK
→ Git checkpoint
→ push
→ CI verification
→ next phase

**Rationale / consequence:** Agents do not self-lock. This documentation task ends at verification and handoff; staging, committing, and pushing are not authorized. External audit/checkpoint must succeed before proceeding to the dedicated next-phase prompt.
