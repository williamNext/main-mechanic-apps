<!-- refreshed: 2026-08-07 -->
# Architecture

**Analysis Date:** 2026-08-07

## System Overview

```text
┌──────────────────────────────────────────────────────────────────┐
│                      Screens / Pages (Expo Router)               │
│  ┌─────────────────┬────────────────────┬──────────────────────┐ │
│  │  Login Screen   │  Dashboard Screen  │ Management Screens   │ │
│  │  (auth/login)   │  (admin/dashboard) │ (mechanics, appts..) │ │
│  └────────┬────────┴────────┬───────────┴──────────────┬────────┘ │
└───────────┼──────────────────┼──────────────────────────┼──────────┘
            │                  │                          │
            ▼                  ▼                          ▼
┌──────────────────────────────────────────────────────────────────┐
│              Zustand State Stores (Global State)                  │
│  ┌─────────────────────┐        ┌──────────────────────────────┐ │
│  │   auth-store        │        │    admin-store               │ │
│  │ • user info         │        │ • filters, dashboard, data   │ │
│  │ • auth state        │        │ • loading, error states      │ │
│  │ • login/logout fns  │        │ • fetch methods              │ │
│  └────────┬────────────┘        └──────────────┬───────────────┘ │
└───────────┼──────────────────────────────────────┼────────────────┘
            │                                      │
            ▼                                      ▼
┌──────────────────────────────────────────────────────────────────┐
│                    Services Layer (API Clients)                   │
│  ┌──────────────────┐  ┌─────────────────┐  ┌────────────────┐  │
│  │  auth-service    │  │  admin-service  │  │     api.ts     │  │
│  │ • login()        │  │ • fetch ops     │  │ • Supabase     │  │
│  │ • getCurrentUser │  │ • delete/create │  │   client       │  │
│  │ • logout()       │  │ • RPC calls     │  │                │  │
│  └──────────────────┘  └─────────────────┘  └────────────────┘  │
└───────────┬──────────────────────────────────────┬────────────────┘
            │                                      │
            └──────────────────┬───────────────────┘
                               ▼
                    ┌──────────────────────┐
                    │  Supabase Backend    │
                    │ • Auth (email/phone) │
                    │ • PostgreSQL RPC     │
                    │ • Edge Functions     │
                    │ • Session storage    │
                    └──────────────────────┘
```

## Component Responsibilities

| Component | Responsibility | File |
|-----------|----------------|------|
| Root Layout | App initialization, auth bootstrap, font loading, navigation setup | `app/_layout.tsx` |
| Index Route | Auth-based routing logic (redirect to login or dashboard) | `app/index.tsx` |
| Auth Layout | Authentication flow container, login screen routing | `app/(auth)/_layout.tsx` |
| Admin Layout | Protected admin section, guards against non-admin access | `app/(admin)/_layout.tsx` |
| Dashboard Screen | Display metrics, top mechanics, appointment trends | `app/(admin)/dashboard.tsx` |
| Mechanics Screen | List, search, filter, create, delete mechanics | `app/(admin)/mechanics/index.tsx` |
| Appointments Screen | List, filter appointments by status, mechanic, date range | `app/(admin)/appointments.tsx` |
| Finance Screen | Financial reports, revenue breakdown by mechanic/service | `app/(admin)/finance.tsx` |
| Reports Screen | Various admin reports (TBD implementation) | `app/(admin)/reports.tsx` |
| Auth Store | Manage auth state, login/logout actions, user session | `stores/auth-store.ts` |
| Admin Store | Manage admin UI state, data fetching, filters, error handling | `stores/admin-store.ts` |

## Pattern Overview

**Overall:** Layered architecture with clear separation between UI, state management, and API integration.

**Key Characteristics:**
- **State-first design**: Zustand stores are the source of truth, screens consume via hooks
- **Service-oriented API**: Services abstract Supabase calls with error handling and timeouts
- **Expo Router navigation**: Type-safe routing with route groups and protected routes
- **Multi-platform support**: Single codebase runs on iOS, Android, and Web
- **Async action lifecycle**: All async operations track loading/error states in stores

