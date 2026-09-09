# Mobile Foundation Architecture (Phase 1E)

## Overview

TorangGo establishes three physically separate Expo applications within the monorepo:
1. **Customer Mobile** (`apps/customer-mobile`) — End-user ordering, discovery, and account shell.
2. **Merchant Mobile** (`apps/merchant-mobile`) — Merchant store management and order intake shell.
3. **Driver Mobile** (`apps/driver-mobile`) — Delivery partner dispatch and earnings shell.

Each application maintains its own bundle identity, Expo configuration, route hierarchy, and independent lifecycle.

---

## Why No `APP_MODE`

We strictly avoid the anti-pattern of merging all three user roles into a single application toggled by `APP_MODE=customer|merchant|driver`.
- **App Store / Play Store Independence**: Customer, Merchant, and Driver apps have distinct store listings, branding requirements, target audiences, and release cadences.
- **Native Permissions Isolation**: The Driver app will require location and native background capabilities, whereas the Customer and Merchant apps must remain lightweight without requiring broad location/background permissions.
- **Security & Binary Footprint**: Code, bundles, and attack surface intended for merchants or drivers are never included in the customer binary.
- **Clean Workspace Architecture**: Reusable logic is extracted into shared packages (`@platform/mobile-ui`, `@platform/api-client`, `@platform/config`, `@platform/shared-types`, `@platform/validation`, `@platform/utils`) rather than runtime environment switches.

---

## Expo Router Structure

All three mobile applications leverage **Expo Router** file-system routing:

### Customer Mobile (`apps/customer-mobile/app/`)
```
app/
  _layout.tsx            # Root layout: QueryProvider, StatusBar, Stack
  index.tsx              # Unauthenticated entry redirect -> /(app)/(tabs)/home
  (app)/
    _layout.tsx          # App group stack container
    (tabs)/
      _layout.tsx        # 4-tab bottom navigation (Beranda, Cari, Pesanan, Akun)
      home.tsx           # Greeting, location header, MVP food service banner
      search.tsx         # Search input shell & empty discovery state
      orders.tsx         # Orders empty state (no fake history)
      account.tsx        # Guest profile shell (auth connection point for 1G)
```

### Merchant Mobile (`apps/merchant-mobile/app/`)
```
app/
  _layout.tsx            # Root layout: QueryProvider, StatusBar, Stack
  index.tsx              # Unauthenticated entry redirect -> /(app)/(tabs)/dashboard
  (app)/
    _layout.tsx          # App group stack container
    (tabs)/
      _layout.tsx        # 5-tab bottom navigation (Dashboard, Pesanan, Produk, Keuangan, Akun)
      dashboard.tsx      # Single-outlet identity ("1 merchant = 1 outlet"), empty sales metric
      orders.tsx         # Incoming orders empty state
      products.tsx       # Product catalog management placeholder
      finance.tsx        # Financial summary & withdrawal placeholder
      account.tsx        # Merchant profile & scope lock specifications
```

### Driver Mobile (`apps/driver-mobile/app/`)
```
app/
  _layout.tsx            # Root layout: QueryProvider, StatusBar, Stack
  index.tsx              # Unauthenticated entry redirect -> /(app)/(tabs)/home
  (app)/
    _layout.tsx          # App group stack container
    (tabs)/
      _layout.tsx        # 4-tab bottom navigation (Beranda, Aktivitas, Pendapatan, Akun)
      home.tsx           # Partner status indicator ("Offline/Online"), opportunity empty state
      activity.tsx       # Trip history empty state
      earnings.tsx       # Earnings and tips summary placeholder
      account.tsx        # Driver profile shell & native build roadmap
```

---

## Shared Mobile UI (`@platform/mobile-ui`)

The design system package provides brand-neutral, accessible primitives built directly on React Native:

### Design Tokens
- **Colors**: `primary` (`#0284c7`), `secondary` (`#0f172a`), `background` (`#f8fafc`), `surface` (`#ffffff`), `border` (`#e2e8f0`), `success`, `warning`, `error`, `neutral`.
- **Spacing**: `none` (0), `xs` (4px), `sm` (8px), `md` (16px), `lg` (24px), `xl` (32px), `xxl` (40px).
- **Typography**: Responsive typographic scale (`h1`, `h2`, `h3`, `bodyLarge`, `body`, `bodySmall`, `caption`, `label`, `button`).
- **Radius**: `sm` (4px), `md` (8px), `lg` (12px), `xl` (16px), `full` (9999px).

