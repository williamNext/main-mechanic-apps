# Codebase Structure

**Analysis Date:** 2026-08-07

## Directory Layout

```
oficina/
├── app/                                 # Screen components (expo-router file-based routing)
│   ├── _layout.tsx                      # Root layout: auth init, theme, fonts
│   ├── index.tsx                        # Root router: conditional auth/client redirect
│   ├── (auth)/                          # Route group: unauthenticated screens
│   │   ├── _layout.tsx                  # Stack nav for auth screens
│   │   ├── login.tsx                    # Email/phone login screen
│   │   └── register.tsx                 # Signup screen
│   └── (client)/                        # Route group: authenticated user screens (tab nav)
│       ├── _layout.tsx                  # Tab nav with custom BottomNavBar
│       ├── browse/                      # Mechanic discovery feature
│       │   ├── index.tsx                # Browse mechanics list with search
│       │   ├── [mechanicId].tsx         # Mechanic detail: timeslots & book
│       │   └── _layout.tsx              # Layout for browse screens
│       ├── bookings.tsx                 # User's appointments list
│       ├── appointment/                 # Appointment detail feature
│       │   └── [id].tsx                 # Appointment detail: view/edit/complete
│       ├── notifications.tsx            # Notification feed
│       ├── profile.tsx                  # User profile view/edit
│       └── booking-success.tsx          # Confirmation screen (hidden from tabs)
│
├── components/                          # Reusable UI components
│   ├── app/                             # Feature-specific components
│   │   ├── AppointmentCard.tsx          # Card for displaying appointment
│   │   ├── Avatar.tsx                   # User avatar with initials
│   │   ├── Badge.tsx                    # Status/tag badge
│   │   ├── BottomNavBar.tsx             # Custom tab bar with icons
│   │   ├── ScreenContainer.tsx          # Safe area wrapper for screens
│   │   ├── AppButton.tsx                # App button variant
│   │   ├── AppCard.tsx                  # App card variant
│   │   ├── AppInput.tsx                 # App input variant
│   │   └── ...                          # Other app-specific components
│   └── ui/                              # Design system components
│       ├── Button.tsx                   # Primary button component
│       ├── Input.tsx                    # Text input component
│       ├── Card.tsx                     # Card container
│       ├── DateChip.tsx                 # Date display chip
│       ├── InputField.tsx               # Form input field with label
│       ├── PrimaryButton.tsx            # Styled primary button
│       ├── TimeSlotButton.tsx           # Time slot selection button
│       ├── TopAppBar.tsx                # Header with profile/back button
│       ├── StatusBanner.tsx             # Status message banner
│       ├── EmptyState.tsx               # Empty state placeholder
│       ├── collapsible.tsx              # Collapsible section component
│       ├── icon-symbol.tsx              # Icon symbol renderer
│       └── ...                          # Other design system components
│
├── services/                            # API layer (Supabase calls)
│   ├── api.ts                           # Supabase client initialization
│   ├── auth-service.ts                  # Authentication: login, signup, logout, session
│   ├── appointment-service.ts           # Appointments: CRUD, booking, cancellation
│   ├── mechanic-service.ts              # Mechanics: list, detail, profile update
│   ├── timeslot-service.ts              # Time slots: availability queries
│   └── notification-service.ts          # Notifications: fetch, mark as read
│
├── stores/                              # State management (Zustand)
│   ├── auth-store.ts                    # User auth state: login, logout, profile
│   ├── appointment-store.ts             # Appointments list and actions
│   ├── mechanic-store.ts                # Mechanics list with 5-min cache
│   ├── timeslot-store.ts                # Available time slots
│   └── notification-store.ts            # User notifications and unread count
│
├── hooks/                               # Custom React hooks
│   ├── use-auth.ts                      # Hook to access auth state from store
│   ├── use-theme.ts                     # Hook to access theme constants
│   ├── use-color-scheme.ts              # Platform-specific color scheme detection
│   ├── use-color-scheme.web.ts          # Web-specific color scheme
│   └── use-theme-color.ts               # Computed theme color hook
│
├── utils/                               # Utility functions
│   ├── date.ts                          # Date formatting helpers
│   ├── format.ts                        # String formatting (initials, phone, etc)
│   └── secure-storage.ts                # Platform-specific secure token storage
│
├── types/                               # TypeScript type definitions
│   └── models.ts                        # Domain models: User, Mechanic, Appointment, etc
│
├── constants/                           # Global constants
│   ├── theme.ts                         # Color palette, spacing, typography, radius
│   └── config.ts                        # App configuration constants
│
├── config/                              # Runtime configuration
│   └── env.ts                           # Environment variables (Supabase URL, keys)
│
├── assets/                              # Images, fonts, static files
│   └── images/                          # PNG, SVG images
│
├── mocks/                               # Mock data for testing/development
│
├── tests/                               # Test files
│   └── e2e/                             # End-to-end tests (Playwright)
│
├── scripts/                             # Node.js utility scripts
│   ├── reset-project.js                 # Reset app state
│   ├── seed.js                          # Seed database with test data
│   ├── check-env.js                     # Validate environment variables
│   ├── create-mechanic-auth-users.js    # Create mechanic auth accounts
│   ├── seed-mechanics-data.js           # Populate mechanic data
│   ├── setup-git-hooks.js               # Setup pre-commit hooks
│   ├── export-web.js                    # Build web version
│   └── sql/                             # SQL migration scripts
│
├── .expo/                               # Expo CLI cache (generated)
│
├── .github/                             # GitHub workflows
│   └── workflows/                       # CI/CD pipeline definitions
│
├── .planning/                           # Planning and analysis documents
│   └── codebase/                        # Architecture analysis (this file)
│
├── .vscode/                             # VS Code workspace settings
│
├── .eslintrc.js                         # ESLint configuration
│
├── .gitignore                           # Git ignore rules
│
├── tsconfig.json                        # TypeScript configuration
│
├── package.json                         # Dependencies and scripts
│
├── expo.json                            # Expo app configuration
│
└── README.md                            # Project documentation
```