## Layers

**Presentation Layer (Screens & Components):**
- Purpose: Render UI, handle user interaction, read from stores
- Location: `app/` (screens), `components/` (reusable UI)
- Contains: React Native components, StyleSheets, event handlers
- Depends on: Zustand stores, hooks, utility functions
- Used by: Expo Router navigation

**State Management Layer (Stores):**
- Purpose: Centralize application state, orchestrate async operations
- Location: `stores/` (auth-store.ts, admin-store.ts)
- Contains: Zustand store definitions, state interfaces, action logic
- Depends on: Services, types
- Used by: Screens via `useAuthStore()` and `useAdminStore()` hooks

**Service Layer (API Integration):**
- Purpose: Abstract Supabase calls, handle request/response, error handling
- Location: `services/` (api.ts, auth-service.ts, admin-service.ts)
- Contains: Supabase client initialization, typed API methods, utility functions
- Depends on: Types, environment config
- Used by: Stores exclusively (screens never call services directly)

**Infrastructure Layer (Backend):**
- Purpose: Provide data persistence, authentication, business logic
- Location: Supabase (PostgreSQL, Auth, RPC, Edge Functions)
- Contains: Database schema, RPC functions, edge function handlers
- Depends on: Nothing (upstream only)

## Data Flow

### Primary Request Path (Dashboard Load)

1. User navigates to dashboard → `app/(admin)/dashboard.tsx` renders
2. Component calls `useAdminStore()` hook and accesses `fetchDashboard()` action
3. Component subscribes to store's `dashboard`, `filters`, `loading.dashboard` fields
4. `fetchDashboard()` executes: `adminService.fetchDashboardSummary(filters)` → `supabase.rpc('admin_dashboard_summary', {...})`
5. Response is validated and stored in `store.dashboard`
6. Component re-renders with data via React subscription

**Files involved:**
- Screen: `app/(admin)/dashboard.tsx` (lines 9, 12-13)
- Store: `stores/admin-store.ts` (lines 95-99)
- Service: `services/admin-service.ts` (lines 31-38)

### Authentication Flow

1. User enters email/phone and password on login screen
2. `loginByIdentifier(identifier, password)` is called from auth store
3. Auth store calls `authService.login()` which calls `supabase.auth.signInWithPassword()`
4. If success, `authService.getAdminById()` fetches admin profile from `profiles` table
5. Store updates `user`, `isAuthenticated`, `role` and clears error
6. Root layout listener (onAuthStateChange) syncs session changes

**Files involved:**
- Store: `stores/auth-store.ts` (lines 46-66)
- Service: `services/auth-service.ts` (lines 28-52)
- Layout: `app/_layout.tsx` (lines 65-74)

### Mechanics Management

1. User performs action: list, create, or delete mechanics
2. Admin store method is called: `fetchMechanics()`, `createMechanic()`, or `deleteMechanics()`
3. For list operations: RPC call to `admin_list_mechanics`
4. For create/delete: Edge Function invoked (`admin-create-mechanic`, `admin-delete-mechanics`)
5. Store updates data and refreshes dashboard to keep UI in sync

**Files involved:**
- Store: `stores/admin-store.ts` (lines 102-161)
- Service: `services/admin-service.ts` (lines 40-122)

### Reactive Session Management

1. Root layout sets up auth listener on mount
2. Whenever Supabase auth state changes (login, logout, token refresh), listener fires
3. If SIGNED_IN: schedules `getAdminById()` to fetch full admin profile
4. If SIGNED_OUT: immediately sets user to null
5. Request deduplication via `profileRequestId` ref to ignore stale responses

**Files involved:**
- Layout: `app/_layout.tsx` (lines 31-81)
- Service: `services/auth-service.ts` (lines 91-99)

**State Management:**
- User state lives in auth-store; persisted via Supabase session storage
- Admin data (dashboard, mechanics, etc.) lives in admin-store; refreshed on demand
- No global UI state outside stores (loading states are store-managed)

## Key Abstractions

