<!-- refreshed: 2026-08-07 -->
# Architecture

**Analysis Date:** 2026-08-07

## System Overview

```text
┌─────────────────────────────────────────────────────────────┐
│                    Presentation Layer                       │
│         Screen Components (expo-router file routes)         │
│  `app/(auth)`, `app/(client)`, `app/(client)/browse`, etc   │
└────────┬─────────────────────────────────────────┬──────────┘
         │                                          │
         ▼                                          ▼
┌──────────────────────────────┐    ┌──────────────────────────┐
│    UI Components Layer        │    │    Custom Hooks Layer    │
│  `components/ui/` & `app/`   │    │  `hooks/use-auth.ts`,    │
│  (Button, Input, Card, etc)  │    │   `use-theme.ts`, etc    │
└───────┬────────────────────┬─┘    └────────────┬─────────────┘
        │                    │                   │
        │    ┌───────────────┴───────────────────┘
        │    │
        ▼    ▼
┌─────────────────────────────────────────────────────────────┐
│              State Management Layer (Zustand)               │
│    Stores: `auth`, `mechanic`, `appointment`, `timeslot`   │
│           `notification` — manage UI state                  │
│  `stores/auth-store.ts`, `stores/mechanic-store.ts`, etc   │
└────────┬─────────────────────────────────────────┬──────────┘
         │                                          │
         ▼                                          ▼
┌──────────────────────────────┐    ┌──────────────────────────┐
│   API Services Layer         │    │   Type Definitions       │
│ `services/auth-service.ts`   │    │  `types/models.ts`       │
│ `services/appointment-...`   │    │  (User, Mechanic,        │
│ `services/mechanic-...`      │    │   Appointment, etc)      │
│ `services/timeslot-...`      │    │                          │
│ `services/notification-...`  │    │                          │
└────────┬─────────────────────┘    └──────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│              Core Services Layer                            │
│  Supabase Client: `services/api.ts`                         │
│  SecureStorage (platform-specific auth persistence)         │
└─────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│              External Systems                               │
│  Supabase (Auth, Database, Realtime)                        │
│  Platform APIs (expo-constants, expo-image-picker, etc)    │
└─────────────────────────────────────────────────────────────┘
```

## Component Responsibilities

| Component | Responsibility | File |
|-----------|----------------|------|
| **Auth Screen** | Handle login/register UI and submission | `app/(auth)/login.tsx`, `app/(auth)/register.tsx` |
| **Browse Screen** | Display mechanic list, filtering, navigation | `app/(client)/browse/index.tsx` |
| **Bookings Screen** | Show user's appointments | `app/(client)/bookings.tsx` |
| **Appointment Detail** | Display/edit appointment details | `app/(client)/appointment/[id].tsx` |
| **Notifications Screen** | List user notifications | `app/(client)/notifications.tsx` |
| **Profile Screen** | Display/edit user profile | `app/(client)/profile.tsx` |
| **UI Components** | Reusable design system (Button, Input, Card) | `components/ui/*.tsx` |
| **App Components** | Feature-specific components (AppointmentCard, Avatar) | `components/app/*.tsx` |

## Pattern Overview

**Overall:** Layered architecture with reactive state management and file-based routing.

**Key Characteristics:**
- **File-based Routing**: expo-router handles navigation based on file structure in `app/` directory
- **Centralized State**: Zustand stores are the single source of truth for UI state
- **Service Abstraction**: All data operations go through service layer before store mutations
- **Type Safety**: TypeScript types in `types/models.ts` ensure consistent data shapes
- **Separation of Concerns**: Clear boundary between UI, state, and API layers

## Layers

**Presentation Layer:**
- Purpose: Render UI and handle user interactions
- Location: `app/**/*.tsx` (screens organized by route groups)
- Contains: Screen components using expo-router conventions
- Depends on: Hooks (custom hooks), Stores (Zustand state), Components (UI components)
- Used by: Navigation system (expo-router)

**UI Components Layer:**
- Purpose: Provide reusable, styled building blocks
- Location: `components/ui/` (design system), `components/app/` (feature components)
- Contains: Button, Input, Card, Avatar, AppointmentCard, BottomNavBar, etc.
- Depends on: Constants (theme), Utilities (formatting)
- Used by: Screen components, other components

