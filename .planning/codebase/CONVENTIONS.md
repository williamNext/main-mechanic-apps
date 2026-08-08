# Coding Conventions

**Analysis Date:** 2026-08-07

## Naming Patterns

**Files:**
- Services: `[name]-service.ts` — `services/auth-service.ts`, `services/appointment-service.ts`
- Stores (Zustand): `[name]-store.ts` — `stores/auth-store.ts`, `stores/appointment-store.ts`
- Custom Hooks: `use-[name].ts` — `hooks/use-auth.ts`, `hooks/use-theme.ts`
- Components: PascalCase — `components/app/AppButton.tsx`, `components/ui/Button.tsx`
- Types/Models: Centralized in `types/models.ts`
- Routes/Screens: PascalCase in app directory structure — `app/(auth)/login.tsx`, `app/(mechanic)/agenda.tsx`

**Functions:**
- camelCase for all function names
- Async operations use `async`/`await` pattern
- Helper functions prefixed with action descriptor: `mapAppointmentRow()`, `isMissingBookingRpcError()`, `withTimeout()`, `timed()`
- Service functions describe data operations: `getUserById()`, `createAppointment()`, `cancelMechanicAppointment()`

**Variables & Constants:**
- camelCase for all variable names: `profileRequestId`, `isAuthenticated`, `mechanicIds`
- UPPER_SNAKE_CASE for module-level constants: `AUTH_TIMEOUT_MS`, `LOGIN_TIMEOUT_MS`, `PROFILE_TIMEOUT_MS` (located in service/store files)
- Boolean flags use `is` prefix: `isAuthenticated`, `isLoading`, `isActive`, `isMechanic`, `isAdmin`

**Types:**
- Type aliases use PascalCase: `type Role = 'admin' | 'mechanic' | 'client'`
- Interface names use PascalCase: `interface AuthState`, `interface ButtonProps`, `interface Appointment`
- Input types suffixed with `Input`: `BookAppointmentInput`, `CompleteAppointmentInput`
- Props interfaces suffixed with `Props`: `ButtonProps`, `AppButtonProps`

## Code Style

**Formatting:**
- No explicit Prettier config detected — inferred from codebase: 2-space indentation
- ESLint configuration via Expo (eslint-config-expo)
- TypeScript strict mode enabled in `tsconfig.json`

**Linting:**
- Tool: ESLint with `eslint-config-expo` (flat config)
- Config: `eslint.config.js`
- Ignored: `dist/*` directory
- Run: `npm run lint`

**Import Organization:**
1. External dependencies (React, React Native, third-party packages)
2. Supabase API client
3. Local services (`@/services/*`)
4. Local stores (`@/stores/*`)
5. Local types (`@/types/*`)
6. Local hooks (`@/hooks/*`)
7. Local constants/utilities

**Path Aliases:**
- `@/*` maps to project root — allows imports like `@/services/auth-service`, `@/types/models`, `@/hooks/use-theme`
- Configured in `tsconfig.json`

## Error Handling

**Validation Errors:**
- Throw descriptive `Error` objects with Portuguese error messages
- Example: `throw new Error('E-mail e senha sao obrigatorios')`
- Check prerequisites before operations: `if (!email || !password) throw new Error('...')`

**API/RPC Errors:**
- After Supabase queries, check response structure:
  ```typescript
  const { data, error } = await supabase.from('table').select();
  if (error) throw error;
  ```
- Use helper predicates to classify errors: `isMissingBookingRpcError()` (`services/appointment-service.ts:12-20`)
- Wrap Supabase calls with `withTimeout()` for network robustness

**Async Error Handling:**
- Use try/catch blocks in store actions
- Log errors to console: `console.error('Erro ao carregar sessão inicial:', error)`
- Set error state in store for UI feedback: `set({ error: e instanceof Error ? e.message : 'Fallback message' })`
- Always call cleanup in `finally` blocks

**Timeouts:**
- Long operations wrapped with `withTimeout()` helper function (`services/auth-service.ts:9-21`)
- Timeout values defined as constants (e.g., `AUTH_TIMEOUT_MS = 15000`)
- Error message passed to `withTimeout()` for context

## Logging

**Framework:** Console-based (no external logger)

**Patterns:**
- Development debug logs use conditional: `if (isDev) console.log(...)`
- Dev logs tagged with context in brackets: `console.log('[auth] message here')`
- Error logs always use `console.error()`: `console.error('Erro ao carregar sessão inicial:', error)`
- No production logging via console — remove/minimize in future

**Timing Instrumentation:**
- Use `timed()` helper to measure task duration and log completion/failure (`services/auth-service.ts:23-33`)
- Output includes operation name and duration in milliseconds

## Comments

**When to Comment:**
- Explain non-obvious business logic or constraints
- Mark TODO/FIXME for known issues
- Rare in this codebase — code is self-documenting through clear naming and structure

**JSDoc/TSDoc:**
- Not consistently used
- Type definitions via TypeScript interfaces serve as documentation

## Function Design

**Size:**
- Small, focused functions (most services functions < 30 lines)
- Helper functions extracted for reuse: `mapAppointmentRow()` (15 lines) handles appointment data mapping

**Parameters:**
- Use object destructuring for multiple related parameters
- Input types as interfaces: `BookAppointmentInput`, `CompleteAppointmentInput`
- Optional fields marked with `?` in interface definitions

**Return Values:**
- Explicit return types on all async functions
- Generic types for reusable utilities: `withTimeout<T>(...): Promise<T>`
- Null returns for "not found" cases (not throwing)
- Promise types for async operations

## Module Design

**Exports:**
- Named exports for functions and types: `export async function login(...)`, `export type Role = ...`
- Services export functions directly (functional approach, not class-based)
- Stores export factory via `create()` from Zustand

**Barrel Files:**
- Used in `types/models.ts` — single file exports all domain models
- Not used elsewhere; imports are specific to source files

**State Management Pattern (Zustand):**
- Store defined with `create<StateInterface>((set, get) => ({ ... }))`
- State includes data fields and action methods
- Actions use `set()` to update state immutably
- Complex state updates extract logic to helper functions (e.g., `setLoadingState()` in `stores/auth-store.ts:26-38`)

## Component Patterns

**React Components:**
- Functional components with TypeScript
- Props destructured in function signature
- Props interface defined above component
- Default values in props destructuring

**Styling:**
- React Native `StyleSheet.create()` for style objects
- Theme colors via `useAppTheme()` hook
- Variant pattern for style variations:
  ```typescript
  const variantStyles: Record<ButtonVariant, ViewStyle> = {
    primary: { ... },
    secondary: { ... },
    ...
  };
  ```
- Spacing/sizing constants imported from `@/constants/theme`

**Accessibility:**
- React Native components include `accessibilityRole`, `accessibilityState`, `accessibilityLabel`
- Example: `components/ui/Button.tsx:61-63`

## Database Interaction

**Supabase RPC Calls:**
- Parameter names prefixed with `p_`: `p_timeslot_id`, `p_vehicle_info`, `p_notes`
- Null values explicitly passed: `?? null`
- Array results unwrapped: `const row = Array.isArray(data) ? data[0] : data`

**Data Mapping:**
- Separate mapper functions transform database rows to domain models
- Example: `mapAppointmentRow()` (`services/appointment-service.ts:22-51`) normalizes snake_case DB fields to camelCase

---

*Convention analysis: 2026-08-07*