**AdminShell Component:**
- Purpose: Standardized container for admin screens with header, navigation context
- File: `components/admin/AdminShell.tsx`
- Pattern: Layout wrapper with title and consistent styling

**AdminControls UI Library:**
- Purpose: Reusable admin UI components (cards, inputs, charts, empty states)
- File: `components/ui/AdminControls.tsx`
- Pattern: Barrel export of common components

**Filter Utilities:**
- Purpose: Normalize, validate, and default filter objects
- File: `features/admin/filter-utils.ts`
- Pattern: Pure functions for filter sanitization with Zod schema

**Custom Hooks:**
- `useAuth()`: Convenience wrapper around auth-store
- File: `hooks/use-auth.ts`
- Pattern: Hook to expose store actions and derived state

## Entry Points

**App Entry Point:**
- Location: `expo-router/entry` (configured in package.json)
- Triggers: `app/_layout.tsx` as root route

**Root Layout:**
- Location: `app/_layout.tsx`
- Triggers: App startup; initializes fonts, auth, splash screen, navigation stack
- Responsibilities: Font loading, auth session bootstrap, listeners setup, splash screen lifecycle

**Initial Route:**
- Location: `app/index.tsx`
- Triggers: After root layout completes (fonts loaded, auth state known)
- Responsibilities: Route redirection based on auth and role status

**Protected Route Groups:**
- Auth routes: `app/(auth)/_layout.tsx` → only for unauthenticated users
- Admin routes: `app/(admin)/_layout.tsx` → only for authenticated admins (validated on each render)

## Architectural Constraints

- **Threading:** React Native single-threaded event loop; all async work is non-blocking via promises
- **Global state:** Auth-store and admin-store are global singletons via Zustand; session state is persisted via AsyncStorage
- **Circular imports:** Import pattern is strictly hierarchical: screens → stores → services → types/config; no reverse dependencies
- **Platform differences:** Code branches on `Platform.OS` in `services/api.ts` for async-storage and app-state listeners (native only)
- **Timeout constraints:** Auth operations hardcoded to 15 seconds timeout to prevent hanging on slow networks
- **Request deduplication:** Dashboard/mechanic detail loads use request ID tracking to ignore race condition responses

## Anti-Patterns

### Direct Service Calls in Components

**What happens:** A screen calls `adminService.fetchMechanics()` directly instead of using the store.
**Why it's wrong:** Bypasses centralized state management, creates duplicate loading/error logic, loses data sync across screens.
**Do this instead:** Call store method like `adminStore.fetchMechanics()` which handles side effects and updates state.
**Reference:** `app/(admin)/dashboard.tsx` line 12 shows correct pattern using store.

### Missing Error Handling in Async Actions

**What happens:** A component awaits a store action without checking the error field.
**Why it's wrong:** Errors are stored in `store.error` but may not be displayed to user; silent failures.
**Do this instead:** Always read `store.error` in component and render error state; use `clearError()` to dismiss.
**Reference:** `app/(admin)/dashboard.tsx` lines 9, 26 shows correct pattern checking `error` field.

## Error Handling

**Strategy:** Three-tier error handling with fallback messages

**Patterns:**
1. **Service layer**: Validates inputs, calls Supabase, wraps errors with context (`services/admin-service.ts` lines 20-23)
2. **Store layer**: Catches service errors, saves to `store.error`, clears on next action (`stores/admin-store.ts` lines 62-65)
3. **UI layer**: Displays error from store or falls back to generic message (`app/(admin)/dashboard.tsx` line 26)

**Timeouts:** Auth operations fail after 15 seconds with specific error message
**Validation:** Filters validated with Zod before API calls; invalid inputs reset to defaults

## Cross-Cutting Concerns

**Logging:** `console.error()` in store error handlers for debugging; no structured logging currently
**Validation:** Zod schemas for filter objects; request body validation on Supabase edge functions
**Authentication:** Supabase auth with email or phone; role check enforced in `getAdminById()`
**Session persistence:** AsyncStorage on native; localStorage on web (via Supabase client auto-config)

---

*Architecture analysis: 2026-08-07*
