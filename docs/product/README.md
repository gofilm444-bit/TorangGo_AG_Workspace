# TorangGo — Product Documentation Index

TorangGo is a local super-app/platform developed incrementally. The current active MVP is **Local Commerce / Food + On-Demand Delivery**: prove one complete operational vertical in one market before expanding.

Courier, Mart, Ride, Pharmacy Delivery, and Home / On-Demand Services are **FUTURE / NOT CURRENT MVP**. Delivery supporting Food is in scope; dedicated Courier is a separate future vertical.

## Authoritative Documentation

| Document | Purpose |
| --- | --- |
| [MASTER_CONTEXT.md](MASTER_CONTEXT.md) | Product vision, architecture, identity, security, domain boundaries, and engineering principles. |
| [ROADMAP.md](ROADMAP.md) | Canonical phase ordering, scope boundaries, and mobile milestones. |
| [DECISIONS.md](DECISIONS.md) | Stable locked decision register: TG-DEC-001 through TG-DEC-041. |
| [HANDOFF.md](HANDOFF.md) | Current execution status, Git baseline, prior runtime verification, and next action. |

## Source-of-Truth Precedence

1. DECISIONS.md
2. MASTER_CONTEXT.md
3. ROADMAP.md
4. HANDOFF.md
5. Verified Repository Implementation
6. Historical Master Product Blueprint

The Historical Master Product Blueprint remains important historical context; it does not override current locked decisions. Resolve discrepancies explicitly through review rather than silently changing product truth.

## Current Checkpoint

Phase 2 — Core Commerce & Delivery is **IN PROGRESS**.
- Phase 2A1 — Admin Core Foundation & RBAC Bootstrap is **COMPLETE / LOCKED** (checkpoint `ebb3838888b11ede5a4a150d5a590bbabc05a26a`).
- Phase 2A2 — Admin Verification Workflow is **COMPLETE / LOCKED** (checkpoint `f54f20550a84d1ddced958f84a8b5be35eb5082e`).
- Phase 2B — Merchant Onboarding is **COMPLETE / LOCKED** (checkpoint `63a1565140a35c7b9cb1bc48d09f0c83cebeaea3`, CI Run #10 = SUCCESS).
- Phase 2C — Merchant Business + Single Outlet Foundation is **COMPLETE / LOCKED** (implementation checkpoint `50ec32fb716a14e74cfa54fa937c7f1a6df49f68`, follow-up whitespace checkpoint `5c14656bceb0955d431ffffba8a5607d496383d6`, CI Run #12 & #13 = SUCCESS per user anchor).
- Phase 2D — Catalog is **NEXT / NOT STARTED** (Scope: Food catalog, item information, pricing, availability, and Merchant catalog management; detailed concept/design not yet approved).

The current Post-Phase 2C documentation reconciliation task is **IN PROGRESS / AWAITING AUDIT** (not self-approved or self-locked). Current operational details and Git baseline are recorded in [HANDOFF.md](HANDOFF.md).
