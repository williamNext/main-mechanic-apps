<!-- refreshed: 2026-08-07 -->
# Architecture

**Analysis Date:** 2026-08-07

## System Overview

```text
┌──────────────────────────────────────────────────────────────────┐
│                        Screens / Pages Layer                     │
│                  `app/` (Expo Router file-based)                 │
│  ┌─────────────────────┬──────────────┬──────────────────────┐  │
│  │   (auth) Routes     │ (mechanic)   │  Root Navigation     │  │
│  │  login, signup      │  Tabs Layout │  index.tsx, _layout  │  │
│  └─────────────────────┴──────────────┴──────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│                   Components Layer                                │
│              `components/` (UI & Domain Components)               │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  UI Components: Button, Card, Input, Avatar, Badge      │   │
│  │  Domain Components: AppointmentCard, TimeSlotPicker     │   │
│  │  Themed: themed-view.tsx, themed-text.tsx              │   │
│  └──────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│                  State Management Layer                           │
│                   `stores/` (Zustand)                             │
│  ┌──────────────┬────────────────┬──────────────────────────┐   │
│  │ auth-store   │ appointment-   │ notification-store,      │   │
│  │              │ store          │ mechanic-store,          │   │
│  │ User session │ Appointments   │ timeslot-store           │   │
│  └──────────────┴────────────────┴──────────────────────────┘   │
└──────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│                  Service Layer                                    │
│        `services/` (Business Logic & API Integration)             │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │ auth-service.ts       — Login, logout, session management │  │
│  │ appointment-service   — Booking, cancellation, completion │  │
│  │ mechanic-service      — Mechanic profile operations       │  │
│  │ notification-service  — Notification handling            │  │
│  │ timeslot-service      — Availability management           │  │
│  │ api.ts               — Supabase client initialization     │  │
│  └────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│                  Data / Backend Layer                             │
│   Supabase (PostgreSQL, Auth, Real-time subscriptions)           │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │ Database: profiles, mechanics, appointments, timeslots    │  │
│  │ Auth: Supabase Auth (email/phone login)                   │  │
│  │ Functions: RPC procedures for complex operations          │  │
│  └────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
```

## Component Responsibilities

| Component | Responsibility | File |
|-----------|----------------|------|
| **Root Layout** | Font loading, auth initialization, session persistence | `app/_layout.tsx` |
| **Auth Store** | Login/logout, user profile, auth state | `stores/auth-store.ts` |
| **Auth Routes** | Login, signup screens | `app/(auth)/` |
| **Mechanic Layout** | Bottom tab navigation for logged-in mechanics | `app/(mechanic)/_layout.tsx` |
| **Appointment Store** | Appointment CRUD, filtering by mechanic/client | `stores/appointment-store.ts` |
| **Appointment Service** | API calls for appointment operations | `services/appointment-service.ts` |
| **Auth Service** | Supabase auth operations, user profile queries | `services/auth-service.ts` |
| **UI Components** | Reusable button, card, input, badge, avatar | `components/ui/` |
| **Domain Components** | Appointment cards, mechanic cards, time slot picker | `components/` |
| **Supabase Client** | Auth and database connection | `services/api.ts` |
| **Custom Hooks** | Extract store access patterns (useAuth, useTheme) | `hooks/` |

## Pattern Overview

**Overall:** Layered Architecture with Zustand State Management

**Key Characteristics:**
- **File-based routing** via Expo Router (convention-based, strongly typed with `typedRoutes: true`)
- **Unidirectional data flow** — Components → Hooks/Stores → Services → API → Supabase
- **Separation of concerns** — UI logic (components) separated from business logic (stores/services)
- **Real-time auth state** — Supabase auth listeners update stores automatically
- **Type safety** — Full TypeScript strict mode with shared models in `types/models.ts`

## Layers

**UI/Page Layer:**
- Purpose: Render screens using Expo Router navigation
- Location: `app/` with grouped routes `(auth)`, `(mechanic)`
- Contains: Screen components (tsx files), navigation configuration
- Depends on: Components, hooks (useAuth, stores)
- Used by: Navigation system, users

**Component Layer:**
- Purpose: Reusable UI building blocks
- Location: `components/` (UI primitives in `components/ui/`, domain components root)
- Contains: Button, Card, Input, Avatar, Badge, AppointmentCard, TimeSlotPicker
- Depends on: Theme constants, hooks
- Used by: Page components in `app/`

**State Management Layer (Zustand):**
- Purpose: Centralized application state
- Location: `stores/` with one file per entity
- Contains: auth-store, appointment-store, notification-store, mechanic-store, timeslot-store
- Depends on: Services (for data fetching)
- Used by: Components via custom hooks and direct store access