**State Management Layer (Zustand Stores):**
- Purpose: Centralize application state and async actions
- Location: `stores/*.ts` (auth-store, mechanic-store, appointment-store, etc.)
- Contains: State properties, action creators, cache logic
- Depends on: Services (API layer), Types (models)
- Used by: Screens (via hooks), Other stores (cross-store communication)
- Example: `useAuthStore` provides login, logout, user state, role

**Service Layer:**
- Purpose: Abstract API calls and database operations
- Location: `services/*.ts`
- Contains: Functions wrapping Supabase client calls
- Depends on: Supabase client (`services/api.ts`), Types (for return types)
- Used by: Stores (for async data fetching)
- Exports: Typed functions like `login()`, `getAllMechanics()`, `createAppointment()`

**Core Services:**
- Purpose: Initialize and configure external systems
- Location: `services/api.ts` (Supabase client), `utils/secure-storage.ts` (secure token storage)
- Contains: Platform-specific configuration, auth persistence setup
- Used by: Service layer functions, Root layout for session recovery

**Config & Constants Layer:**
- Purpose: Centralize theme, environment variables, and constant values
- Location: `constants/theme.ts`, `config/env.ts`
- Contains: Color palette, typography, spacing, border radius, environment variables
- Used by: All components and screens

## Data Flow

### Primary Request Path: User Browses Mechanics

1. **User opens Browse screen** → `app/(client)/browse/index.tsx` renders
2. **Screen mounts** → calls `useMechanicStore().fetchAll()` hook
3. **Store action** → calls `mechanicService.getAllMechanics()`
4. **Service** → calls `supabase.from('profiles').select(...).eq('role', 'mechanic')`
5. **Response** → service maps rows to Mechanic type, returns array
6. **Store updates** → sets `mechanics[]`, `isLoading=false`, clears error
7. **Component re-renders** → displays mechanic list from store
8. **User taps mechanic** → navigates to detail screen

### Secondary Flow: User Books Appointment

1. **User selects time slot** on mechanic detail screen
2. **Book button triggered** → calls `appointmentStore.book(data)`
3. **Store action** → calls `appointmentService.createAppointment(data)`
4. **Service** → calls `supabase.rpc('book_client_appointment', {...})`
5. **Response** → RPC returns new Appointment object
6. **Store updates** → adds to `appointments[]`, invalidates timeslot cache
7. **Notifications updated** → fetches unread count for user
8. **Screen navigates** → shows success screen with confirmation

### Authentication Flow

1. **App starts** → `app/_layout.tsx` renders
2. **useEffect initializes session** → calls `authService.getCurrentSessionUser()`
3. **Service** → calls `supabase.auth.getSession()`
4. **If session exists** → fetches full profile from `profiles` table
5. **Auth store updated** → sets `user`, `isAuthenticated=true`
6. **Root layout** → listens to `supabase.auth.onAuthStateChange()` events
7. **On SIGNED_IN event** → defers profile load (prevents race conditions)
8. **On SIGNED_OUT event** → clears user state
9. **Root index** → conditionally routes to `/(auth)/login` or `/(client)/browse`

**State Management:**
- Auth state persisted across app restart via `SecureStorage` on native platforms
- Mechanic list cached for 5 minutes with manual refresh option
- Timeslot cache invalidated when appointment is booked or canceled
- Notifications fetched on-demand when appointments change

## Key Abstractions

**Zustand Store:**
- Purpose: Encapsulate domain state and operations (auth, mechanics, appointments)
- Examples: `stores/auth-store.ts` (user identity), `stores/mechanic-store.ts` (mechanic list), `stores/appointment-store.ts` (appointment CRUD)
- Pattern: Created with `create<StateInterface>((set, get) => ({...}))` and exported as hook

**Service Functions:**
- Purpose: Provide typed, error-handling wrappers around Supabase operations
- Examples: `authService.login()` returns `User | Mechanic | null`, `appointmentService.createAppointment()` returns `Appointment`
- Pattern: Async functions with timeout handling and detailed error messages

**Route Groups:**
- Purpose: Organize related screens and apply layout wrapping
- Examples: `(auth)` for unauthenticated screens, `(client)` for authenticated user screens
- Pattern: Directory names in parentheses create logical grouping without affecting URL structure

**Custom Hooks:**
- Purpose: Extract reusable logic from components
- Examples: `useAuth()` accesses auth state, `useTheme()` provides theme values
- Pattern: Thin wrappers around store selectors or platform APIs

## Entry Points

