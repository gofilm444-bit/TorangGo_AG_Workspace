# Admin Web Shell Foundation (Phase 1F)

## 1. Purpose of Admin Web

TorangGo Admin Web is a dedicated operational web client tailored for platform administrators, operators, verification teams, finance reconcilers, and customer support specialists. It serves as the single administrative pane of glass for governing the TorangGo ecosystem across North Sulawesi.

Admin Web is structurally decoupled from end-user clients. It is NOT:
- Customer Web
- Merchant Web
- Driver Web
- A dynamic `APP_MODE`-switched client
- A client-authoritative system

It operates as an independent operational application with its own layout, lifecycle, routing boundaries, and configuration.

---

## 2. Architecture

Admin Web is constructed using **Next.js 16.3.4** App Router, React 19, TypeScript, and platform workspace packages:
- `@platform/config`: Client-safe runtime environment configuration
- `@platform/api-client`: Shared HTTP client with automatic correlation ID propagation (`X-Request-ID`), idempotency, and timeout controls
- `@platform/shared-types`: Canonical domain types, primitives (`AppAudience`, `Money`), and wire formats
- `@platform/utils`: Shared utilities

### Independent Client Boundaries

The TorangGo platform topology enforces strict physical separation across 4 distinct frontend applications:
1. **Customer Mobile** (`apps/customer-mobile`) — Customer order & discovery shell
2. **Merchant Mobile** (`apps/merchant-mobile`) — Store operations & order acceptance shell
3. **Driver Mobile** (`apps/driver-mobile`) — Delivery partner navigation & earnings shell
4. **Admin Web** (`apps/admin-web`) — Central operational administration shell

Mobile applications remain untouched during Phase 1F. Shared foundations are consumed via pnpm monorepo workspace packages.

---

## 3. Route Structure

Admin Web adopts Next.js App Router route groups to cleanly establish structural boundaries:

```
apps/admin-web/src/app/
├── layout.tsx                     # Global HTML/head wrapper with globals.css
├── page.tsx                       # Root entrypoint redirecting to /dashboard
├── globals.css                    # Restrained, accessible admin design system styles
├── (public)/
│   └── login/
│       └── page.tsx               # Public boundary: login placeholder (Phase 1G ready)
└── (admin)/
    ├── layout.tsx                 # Wraps all admin routes with AdminShell
    ├── dashboard/
    │   └── page.tsx               # Operational shell dashboard
    ├── verifikasi/
    │   └── page.tsx               # Partner KYC & document verification placeholder
    ├── operasional/
    │   └── page.tsx               # Live platform operations & catalog placeholder
    ├── keuangan/
    │   └── page.tsx               # Finance, ledger, & reconciliation placeholder
    ├── dukungan/
    │   └── page.tsx               # Helpdesk & complaint resolution placeholder
    └── pengaturan/
        └── page.tsx               # Runtime configuration & security boundaries
```

Route groups `(public)` and `(admin)` keep URL paths clean (e.g. `/dashboard`, `/login`) while enforcing distinct structural layouts and establishing future middleware/auth boundaries.

---

## 4. Admin Shell Layout & Responsiveness

The administrative shell provides a desktop-first, highly legible operational layout:

1. **Responsive Sidebar**:
   - Desktop (&gt;1024px): Persistent 260px sidebar navigation with branding and operational metadata.
   - Mobile / Tablet (&le;1024px): Accessible slide-out navigation drawer with modal backdrop.
2. **Top Header**:
   - Environment indicator badge (`development`, `staging`, `production`).
   - Mobile navigation toggle with semantic ARIA controls (`aria-label`, `aria-expanded`).
   - Unauthenticated operator slot (clearly signaling pre-authenticated state).
3. **Main Content Workspace**:
   - Semantic `<main role="main">` with max-width container (`1400px`).
   - Accessible skip-to-content link (`.skip-link`) for keyboard navigation.
   - Fluid responsiveness preventing horizontal overflow or broken data grids.

---

## 5. Navigation Structure

The canonical navigation registry (`src/components/shell/navigation.ts`) defines the 6 required destinations:

| Destination | Path | Purpose / Shell Scope | Placeholder Status |
| :--- | :--- | :--- | :--- |
| **Dashboard** | `/dashboard` | Operational overview & platform health cards | Shell foundation ready |
| **Verifikasi** | `/verifikasi` | Merchant, driver, and document KYC evaluation | Modul belum diaktifkan |
| **Operasional**| `/operasional`| Dispatch tracking, order status, catalog ops | Fitur operasional akan tersedia pada fase berikutnya |
| **Keuangan**   | `/keuangan`   | Reconciliation, escrow, payout, and ledger | Data belum tersedia |
| **Dukungan**   | `/dukungan`   | Ticket escalation, dispute handling, support | Menunggu integrasi fase berikutnya |
| **Pengaturan** | `/pengaturan` | Environment settings, audit policies, security | Shell foundation ready |

Active routes are tracked and highlighted via `usePathname()`. All destinations use honest placeholder states without mock or fabricated operational data.

---

## 6. Configuration Model

Admin Web configuration is resolved strictly through `@platform/config` via `resolveClientConfig`:

```typescript
import { resolveClientConfig, type ClientAppConfig } from '@platform/config';

export const adminConfig: ClientAppConfig = resolveClientConfig({
  audience: 'ADMIN_WEB',
});
```

### Client-Safe Guarantees
- **No Secret Leaks**: Database connection strings (`DATABASE_URL`), Redis credentials, JWT signing secrets, service passwords, or encryption keys are NEVER exposed to browser bundles.
- **No Hardcoded URLs**: API base URLs resolve from environment variables (`NEXT_PUBLIC_API_URL`, `API_BASE_URL`) or safe local development defaults (`http://localhost:3000` / `http://localhost:4000`), never hardcoded production or internal IP addresses.
- **Environment Awareness**: Detects `development`, `staging`, `production`, and `test` environments without introducing client secrets.