## Directory Purposes

**app/:**
- Purpose: Screen components organized by route groups using expo-router file-based routing
- Contains: `.tsx` files matching route structure; no other logic
- Access pattern: `useRouter()` to navigate between routes
- Key files: `_layout.tsx` (route groups), `index.tsx` (root router), auth and client screens

**(auth):**
- Purpose: Authentication screens (login, register)
- Contains: Auth-related screens; wrapped in Stack nav
- Route structure: `/(auth)/login`, `/(auth)/register`
- Protected: Accessible only when `!isAuthenticated`

**(client):**
- Purpose: Main app screens for authenticated users
- Contains: Browse, bookings, notifications, profile screens
- Route structure: Tab-based navigation with 4 main tabs + hidden modals
- Protected: Accessible only when `isAuthenticated`

**components/:**
- Purpose: Reusable UI components organized by scope
- **ui/**: Design system components (Button, Input, Card, etc.) — generic, style-focused
- **app/**: Application-specific components (AppointmentCard, Avatar, TopAppBar) — feature-aware
- Usage: Imported in screens and other components

**services/:**
- Purpose: Data fetching and API abstraction layer
- Contains: Async functions wrapping Supabase calls
- Export pattern: Named exports (e.g., `export async function login()`)
- Errors: Thrown to caller; caught by store layer
- Return types: Typed domain models (User, Mechanic, Appointment, etc.)

**stores/:**
- Purpose: Centralized state management using Zustand
- Contains: Global stores for each domain area (auth, mechanics, appointments, etc.)
- Export pattern: Default export of hook (e.g., `useAuthStore`, `useMechanicStore`)
- Pattern: `create<Interface>((set, get) => ({...}))` with actions that mutate state
- Usage: Imported in components via `const { state, action } = useStore()`

**hooks/:**
- Purpose: Custom React hooks for reusable logic
- Contains: Thin wrappers around stores or platform APIs
- Export pattern: Named exports (e.g., `export function useAuth()`)
- Usage: Called in components to access state or functionality

**utils/:**
- Purpose: Pure utility functions with no dependencies on stores
- Contains: Formatting, date manipulation, storage access
- Access pattern: Direct import and call (e.g., `getInitials(name)`)

**types/:**
- Purpose: Central TypeScript type definitions and interfaces
- Contains: Domain models (User, Mechanic, Appointment, TimeSlot, Notification)
- Usage: Imported in services, stores, components for type safety
- Single file: `models.ts` — single source of truth for all data shapes

**constants/:**
- Purpose: Theme design tokens and configuration
- Contains: Color palette, typography scale, spacing system, border radius
- Usage: Imported in components for consistent styling (e.g., `colors.primary`, `spacing.md`)
- Centralization: All theme values in one file prevents style inconsistencies

**config/:**
- Purpose: Runtime environment configuration
- Contains: Environment variables like Supabase URL and anonymous key
- Access: `import { env } from '@/config/env'`
- Platform: Values come from Expo env or `.env` file

**scripts/:**
- Purpose: Node.js utility scripts for development and deployment
- Contains: Database seeding, environment setup, build scripts
- Execution: `npm run <script-name>` maps to scripts in `package.json`

**tests/e2e/:**
- Purpose: End-to-end test suite using Playwright
- Contains: Test scenarios that simulate real user flows
- Execution: `npm run e2e` runs all tests; `npm run e2e:ui` opens interactive UI

## Key File Locations

**Entry Points:**
- `app/_layout.tsx`: Root layout — initializes auth, loads fonts, sets up theme
- `app/index.tsx`: Root router — redirects authenticated/unauthenticated users
- `services/api.ts`: Supabase client initialization
- `package.json`: `main` field points to `expo-router/entry` (Expo entry point)

**Authentication:**
- `services/auth-service.ts`: Login, signup, logout, session recovery functions
- `stores/auth-store.ts`: Auth state (user, isAuthenticated, role) and login/logout actions
- `hooks/use-auth.ts`: Custom hook wrapping auth store selector
- `app/(auth)/_layout.tsx`: Stack nav for auth screens
- `app/(auth)/login.tsx`, `register.tsx`: Auth UI screens

**Core Logic:**
- `stores/*.ts`: All business logic wrapped in actions (fetchAll, book, cancel, etc.)
- `services/*.ts`: All API calls wrapped in typed functions
- `components/ui/`: Composable building blocks for screens
- `types/models.ts`: Domain models (single source of truth for data shapes)

**Styling & Theme:**
- `constants/theme.ts`: Color palette, typography, spacing, radius
- `constants/config.ts`: App-level configuration constants
- All components use `import { colors, spacing } from '@/constants/theme'`

**Testing:**
- `tests/e2e/`: Playwright end-to-end tests
- `mocks/`: Mock data for development and testing

## Naming Conventions

**Files:**
- `.tsx`: React components (screens, components)
- `.ts`: Non-component logic (services, stores, hooks, utilities, types)
- PascalCase: Component files (e.g., `Button.tsx`, `AppointmentCard.tsx`)
- camelCase: Logic files (e.g., `auth-service.ts`, `use-auth.ts`, `format.ts`)
- `_layout.tsx`: Route group layout (expo-router convention)
- `_` prefix: Layouts and hidden files (expo-router convention)
- `[paramName].tsx`: Dynamic route segments (e.g., `[mechanicId].tsx` for `/browse/:mechanicId`)

**Directories:**
- PascalCase: Feature directories in `app/` (e.g., `browse/`, `appointment/`)
- snake-case or lowercase: Utility directories (e.g., `services/`, `stores/`, `hooks/`, `utils/`)
- Grouped route names in parentheses: `(auth)`, `(client)` — create logical grouping without changing URL

**Exports:**
- Default exports: Zustand store hooks (e.g., `export const useAuthStore = create(...)`)
- Named exports: Service functions (e.g., `export async function login()`)
- Named exports: Utility functions (e.g., `export function getInitials()`)

**Variables & Functions:**
- camelCase: All variables, function names (e.g., `setUser()`, `fetchAll()`, `isAuthenticated`)
- UPPER_SNAKE_CASE: Constants (e.g., `LOGIN_TIMEOUT_MS`, `MECHANICS_CACHE_TTL_MS`)
- `use*` prefix: Custom hooks (e.g., `useAuth()`, `useMechanicStore()`)
- `is*` or `has*` prefix: Boolean state (e.g., `isLoading`, `isAuthenticated`, `hasError`)

## Where to Add New Code

**New Screen/Feature:**
- Create directory under `app/(client)/` or `app/(auth)` matching feature name
- Add `_layout.tsx` if the feature has multiple related screens
- Create screen `.tsx` files inside the feature directory
- Register screens in parent layout's `Tabs.Screen` or `Stack.Screen`
- Example: New feature "support" would be `app/(client)/support/index.tsx` with `_layout.tsx`

**New State/Domain (e.g., "payments"):**
- Add `stores/payment-store.ts` with Zustand store for domain state
- Add `services/payment-service.ts` with API functions
- Add domain types in `types/models.ts` (e.g., `interface Payment`, `type PaymentStatus`)
- Use pattern: `usePaymentStore()` → calls `paymentService.createPayment()` → updates store
- Example: Browse payments list: `const { payments, fetchAll } = usePaymentStore(); fetchAll();`

**New Component:**
- If reusable across features: Add to `components/ui/`
- If feature-specific: Add to `components/app/`
- Export as named export or default
- Accept props for data; use hooks to access global state

**Utilities:**
- Generic helpers (formatting, dates, math): Add to `utils/*.ts`
- Keep utilities pure (no store/API dependencies)
- Export as named functions
- Example: `export function formatPhoneNumber(phone: string): string`

**Custom Hook:**
- If accessing store state: Add to `hooks/use-*.ts`
- If accessing platform APIs: Add to `hooks/use-*.ts` with platform-specific variants (`.web.ts`, `.native.ts`)
- Always use `use*` naming prefix
- Example: `export function useAuth() { return useAuthStore((s) => ({ user: s.user, isAuthenticated: s.isAuthenticated })); }`

**Constants or Theme:**
- Colors, spacing, typography: Add to `constants/theme.ts`
- App-level config: Add to `constants/config.ts`
- Environment variables: Add to `config/env.ts`
- Use throughout codebase via `import { colors } from '@/constants/theme'`

**Service Functions:**
- Create `services/[domain]-service.ts` if it doesn't exist
- Add async function wrapping Supabase operation
- Handle errors (throw or return null based on operation type)
- Return typed response (domain model from `types/models.ts`)
- Use timeouts for critical operations (auth, profile)
- Example: `export async function updateUserProfile(id: string, data: Partial<User>): Promise<void>`

## Special Directories

**node_modules:**
- Purpose: npm dependencies
- Generated: Yes (from `package.json` and `package-lock.json`)
- Committed: No (in `.gitignore`)

**.expo:**
- Purpose: Expo CLI cache and metadata
- Generated: Yes (by `expo start`)
- Committed: No (in `.gitignore`)

**dist:**
- Purpose: Built web app output
- Generated: Yes (by `expo build:web` or `npm run vercel-build`)
- Committed: No (in `.gitignore`)

**test-results:**
- Purpose: Playwright test output and artifacts
- Generated: Yes (by `npm run e2e`)
- Committed: No (in `.gitignore`)

**.github/workflows:**
- Purpose: GitHub Actions CI/CD pipeline definitions
- Generated: No (manually created)
- Committed: Yes (controls deployments)

**.planning/codebase:**
- Purpose: Architecture analysis documents (this file)
- Generated: Yes (by gsd-map-codebase)
- Committed: Yes (reference for future changes)

---

*Structure analysis: 2026-08-07*
