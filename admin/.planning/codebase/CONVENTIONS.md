# Coding Conventions

**Analysis Date:** 2026-08-07

## Naming Patterns

**Files:**
- React/TSX components: `PascalCase.tsx` (e.g., `AdminShell.tsx`, `StatusPill.tsx`)
- Service files: `camelCase.ts` (e.g., `auth-service.ts`, `admin-service.ts`)
- Hooks: `use-kebab-case.ts` (e.g., `use-auth.ts`, `use-theme.ts`)
- Store files: `kebab-case-store.ts` (e.g., `auth-store.ts`, `admin-store.ts`)
- Type/model files: `models.ts` in a `types/` directory
- Utility files: `kebab-case.ts` (e.g., `csv.ts`, `date.ts`, `format.ts`)

**Functions:**
- camelCase for all function names (e.g., `loginByIdentifier`, `fetchMechanics`, `handleCreateMechanic`)
- Async functions use `async` keyword and await pattern
- Event handlers prefixed with `on` or `handle` (e.g., `onPress`, `onChangeText`, `handleCreateMechanic`)
- Internal helper functions prefixed with underscore if truly private: `_normalizeInput`

**Variables:**
- camelCase for all variables and parameters (e.g., `isAuthenticated`, `userData`, `mechanicId`)
- State variable pairs use clear names (e.g., `isLoading`, `error`, `selectedIds`)
- Boolean variables prefixed with `is`, `has`, `can`, `should` (e.g., `isActive`, `isAdmin`, `hasError`)

**Types:**
- PascalCase for interfaces and type names (e.g., `AdminUser`, `AuthState`, `AdminFilters`)
- Union types and literals use `camelCase` or `snake_case` based on context (e.g., `'admin' | 'mechanic' | 'client'` for roles)
- Database column mappings use snake_case in API responses, converted to camelCase in client code (e.g., `avatar_url` → `avatarUrl`)

## Code Style

**Formatting:**
- No explicit Prettier config; uses ESLint auto-formatting
- VSCode configured with `source.fixAll`, `source.organizeImports`, and `source.sortMembers` on save
- Indentation: 2 spaces (standard for Node/React)
- Line length: No strict limit but aim for readability (~120 characters practical)

**Linting:**
- ESLint: v9.25.0
- Config: `eslint-config-expo` v10.0.0 (Expo's recommended preset)
- Configuration file: `eslint.config.js` (flat config format)
- Only ignores `dist/*` directory

**TypeScript:**
- Version: 5.9.2
- `strict: true` enabled in `tsconfig.json`
- Base config extends `expo/tsconfig.base`
- Path alias `@/*` maps to project root (enables imports like `@/services/auth-service`)

## Import Organization

**Order:**
1. External dependencies (React, React Native, third-party libraries)
2. Internal services and utilities (with `@/` path alias)
3. Hooks (from `@/hooks`)
4. Components (from `@/components`)
5. Types (from `@/types`)
6. Store imports (from `@/stores`)
7. Constants and local utilities

**Path Aliases:**
- `@/*` — Maps to project root directory
- Used consistently throughout: `@/services/api`, `@/hooks/use-auth`, `@/components/ui/AdminShell`, `@/types/models`

## Error Handling

**Patterns:**
- Service functions throw errors for caller to handle (see `services/admin-service.ts`)
- Helper function `ensureData<T>()` wraps error checking and rethrows with user-friendly messages in Portuguese
- Zustand stores use try/catch blocks for async actions, storing error state in store
- Components catch login/validation errors and display them in local state (e.g., `validationError`)
- Timeout management: `withTimeout<T>()` utility wraps promises with timeout rejection and cleanup
- Prefer throwing custom `Error` objects with descriptive messages over silent failures

**Error Messages:**
- User-facing messages in Portuguese (e.g., "Acesso administrativo obrigatório", "Telefone inválido")
- Console logging for debugging: `console.error()` with context (e.g., `console.error('loginByIdentifier failed:', error)`)

## Logging

**Framework:** `console` (standard Node/browser console methods)

**Patterns:**
- Minimal logging in production code
- `console.error()` for error tracking in async operations (stores, services)
- No structured logging framework; errors logged with context labels (e.g., `'loginByIdentifier failed:', error`)

## Comments

**When to Comment:**
- Very sparingly; code should be self-documenting
- Use comments only for non-obvious business logic or complex state transitions
- Example from codebase: `// Create mechanic modal state` — only one comment found in entire app/components tree

**JSDoc/TSDoc:**
- Not used in this codebase
- No function documentation comments observed

## Function Design

**Size:** 
- Most functions 10-50 lines
- Async service functions are typically short, calling single database RPC or API endpoint
- Components can exceed 100 lines but organize state logically

**Parameters:**
- Prefer single object parameter over multiple positional parameters for functions with multiple options
- Use destructuring for object parameters (e.g., `{ from, to }` in filter functions)
- Generic type parameters used for type safety (e.g., `ensureData<T>()`, `withTimeout<T>()`)

**Return Values:**
- Async functions return typed results (`Promise<T>`)
- Service functions return data or throw errors (never return `null` to indicate error)
- Components return JSX/React elements
- Utility functions return data or throw errors; no special error objects

## Module Design

**Exports:**
- Named exports preferred for services, utilities, and hooks
- Default exports for pages/screens (e.g., `export default function LoginScreen()`)
- Store exports: `useAuthStore`, `useAdminStore` (named exports for Zustand instances)

**Barrel Files:**
- `components/ui/AdminControls.tsx` exports multiple UI components as named exports
- Example: Imports like `{ ActionButton, DataTable, EmptyState, LoadingState, PaginationBar, Panel, SearchField, SectionHeader, StatusPill }` from single file

## Validation

**Patterns:**
- Manual validation with string methods and regex (no Zod schema in use despite being in package.json)
- Validation in components before API calls (e.g., phone length check, email regex, required field checks)
- Phone validation: extract digits, check length (11+ for Brazil), format to E.164
- Email validation: simple regex `/^[^\s@]+@[^\s@]+\.[^\s@]+$/`
- Password validation: minimum 6 characters
- Validation errors stored in component state and displayed inline

## React/React Native Patterns

**Hooks:**
- Standard hooks: `useState`, `useEffect`, `useMemo`, `useRouter`, `usePathname`
- Custom hooks: `useAuth()`, `useColorScheme()`, `useTheme()`
- Hook dependencies carefully listed in dependency arrays

**Component Props:**
- Props defined inline with destructuring (e.g., `{ title, children }`)
- No PropTypes; rely on TypeScript for type safety
- Prefer positional destructuring over spread props

**State Management:**
- Zustand for global state (`useAuthStore`, `useAdminStore`)
- Local state with `useState` for component-level UI state (forms, modals, selections)
- Computed values with `useMemo` to prevent unnecessary re-renders

**Styling:**
- `StyleSheet.create()` from React Native for component styles
- Inline styles for dynamic values (e.g., `style={[styles.navItem, active && styles.navItemActive]}`)
- Style object names reflect element structure (e.g., `navbar`, `navItem`, `navItemActive`)
- Hard-coded colors (#101828, #667085, #b42318, etc.) used throughout

## Constants

**Pattern:** UPPER_SNAKE_CASE

**Examples:**
- `AUTH_TIMEOUT_MS = 15000`
- `PROFILE_TIMEOUT_MS = 15000`
- `LOGIN_TIMEOUT_MS = 15000`
- `DELETE_CONFIRMATION_WORD = 'EXCLUIR'`

---

*Convention analysis: 2026-08-07*