### Component Primitives
- `Screen`: SafeAreaView container supporting fixed or scrollable layouts with keyboard-avoidance.
- `AppText`: Accessible typography primitive with semantic variants and color bindings.
- `Button`: Accessible touch target (min 44px) supporting `primary`, `secondary`, `outline`, `text`, loading spinner, and disabled states.
- `Card`: Standard surface card with borders, subtle elevation, and padding options.
- `Input`: Form input with focus state, label, placeholder, helper text, and error indicators.
- `LoadingState`: Centered activity indicator with contextual status messages.
- `EmptyState`: Clean empty illustration placeholder with title, description, and optional action trigger.
- `ErrorState`: Standardized error view with message, correlation `X-Request-ID` display, and retry button.
- `OfflineBanner`: Non-intrusive network disconnection notice with retry trigger.
- `SectionHeader`: Standard section header with title and action link.
- `StatusBadge`: Colored status pill for system states.
- `Divider`: Consistent 1px horizontal separator line.

---

## TanStack Query v5 Foundation

Each mobile application root layout wraps the tree in `QueryProvider` from `@platform/mobile-ui`:
- **Client Configuration**:
  - `retry: 1` — Automatically retry failed queries once.
  - `staleTime: 1000 * 60 * 2` — Cache fresh for 2 minutes.
  - `gcTime: 1000 * 60 * 10` — Retain unused cache for 10 minutes.
  - `refetchOnWindowFocus: false` — Window focus refetching disabled to respect React Native app state lifecycle.
  - `refetchOnReconnect: true` — Refetch queries upon network reconnection.
  - `mutations.retry: false` — Mutations are never automatically retried to guarantee idempotency.

---

## Client Configuration & API Client Initialization

API client instances consume `@platform/config` and `@platform/api-client` with strict audience tagging:
- **Zero Hardcoded URLs**: Base URL resolves from `EXPO_PUBLIC_API_URL` or falls back to standard local development (`http://localhost:3000`).
- **Audience Mapping**:
  - Customer: `CUSTOMER_APP`
  - Merchant: `MERCHANT_APP`
  - Driver: `DRIVER_APP`
- **Zero Database / Secret Exposure**: Mobile apps never bundle `DATABASE_URL`, `REDIS_URL`, or backend secrets.

---

## Driver Dev-Build-First Strategy

The Driver app will eventually require native location tracking, foreground services, and notifications. In Phase 1E:
- **Zero Permissions Requested**: No `ACCESS_FINE_LOCATION`, `ACCESS_BACKGROUND_LOCATION`, `CAMERA`, or `RECORD_AUDIO` permissions are requested.
- **Dev-Build Readiness**: The codebase is configured to transition cleanly into Expo Development Builds (`npx expo run:android` / `npx expo run:ios`) in future phases when native modules (e.g. background geolocation) are integrated.
- **No Map Dependencies**: Zero third-party map libraries are installed in Phase 1E.

---

## Authentication Connection Point (Phase 1G)

Phase 1E is completely unauthenticated:
- **No Token Storage**: No JWT tokens, OTPs, or session secrets are saved to AsyncStorage or SecureStore.
- **Route Readiness**: When Phase 1G introduces identity and auth, the `app/index.tsx` entry file will inspect session state and route between `(public)` onboarding/login flows and `(app)` authenticated tab flows.

---

## Deep Link Foundation

Development URL schemes configured in `app.json`:
- Customer Mobile: `toranggo-customer://` (`com.toranggo.customer.dev`)
- Merchant Mobile: `toranggo-merchant://` (`com.toranggo.merchant.dev`)
- Driver Mobile: `toranggo-driver://` (`com.toranggo.driver.dev`)

---

## Running Mobile Apps

From project root:
```bash
# Customer Mobile
pnpm --filter customer-mobile dev

# Merchant Mobile
pnpm --filter merchant-mobile dev

# Driver Mobile
pnpm --filter driver-mobile dev
```