**Root Layout:**
- Location: `app/_layout.tsx`
- Triggers: App startup (Expo loads this first)
- Responsibilities: 
  - Load fonts
  - Initialize authentication session
  - Listen to auth state changes
  - Setup global theme and status bar
  - Hide splash screen when ready

**Root Router:**
- Location: `app/index.tsx`
- Triggers: After root layout initializes
- Responsibilities:
  - Route to `/(auth)/login` if user is not authenticated
  - Route to `/(client)/browse` if user is authenticated

**Auth Layout:**
- Location: `app/(auth)/_layout.tsx`
- Triggers: When unauthenticated
- Responsibilities:
  - Show Stack navigator for auth screens
  - Handle login and register screen transitions

**Client Layout:**
- Location: `app/(client)/_layout.tsx`
- Triggers: When authenticated
- Responsibilities:
  - Show Tab navigator for main app screens
  - Render custom bottom nav bar
  - Protect routes (redirect if not authenticated)

## Architectural Constraints

- **Threading:** Single-threaded event loop (React Native). No worker threads used. UI updates are batched and scheduled by React.
- **Global state:** Zustand stores are global singletons per store (auth-store, mechanic-store, etc.). Auth state in `useAuthStore` is the single source of truth for user identity.
- **Circular imports:** None detected. Services are leaf nodes; stores import services; screens import stores/hooks.
- **Platform-specific code:** Auth persistence differs by platform: web uses localStorage via Supabase, native uses Expo SecureStore via `SecureStorage` wrapper in `utils/secure-storage.ts`.
- **Timeout handling:** Service layer wraps async operations with 15-20s timeouts to prevent hanging requests; stores display error messages to user on timeout.

## Anti-Patterns

### Direct Supabase calls in components

**What happens:** Components import `services/api.ts` directly and call `supabase.from()` in useEffect, bypassing stores and services.

**Why it's wrong:** Breaks separation of concerns; makes data fetching logic hard to reuse; prevents centralized error handling; makes testing harder.

**Do this instead:** Create a service function in `services/*.ts`, expose an action in the appropriate store, and call it from the component via `useStore()` hook. Example: `app/(client)/browse/index.tsx` calls `useMechanicStore().fetchAll()`, not `supabase.from('profiles')` directly.

### Prop drilling for global state

**What happens:** Global values like auth state or theme are passed as props through multiple component layers instead of using hooks.

**Why it's wrong:** Makes components tightly coupled; hard to refactor; verbose; error-prone.

**Do this instead:** Create a custom hook (e.g., `useAuth()`, `useTheme()`) that wraps the Zustand store selector. Components call the hook directly at any depth.

### Mutations in stores without service layer

**What happens:** Store actions directly mutate Supabase data, log the response, and return without typed mapping.

**Why it's wrong:** Loses type safety; makes responses fragile to backend schema changes; prevents shared business logic.

**Do this instead:** All mutations go through service functions that return typed objects. Stores call services and map responses to application types. Example: `mechanicService.updateMechanicProfile()` returns `void` with error throwing; store calls it and updates local state.

## Error Handling

**Strategy:** Errors are caught at the service layer, often with timeout handling; stored in component/store error state; displayed to user via error messages or UI indicators.

**Patterns:**
- **Service timeouts:** `authService.withTimeout()` wraps promises with 15-20s deadline; throws `Error('... request timed out')`
- **Store error state:** `error: string | null` is set when service catches; stores display user-friendly Portuguese messages
- **Silent failures:** Notification fetches and cache invalidations are `void` and do not throw; errors logged to console only
- **Retry on user action:** Browse screen offers refresh button; user taps to force refetch

## Cross-Cutting Concerns

**Logging:** 
- Development only (gated by `__DEV__`): `console.log('[auth] email signInWithPassword ok in Xms')` in service layer
- Error logging: `console.error('Initial session load error:', error)` in root layout
- No production logging service integrated

**Validation:**
- Client-side: Zod schemas in form components (React Hook Form integration)
- Server-side: Supabase RLS policies and constraints
- Error messages are passed from service layer to store to component

**Authentication:**
- Session managed by Supabase Auth (JWT tokens)
- Token persisted securely: native platforms use `expo-secure-store`, web uses browser storage
- Automatic token refresh: Supabase `autoRefreshToken: true` handles refresh on demand
- Session recovery: Root layout calls `getCurrentSessionUser()` on app start to restore session

---

*Architecture analysis: 2026-08-07*
