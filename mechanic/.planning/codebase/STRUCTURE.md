# Codebase Structure

**Analysis Date:** 2026-08-07

## Directory Layout

```
mechanic/
├── app/                          # Expo Router pages (file-based routing)
│   ├── _layout.tsx              # Root layout, auth initialization
│   ├── index.tsx                # Root redirect (auth → mechanic or login)
│   ├── (auth)/                  # Auth group (layout scoped)
│   │   ├── _layout.tsx          # Auth stack layout
│   │   └── login.tsx            # Login screen
│   └── (mechanic)/              # Mechanic group (tabs layout scoped)
│       ├── _layout.tsx          # Mechanic tabs layout
│       ├── agenda.tsx           # Appointments list/schedule
│       ├── availability.tsx     # Time slot management
│       ├── notifications.tsx    # Notification list
│       ├── profile.tsx          # User profile screen
│       └── appointment/[id].tsx # Appointment detail (dynamic route)
│
├── components/                  # Reusable React components
│   ├── ui/                      # UI primitives
│   │   ├── Button.tsx           # Touchable button with variants
│   │   ├── Card.tsx             # Container card component
│   │   ├── Input.tsx            # Text input field
│   │   ├── Avatar.tsx           # User avatar display
│   │   ├── Badge.tsx            # Status/label badge
│   │   ├── BottomNavBar.tsx     # Custom bottom tab bar
│   │   ├── EmptyState.tsx       # Empty state placeholder
│   │   ├── DateChip.tsx         # Date display chip
│   │   ├── collapsible.tsx      # Accordion/collapsible
│   │   └── ... other UI components
│   ├── AppointmentCard.tsx      # Appointment display card
│   ├── MechanicCard.tsx         # Mechanic profile card
│   ├── TimeSlotPicker.tsx       # Time selection component
│   ├── themed-view.tsx          # Theme-aware View wrapper
│   └── themed-text.tsx          # Theme-aware Text wrapper
│
├── stores/                      # Zustand state management
│   ├── auth-store.ts            # User auth & session state
│   ├── appointment-store.ts     # Appointment CRUD state
│   ├── mechanic-store.ts        # Mechanic profile state
│   ├── notification-store.ts    # Notification list & counts
│   └── timeslot-store.ts        # Available time slots state
│
├── services/                    # Business logic & API layer
│   ├── api.ts                   # Supabase client init & config
│   ├── auth-service.ts          # Login, logout, profile queries
│   ├── appointment-service.ts   # Appointment CRUD, RPC calls
│   ├── mechanic-service.ts      # Mechanic profile operations
│   ├── notification-service.ts  # Notification queries & updates
│   └── timeslot-service.ts      # Time slot queries & caching
│
├── hooks/                       # Custom React hooks
│   ├── use-auth.ts              # Auth store access wrapper
│   ├── use-theme.ts             # Theme & colors hook
│   ├── use-theme-color.ts       # Single theme color hook
│   ├── use-color-scheme.ts      # Dark/light mode detection
│   └── use-color-scheme.web.ts  # Web-specific color detection
│
├── types/                       # TypeScript domain models
│   └── models.ts                # User, Mechanic, Appointment, etc.
│
├── utils/                       # Utility functions
│   ├── date.ts                  # Date formatting & manipulation
│   └── format.ts                # Number, currency formatting
│
├── constants/                   # App-wide constants
│   ├── theme.ts                 # Colors, spacing, typography, radius
│   └── config.ts                # Feature flags, limits
│
├── config/                      # Configuration files
│   └── env.ts                   # Environment variable loader
│
├── tests/                       # Test suite
│   └── e2e/                     # Playwright E2E tests
│       ├── availability.spec.ts
│       └── closure.spec.ts
│
├── assets/                      # Images, fonts, static files
│   └── images/                  # App icons, splash screen, etc.
│
├── dist/                        # Build output (generated)
├── node_modules/                # Dependencies (generated)
├── .expo/                       # Expo cache & metadata (generated)
│
├── app.json                     # Expo app configuration
├── eas.json                     # EAS Build configuration
├── tsconfig.json                # TypeScript configuration
├── package.json                 # Dependencies & scripts
├── package-lock.json            # Dependency lock file (generated)
├── eslint.config.js             # ESLint rules
├── playwright.config.ts         # Playwright test config
└── README.md                    # Project documentation
```

## Directory Purposes