---

## 7. `@platform/api-client` Usage

Admin Web initializes the shared platform API client via `@platform/api-client`:

```typescript
import { createApiClient, type ApiClient } from '@platform/api-client';
import { adminConfig } from './config';

export const adminApiClient: ApiClient = createApiClient({
  baseUrl: adminConfig.apiBaseUrl,
});
```

This client guarantees:
- Automated RFC 9562 UUIDv7 `X-Request-ID` generation and correlation propagation.
- Canonical JSON key transformation (`snake_case` on the wire, `camelCase` internally).
- Standardized `ApiClientError` parsing with status code and error code categorization.
- Standard request timeouts and abort signal handling.

---

## 8. `ADMIN_WEB` Audience

The platform contract defines `AppAudience` in `@platform/shared-types`:
```typescript
export type AppAudience =
  | 'CUSTOMER_APP'
  | 'MERCHANT_APP'
  | 'DRIVER_APP'
  | 'ADMIN_WEB';
```

Admin Web explicitly configures its audience as `ADMIN_WEB`. No secondary enum or duplicate audience definition exists; the shared contract is strictly authoritative.

---

## 9. Auth Readiness

> [!IMPORTANT]
> **Phase 1F does NOT implement authentication.**

Phase 1F explicitly excludes:
- Admin login and logout handlers
- Username / password forms or credential submission
- OTP or Multi-Factor Authentication (MFA)
- Session cookies, JWTs, or localStorage token persistence
- Fake or mocked logged-in admin state
- Client-side auth bypasses

### Preparation for Phase 1G
- Route group separation between `(public)` and `(admin)` is structurally in place.
- The top header reserves a dedicated slot for authenticated operator identity.
- `adminApiClient` provides an architectural insertion point for auth token injection or credentials handling.
- When Phase 1G arrives, server-side session checks, authentication middleware, and backend login endpoints will plug directly into these established boundaries without layout refactoring.

---

## 10. Security Boundaries

The Admin Web shell adheres to foundational security tenets:
1. **Browser Code Is Untrusted**: The client application is entirely untrusted. Client-side navigation visibility or route grouping is purely for user experience (UX) and ergonomics, never an authorization boundary.
2. **Backend-Enforced Authorization**: All operational endpoints, mutations, and queries must be defended by backend guards, session validation, and database-backed Role-Based Access Control (RBAC).
3. **No Secret Ingestion**: Environment variables prefixed with `NEXT_PUBLIC_` must only contain non-sensitive values (such as API base URLs).
4. **Auditability**: Sensitive operational access and mutations will log immutable audit records on the backend with correlated `X-Request-ID` tracing.

---

## 11. Placeholder & Data Policy

To protect operational integrity, Phase 1F enforces a strict zero-fabrication policy:
- **NO Fabricated Metrics**: No fake Gross Merchandise Value (GMV), order counts, revenue figures, active merchant/driver counts, or simulated fraud alarms.
- **Honest States**: Where data is not yet wired, components display honest placeholders:
  - *"Data belum tersedia"*
  - *"Modul belum diaktifkan"*
  - *"Menunggu integrasi fase berikutnya"*
  - *"Fitur operasional akan tersedia pada fase berikutnya"*

---

## 12. Accessibility Baseline

The Admin Web shell provides a robust accessibility foundation:
- **Semantic HTML**: Proper use of `<header role="banner">`, `<aside aria-label="...">`, `<nav aria-label="...">`, `<main role="main">`, `<h1>`, `<h2>`, and `<table>`.
- **Keyboard Navigation**: Skip-to-content link (`.skip-link`) allows keyboard users to bypass navigation. All buttons, links, and drawer triggers are reachable via Tab.
- **Focus Rings**: Universal `*:focus-visible` styles with prominent contrast and outline offsets.
- **ARIA Attributes**: `aria-expanded` and `aria-label` on mobile navigation triggers; `aria-busy="true"` and `role="status"` on `LoadingState`; `role="alert"` on `ErrorState`.
- **Color Contrast**: WCAG 2.1 AA compliant text-to-background contrast ratios across all states and typography.

---

## 13. Scope Exclusions

The following areas are strictly out of scope for Phase 1F:
- **Authentication**: Admin login, passwords, OTP, MFA, token storage, session database.
- **Business Workflows**: Merchant approval, driver KYC review, admin account management, permissions assignment.
- **Commerce**: Product catalog editing, outlet management, order tracking, dispatching.
- **Finance**: Payment gateway processing, ledger mutations, payouts, escrow reconciliations.
- **Support**: Live chat, complaint investigations, customer messaging.
- **Realtime / Maps**: WebSockets, push notifications, GPS live maps.
- **Phase 2 Domains**: Multi-outlet franchise management, advanced multi-service routing.

---

## 14. Phase 1G Integration Points

When Phase 1G (Identity & Authentication) is initiated, it will integrate with Phase 1F as follows:
1. **Login Route**: Wire `apps/admin-web/src/app/(public)/login/page.tsx` to the backend admin authentication endpoint (`POST /api/v1/auth/admin/login`).
2. **Session Middleware**: Implement Next.js `middleware.ts` to verify session cookies on `/(admin)/*` paths and redirect unauthenticated requests to `/login`.
3. **API Client Auth Injection**: Configure `adminApiClient` to attach authentication tokens/cookies to outbound requests.
4. **Header Profile**: Replace the placeholder operator avatar in `Header.tsx` with authenticated operator details (name, email, role) resolved from the session context.
5. **Logout Action**: Add a secure logout trigger in the admin shell header/sidebar that invalidates the session both locally and on the backend.
