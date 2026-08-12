# Codebase Structure

**Analysis Date:** 2026-08-07

## Directory Layout

```
admin/
├── app/                    # Expo Router pages and layouts (routing entry point)
│   ├── _layout.tsx        # Root layout: initialization, auth, navigation
│   ├── index.tsx          # Redirect based on auth state
│   ├── (auth)/            # Auth route group (unauthenticated only)
│   │   ├── _layout.tsx    # Auth layout container
│   │   └── login.tsx      # Login screen (not shown in glob; implied)
│   └── (admin)/           # Admin route group (protected)
│       ├── _layout.tsx    # Admin layout with role guard
│       ├── dashboard.tsx  # Main dashboard screen
│       ├── mechanics/     # Mechanics management
│       │   ├── index.tsx  # Mechanics list screen
│       │   └── [id].tsx   # Mechanic detail screen
│       ├── appointments.tsx
│       ├── finance.tsx
│       ├── reports.tsx
│       └── settings.tsx
│
├── stores/                # Global state management (Zustand)
│   ├── auth-store.ts      # User auth and session state
│   └── admin-store.ts     # Admin dashboard and data state
│
├── services/              # API integration layer
│   ├── api.ts            # Supabase client initialization
│   ├── auth-service.ts   # Auth operations (login, logout, profile)
│   └── admin-service.ts  # Admin data operations (fetch, create, delete)
│
├── types/                 # TypeScript type definitions
│   └── models.ts         # Data models for auth, admin, appointments
│
├── components/            # React components (reusable UI)
│   ├── admin/            # Admin-specific components
│   │   └── AdminShell.tsx # Screen wrapper component
│   └── ui/               # Generic UI components
│       └── AdminControls.tsx # Button, card, input, chart components
│
├── features/              # Feature-specific logic and utilities
│   └── admin/            # Admin feature utilities
│       └── filter-utils.ts # Filter validation, defaults, normalization
│
├── hooks/                 # Custom React hooks
│   ├── use-auth.ts       # Auth state convenience hook
│   ├── use-theme.ts      # Theme/color scheme hook
│   ├── use-color-scheme.ts (native)
│   ├── use-color-scheme.web.ts
│   └── use-theme-color.ts
│
├── utils/                 # General utility functions
│   ├── format.ts         # Number, date, string formatting
│   └── date.ts           # Date utilities (implied by imports)
│
├── constants/             # App constants and configuration
│   ├── config.ts         # App name, specialties, working hours
│   └── theme.ts          # Colors, typography (implied by imports)
│
├── config/                # Environment and build configuration
│   └── env.ts            # Typed env variables
│
├── assets/                # Images, icons, static resources
│   └── images/           # PNG/SVG image files
│
├── scripts/               # Node.js build and setup scripts
│   ├── reset-project.js
│   ├── setup-git-hooks.js
│   ├── check-env.js
│   ├── export-web.js
│   ├── seed.js
│   ├── create-mechanic-auth-users.js
│   ├── seed-mechanics-data.js
│   └── sql/              # SQL migration files
│
├── .github/               # GitHub configuration
│   └── workflows/        # CI/CD workflows
│
├── .agents/               # Agent skills and rules
│   ├── AGENT_RULES.md    # GSD agent guidelines
│   └── skills/           # Skill libraries
│
├── .planning/             # GSD planning documents
│   └── codebase/         # Codebase analysis (this directory)
│
├── .vscode/               # VS Code settings
├── .githooks/             # Git hooks
├── .Jules/                # Theme/design system
├── .expo/                 # Expo build cache
│
├── .gitignore
├── .env.example           # Environment variable template
├── .env                   # Local environment variables (not committed)
├── tsconfig.json          # TypeScript configuration
├── package.json           # Dependencies and scripts
├── eas.json               # Expo Application Services config
├── vercel.json            # Vercel deployment config
├── eslint.config.js       # Linting configuration
└── schema.sql             # Database schema (reference/backup)
```

## Directory Purposes

**app/:**
- Purpose: Expo Router routing and screen components
- Contains: Page components, layout wrappers, route groups
- Key files: `_layout.tsx` files define route structure and guards; `.tsx` files are screens

**stores/:**
- Purpose: Global state management with Zustand
- Contains: State interfaces, actions, computed selectors
- Key files: `auth-store.ts` (session), `admin-store.ts` (data)

**services/:**
- Purpose: API integration and data access
- Contains: Supabase client, typed API methods, error wrapping
- Key files: `api.ts` (client init), `auth-service.ts` (auth ops), `admin-service.ts` (data ops)

**types/:**
- Purpose: TypeScript interfaces and type definitions
- Contains: Data models shared across layers
- Key files: `models.ts` (all app types)

**components/:**
- Purpose: Reusable React components
- Contains: UI components, layout wrappers, styled blocks
- Key files: `AdminShell.tsx` (screen wrapper), `AdminControls.tsx` (UI library)