**`app/`** — Expo Router pages
- Purpose: Screen implementations using file-based routing
- Contains: TSX files, layout definitions with Stack/Tabs
- Key files: `_layout.tsx` (root, auth init), `index.tsx` (router redirect), `(auth)/login.tsx` (login screen), `(mechanic)/_layout.tsx` (bottom tabs)
- Generated routes: Routes automatically created from file paths

**`components/`** — Reusable UI components
- Purpose: React components for pages to compose
- Contains: Functional components, StyleSheet styles
- Organization: `ui/` subfolder for primitives (Button, Card, Input), domain components at root
- Dependencies: Theme constants, hooks for styling

**`stores/`** — Zustand state containers
- Purpose: Application state management
- Contains: Store definitions, action methods, initial state
- Pattern: One file per entity/domain area
- Access: Via `useStoreHook()` in components

**`services/`** — Business logic and API integration
- Purpose: Orchestrate API calls and business operations
- Contains: Async functions, error handling, type mapping, Supabase client
- Dependencies: Supabase SDK, domain types
- Responsibilities: Timeout handling, error translation, database row mapping

**`hooks/`** — Custom React hooks
- Purpose: Extract state access patterns and reusable logic
- Contains: Hooks that wrap stores or provide computed state
- Key hook: `use-auth.ts` is the primary auth consumption pattern
- Platform-specific: `use-color-scheme.web.ts` for web-only color detection

**`types/`** — TypeScript domain models
- Purpose: Single source of truth for data shapes
- Contains: Interfaces and types (User, Mechanic, Appointment, TimeSlot, etc.)
- Shared by: Services, stores, components (all import from here)

**`utils/`** — Utility functions
- Purpose: Shared helper functions (date, format, calculation)
- Contains: Pure functions with no side effects
- Examples: `formatDateFull()`, `formatTimeRange()`, currency formatting

**`constants/`** — App-wide constants
- Purpose: Theme values, typography, spacing, feature flags
- Contains: Colors, font families, border radius, status theme colors, pagination limits
- Usage: Imported in components and services for consistent styling

**`config/`** — Configuration and environment
- Purpose: Environment-dependent settings
- Contains: Environment variable loading, build-time config
- File: `env.ts` loads `EXPO_PUBLIC_*` vars (Expo inlines at build time)

**`tests/`** — Test suite
- Purpose: E2E and integration tests
- Contains: Playwright test specs
- Location: `e2e/` subdirectory
- Run: `npm run e2e`

**`assets/`** — Static resources
- Purpose: Images, fonts, icons for app
- Contains: App icons, splash screens, Android adaptive icons, favicon
- Committed: Yes (except generated .png processing artifacts)

## Key File Locations

**Entry Points:**
- `app/index.tsx` — Root route (redirects based on auth)
- `app/_layout.tsx` — App initialization (fonts, auth listener)
- `app/(auth)/login.tsx` — Login screen
- `app/(mechanic)/agenda.tsx` — Main mechanic dashboard

**Configuration:**
- `app.json` — Expo project settings, plugins, experiments
- `tsconfig.json` — TypeScript compiler options (path aliases: `@/*`)
- `config/env.ts` — Environment variable access pattern
- `constants/theme.ts` — Design tokens (colors, spacing, typography)

**Core Logic:**
- `stores/auth-store.ts` — Auth state and login/logout actions
- `services/auth-service.ts` — Supabase auth operations
- `services/api.ts` — Supabase client initialization
- `types/models.ts` — Data model definitions

**Testing:**
- `tests/e2e/` — Playwright E2E test specifications
- `playwright.config.ts` — Playwright test runner config

**Styling:**
- `constants/theme.ts` — Color palette, spacing scale, typography scale
- `components/themed-view.tsx` — Theme-aware container
- `components/ui/Button.tsx` — Example styled component with variants

## Naming Conventions

**Files:**
- **Components:** PascalCase (e.g., `Button.tsx`, `AppointmentCard.tsx`)
- **Screens (pages):** Lowercase (Expo Router convention, e.g., `agenda.tsx`, `login.tsx`)
- **Stores:** Entity name + `-store.ts` (e.g., `auth-store.ts`, `appointment-store.ts`)
- **Services:** Entity name + `-service.ts` (e.g., `auth-service.ts`, `appointment-service.ts`)
- **Hooks:** Use prefix + descriptive (e.g., `use-auth.ts`, `use-theme.ts`)
- **Types:** Entity name or type name (e.g., `models.ts` for domain types)
- **Utils:** Module name (e.g., `date.ts`, `format.ts`)
- **Tests:** Feature name + `.spec.ts` (e.g., `availability.spec.ts`)