**Service Layer:**
- Purpose: Business logic and Supabase API orchestration
- Location: `services/`
- Contains: Entity-specific services (auth, appointment, mechanic, etc.), Supabase client initialization
- Depends on: Supabase SDK, types/models
- Used by: Zustand stores, directly by components in some cases

**Data Layer:**
- Purpose: Persistent data and authentication
- Backend: Supabase (PostgreSQL + Auth service)
- Contains: Profiles, mechanics, appointments, timeslots tables; RPC functions
- Accessed via: `supabase` client in `services/api.ts`

## Data Flow

### Primary Request Path: Viewing Appointments (Agenda Screen)

1. **Page Mount** (`app/(mechanic)/agenda.tsx:75-79`)
   - Component mounts, checks `user?.role === 'mechanic'`
   - Calls `fetchByMechanic(user.id)` from appointment store

2. **Store Fetches** (`stores/appointment-store.ts:36-43`)
   - Store sets `isLoading: true`
   - Calls `appointmentService.getAppointmentsByMechanic(mechanicId)`

3. **Service Queries API** (`services/appointment-service.ts`)
   - Syncs unfinalized appointments via RPC
   - Queries `appointments` table with `client:profiles` and `appointment_service_reports`
   - Maps database rows to domain models

4. **Supabase Response**
   - Returns typed Appointment array
   - Real-time subscriptions enabled for live updates (if configured)

5. **Store Updates** (`stores/appointment-store.ts:40`)
   - Sets `appointments` array in store
   - Sets `isLoading: false`

6. **Component Rerenders**
   - `useAppointmentStore()` selector triggers component update
   - Filters appointments by mode (today, upcoming, pending, history)
   - Renders filtered list using `AppointmentRow` component

### Authentication Flow

1. **App Initialization** (`app/_layout.tsx:33-88`)
   - Root layout loads fonts, registers Supabase auth listener
   - Calls `authService.getCurrentSessionUser()` to restore session

2. **Auth State Change**
   - Supabase detects session change (SIGNED_IN, SIGNED_OUT)
   - Calls `scheduleProfileLoad()` with deferred timer (mitigates race conditions)

3. **Profile Load**
   - Calls `authService.getUserById(id)`
   - Queries `profiles` table, joins `mechanics(*)` if user is mechanic
   - Maps to User or Mechanic type

4. **Store Update**
   - `useAuthStore.setUser()` updates global auth state
   - Sets `isAuthenticated`, `role` fields

5. **Navigation**
   - `app/index.tsx` checks `isAuthenticated && isMechanic`
   - Redirects to `/(mechanic)/agenda` or `/(auth)/login`

### Appointment Booking (Hypothetical - from Code Inspection)

1. User selects time slot, enters vehicle info
2. Component calls `book()` from appointment store
3. Store calls `appointmentService.createAppointment(bookingData)`
4. Service calls Supabase RPC `book_client_appointment()`
5. On success:
   - Appointment added to store
   - TimeSlot cache invalidated (`useTimeSlotStore.getState().invalidateCache()`)
   - Notification count updated (`useNotificationStore.getState().fetchUnreadCount()`)
6. Component updates UI with new appointment

**State Management:**
- Zustand stores hold application state in memory
- Stores persist auth session via Supabase (AsyncStorage on mobile)
- Service layer handles API calls without side effects
- Components read from stores via hooks or direct selectors

## Key Abstractions

**Zustand Store Pattern:**
- Purpose: Centralized state container with getState(), setState() methods
- Examples: `stores/auth-store.ts`, `stores/appointment-store.ts`
- Pattern: `create<StateInterface>((set, get) => ({ ...state, ...actions }))`
- Access: Via hooks (`useAuthStore()`) or direct store access (`useAppointmentStore.getState()`)

**Service Layer Pattern:**
- Purpose: API integration and business logic
- Examples: `services/auth-service.ts`, `services/appointment-service.ts`
- Pattern: Exported async functions that call Supabase client
- Error handling: Wrapped with timeout utilities and error translation

**File-Based Routing:**
- Purpose: Automatic routing from file structure
- Examples: `app/(mechanic)/agenda.tsx` → `/(mechanic)/agenda` route
- Pattern: Grouped routes via parentheses `(groupName)`, dynamic routes via `[param]`
- Layout files `_layout.tsx` define navigation structure (Stack, Tabs)

**Component Props and Styling:**
- Purpose: Composable, type-safe UI
- Examples: `components/ui/Button.tsx` with variant/size props
- Pattern: Props interface defines component API, StyleSheet for styles
- Theming: Via `useAppTheme()` hook, constants in `constants/theme.ts`

**Custom Hooks for Store Access:**
- Purpose: Simplify component-store binding
- Examples: `hooks/use-auth.ts` wraps auth store, adds computed properties
- Pattern: Exports a single hook function that uses Zustand store internally
- Benefits: Encapsulation, easier refactoring, clear data dependencies

## Entry Points