**features/:**
- Purpose: Feature-specific business logic and utilities
- Contains: Filter logic, validators, helpers scoped to a feature
- Key files: `filter-utils.ts` (filter normalization and defaults)

**hooks/:**
- Purpose: Custom React hooks
- Contains: State access wrappers, platform-specific logic, lifecycle helpers
- Key files: `use-auth.ts` (auth convenience hook)

**utils/:**
- Purpose: General-purpose utilities
- Contains: Formatting, parsing, calculations, helpers
- Key files: `format.ts` (date/number formatting)

**constants/:**
- Purpose: App-wide configuration and hardcoded values
- Contains: Business constants, theme values, working hours
- Key files: `config.ts` (app constants), `theme.ts` (colors)

**config/:**
- Purpose: Build-time and runtime configuration
- Contains: Environment variables, feature flags
- Key files: `env.ts` (typed env variables)

## Key File Locations

**Entry Points:**
- `app/_layout.tsx`: Root component, app initialization, auth bootstrap
- `app/index.tsx`: Conditional routing based on auth state
- `expo-router/entry`: Configured in `package.json` main field

**Configuration:**
- `tsconfig.json`: TypeScript config with path aliases (`@/*` → `./`)
- `package.json`: Dependencies, build scripts, app metadata
- `eas.json`: Expo app deployment settings
- `eslint.config.js`: Linting rules

**Core Logic:**
- `stores/auth-store.ts`: Auth state, login/logout
- `stores/admin-store.ts`: Dashboard/mechanics data, filters
- `services/auth-service.ts`: Supabase auth operations
- `services/admin-service.ts`: RPC and edge function calls

**Testing:**
- `playwright.config.js` (implied): E2E test config
- `.github/workflows/`: CI/CD pipeline definitions

## Naming Conventions

**Files:**
- Screens in `app/`: lowercase with underscores for layouts (`_layout.tsx`), kebab-case for route groups `(auth)`, slug format for dynamic `[id]`
- Components in `components/`: PascalCase (`AdminShell.tsx`, `AdminControls.tsx`)
- Services: noun + `-service.ts` (e.g., `auth-service.ts`, `admin-service.ts`)
- Hooks: `use-` prefix (`use-auth.ts`, `use-theme.ts`)
- Utilities: descriptive name (`format.ts`, `filter-utils.ts`)

**Directories:**
- Feature directories: plural when grouping related logic (`services/`, `stores/`)
- Singular for specific domains when using route groups: `(auth)`, `(admin)` in app/
- Lowercase for utility directories: `hooks/`, `utils/`, `types/`, `constants/`, `config/`

## Where to Add New Code

**New Feature (e.g., Reports Enhancement):**
- Screen: `app/(admin)/[feature-name].tsx` or `app/(admin)/[feature-name]/index.tsx`
- Store logic: Add actions to `stores/admin-store.ts` or create `stores/[feature]-store.ts` if large
- API methods: Add to `services/admin-service.ts` or create `services/[feature]-service.ts`
- Types: Extend `types/models.ts` with new interfaces
- Components: Create under `components/admin/` or `components/ui/` as needed

**New Utility or Helper:**
- Pure functions: `utils/[domain].ts`
- Form validation or filters: `features/admin/[name]-utils.ts`
- Custom hooks: `hooks/use-[name].ts`

**New Service Integration (e.g., Analytics):**
- Client init: `services/[provider].ts`
- Service wrapper: `services/[provider]-service.ts`
- Store integration: Create dedicated store or extend existing one
- Types: Add to `types/models.ts` under new interface

**UI Components:**
- Reusable UI atoms: Consolidate in `components/ui/AdminControls.tsx` (barrel export)
- Feature-specific components: `components/admin/[FeatureName].tsx`
- Layout wrappers: `components/admin/AdminShell.tsx`

## Special Directories

**node_modules/:**
- Purpose: Package dependencies (installed by npm)
- Generated: Yes (via npm install)
- Committed: No (.gitignore)

**.expo/:**
- Purpose: Expo CLI cache and web build output
- Generated: Yes (by expo CLI)
- Committed: No (.gitignore)

**dist/:**
- Purpose: Web export build output
- Generated: Yes (by export-web.js script)
- Committed: No (.gitignore)

**.github/workflows/:**
- Purpose: CI/CD automation (GitHub Actions)
- Generated: No (manually configured)
- Committed: Yes

**.agents/skills/:**
- Purpose: GSD agent skills and best practices
- Generated: No (manually configured)
- Committed: Yes (reference for maintainers)

**.planning/codebase/:**
- Purpose: GSD codebase analysis documents
- Generated: Yes (by gsd-map-codebase)
- Committed: Yes (reference for planning)

---

*Structure analysis: 2026-08-07*