**Directories:**
- **Feature groups:** Lowercase (e.g., `components`, `services`, `stores`)
- **Route groups:** Parentheses notation (e.g., `(auth)`, `(mechanic)`)
- **Nested routes:** Lowercase with brackets for params (e.g., `appointment/[id].tsx`)

**TypeScript:**
- **Type names:** PascalCase (e.g., `User`, `Mechanic`, `Appointment`)
- **Type union suffixes:** Union types include all options (e.g., `type Role = 'admin' | 'mechanic' | 'client'`)
- **Function names:** camelCase (e.g., `loginByPhone()`, `getUserById()`)
- **Constants:** UPPER_SNAKE_CASE for magic numbers (e.g., `LOGIN_TIMEOUT_MS = 15000`)
- **Store actions:** Verb-based (e.g., `fetchByMechanic()`, `book()`, `cancelByClient()`)

## Where to Add New Code

**New Feature (e.g., Payment Processing):**
- Service layer: `services/payment-service.ts` (Stripe API calls, error handling)
- Store: `stores/payment-store.ts` (payment state, transaction history)
- Components: `components/PaymentForm.tsx`, `components/ui/CreditCardInput.tsx`
- Screen: `app/(mechanic)/payments.tsx` (if user-facing) or embedded in existing screen
- Types: Add interfaces to `types/models.ts`
- Tests: `tests/e2e/payments.spec.ts` if user journey needs testing

**New Component (e.g., Loading Skeleton):**
- Location: `components/ui/Skeleton.tsx` (if reusable), or `components/Skeleton.tsx` (if domain-specific)
- Style: Use theme constants from `constants/theme.ts`
- Props: TypeScript interface, sensible defaults
- Example pattern: See `components/ui/Button.tsx` for variant/size patterns

**New Utility:**
- Location: `utils/[domain].ts` (e.g., `utils/currency.ts` for money formatting)
- Pattern: Export pure functions, no side effects
- Example: `export function formatCents(cents: number): string { ... }`

**New Store (Domain Area):**
- Location: `stores/[entity]-store.ts`
- Pattern: Use Zustand `create<StateInterface>()`, export single store instance
- Actions: Methods that both update state and call services
- Example: See `stores/appointment-store.ts` for async CRUD pattern

**New API Service:**
- Location: `services/[entity]-service.ts`
- Pattern: Export async functions, use `supabase` client from `services/api.ts`
- Error handling: Throw errors (stores handle try-catch)
- Type safety: Map database rows to domain models

**New Screen/Route:**
- Location: `app/(group)/[name].tsx` for grouped screens, `app/[name].tsx` for ungrouped
- Pattern: Export default function component
- Data access: Call hooks (e.g., `useAppointmentStore()`) for data/actions
- Navigation: Use `useRouter()` from expo-router for programmatic navigation

**New Hook (Component Utility):**
- Location: `hooks/use-[name].ts`
- Pattern: Export single function hook
- Purpose: Simplify component code, wrap store access, extract reusable logic
- Example: `use-auth.ts` wraps auth store and adds role-checking methods

## Special Directories

**`.expo/`** — Expo metadata and cache
- Purpose: Expo CLI working directory
- Generated: Yes (ignored in git)
- Committed: No (in .gitignore)

**`dist/`** — Web build output
- Purpose: Static export for web deployment
- Generated: Yes (from `npm run build:web`)
- Committed: No (in .gitignore)

**`node_modules/`** — npm dependencies
- Purpose: Installed packages
- Generated: Yes (from `npm install`)
- Committed: No (in .gitignore)

**`.planning/`** — Planning and analysis documents
- Purpose: Codebase maps, ADRs, decisions
- Generated: No (user-created)
- Committed: Yes

**`tests/`** — Test files
- Purpose: E2E and integration test specifications
- Contains: Playwright test suites
- Run: `npm run e2e`

## Import Path Aliases

**Configured in `tsconfig.json`:**
```json
"@/*": ["./*"]
```

**Usage:**
```typescript
// Instead of: import { useAuth } from '../../../../hooks/use-auth'
import { useAuth } from '@/hooks/use-auth';

// Instead of: import { Appointment } from '../../../../types/models'
import { Appointment } from '@/types/models';
```

All files in the project root can be imported via `@/` prefix. This simplifies imports and reduces relative path errors.

---

*Structure analysis: 2026-08-07*