**Web Entry:**
- Location: `expo-router/entry` (from package.json "main")
- Triggers: App startup on web/mobile

**App Root:**
- Location: `app/_layout.tsx`
- Triggers: All navigation starts here
- Responsibilities: Load fonts, init Supabase auth listener, render Stack navigation

**Initial Route:**
- Location: `app/index.tsx`
- Triggers: App loads after root layout
- Logic: Redirects to `/(auth)/login` if not authenticated, else to `/(mechanic)/agenda`

**Authenticated Routes:**
- Location: `app/(mechanic)/_layout.tsx`
- Triggers: After successful login
- Structure: Tabs layout with agenda, availability, notifications, profile screens

**Login Screen:**
- Location: `app/(auth)/login.tsx`
- Triggers: Unauthenticated users
- Flow: Form submission → `loginByEmail()` or `loginByPhone()` → auth store update → redirect

## Architectural Constraints

- **Threading:** Single-threaded JavaScript event loop (React Native runtime)
- **Global state:** Zustand stores are module singletons; all components share same store instance
- **Session persistence:** Supabase persists session to AsyncStorage (mobile) / localStorage (web); app restores on launch
- **Circular imports:** None detected; dependency graph is acyclic (UI → Hooks → Stores → Services → API)
- **Platform differences:** `use-color-scheme.web.ts` handles web-specific color detection; Supabase client uses conditional storage (AsyncStorage on native, localStorage on web)
- **Auth lifecycle:** App initializes auth listener in root layout; auth state changes trigger cascading updates through stores

## Anti-Patterns

### Anti-Pattern: Direct Supabase Calls in Components

**What happens:** Components import `supabase` directly and call `.from().select()` instead of going through services.

**Why it's wrong:** Violates separation of concerns; makes components responsible for API logic. Changes to API structure require updating multiple components. Testing becomes harder (can't mock API layer).

**Do this instead:** Always call through service layer:
```typescript
// Wrong:
const { data } = await supabase.from('appointments').select();

// Right:
const appointments = await appointmentService.getAllAppointments();
```
Keep all API calls in `services/` (e.g., `services/appointment-service.ts`), services call supabase client, components call services.

### Anti-Pattern: Direct Store Mutation in Components

**What happens:** Components call `useAppointmentStore.getState().appointments.push(new)` instead of using store actions.

**Why it's wrong:** Bypasses store transaction logic; can cause inconsistent state (e.g., timeslot cache not invalidated when appointment added).

**Do this instead:** Use store action methods:
```typescript
// Wrong:
useAppointmentStore.getState().appointments.push(appointment);

// Right:
await useAppointmentStore.getState().book(bookingData);
// Action internally updates store and invalidates related caches
```

### Anti-Pattern: Untyped Supabase Responses

**What happens:** Services return raw database rows without mapping to domain types.

**Why it's wrong:** Introduces schema coupling; UI breaks if column names change in database. No IDE autocomplete on response fields.

**Do this instead:** Map database rows to domain models in service layer:
```typescript
// In services/appointment-service.ts
function mapAppointmentRow(row: any): Appointment {
  return {
    id: row.id,
    clientId: row.client_id,
    // ... other fields
  };
}
```
Services return `Appointment`, not raw db row.

## Error Handling

**Strategy:** Try-catch in services with error translation to user-friendly messages; stores handle loading/error states.

**Patterns:**

1. **Service Layer:**
   ```typescript
   // services/auth-service.ts
   export async function login(email, password) {
     const { data, error } = await supabase.auth.signInWithPassword({ email, password });
     if (error) throw error; // Supabase error → throw
     return getUserById(data.user.id); // On success, fetch full profile
   }
   ```

2. **Store Layer:**
   ```typescript
   // stores/auth-store.ts
   try {
     const user = await authService.login(email, password);
     set({ user, isAuthenticated: true, error: null });
   } catch (e) {
     set({ error: e instanceof Error ? e.message : 'Login failed' });
   }
   ```

3. **Component Layer:**
   ```typescript
   // In screens
   const { error, isLoading } = useAuthStore();
   if (error) <Text>{error}</Text>
   ```

**Timeout Protection:**
- Auth operations wrapped with `withTimeout()` utility (15s default for auth, 15s for profile queries)
- Prevents infinite hangs if network is down

## Cross-Cutting Concerns

**Logging:** Console logging in dev mode; debug messages prefixed with `[auth]`, `[profile]` etc. See `services/auth-service.ts` for patterns.

**Validation:** 
- Input validation in services before API calls (e.g., phone normalization in `auth-service.ts`)
- Zod schemas can be added for stricter form validation (imported but not extensively used yet)

**Authentication:** 
- Supabase Auth owns user credentials
- App stores only user profile (from `profiles` table) in Zustand
- Session automatically refreshed by Supabase SDK

---

*Architecture analysis: 2026-08-07*
