# Coding Conventions

**Analysis Date:** 2026-08-07

## Naming Patterns

**Files:**
- React components: PascalCase (e.g., `AppButton.tsx`, `MechanicCard.tsx`)
- Hooks: kebab-case (e.g., `use-theme.ts`, `use-auth.ts`)
- Services: kebab-case (e.g., `auth-service.ts`, `appointment-service.ts`)
- Utilities: kebab-case (e.g., `format.ts`, `date.ts`)
- Stores: kebab-case (e.g., `auth-store.ts`, `mechanic-store.ts`)
- Pages/Screens in Expo Router: kebab-case with bracket notation for groups (e.g., `(auth)`, `[id].tsx`)
- Some utility components use kebab-case filenames but export PascalCase components (e.g., `themed-text.tsx` exports `ThemedText`)

**Functions:**
- Regular functions: camelCase (e.g., `login()`, `formatPhone()`, `getInitials()`)
- React components (function exports): PascalCase (e.g., `function AppButton()`, `function MechanicCard()`)
- Hooks: camelCase starting with `use` (e.g., `useAppTheme()`, `useAuthStore()`)
- Private/helper functions: camelCase (e.g., `mapAppointmentRow()`, `isMissingBookingRpcError()`)

**Variables:**
- Regular variables: camelCase (e.g., `isLoading`, `errorMsg`, `mechanicIds`)
- State variables from hooks: camelCase (e.g., `phone`, `password`, `isSubmitting`)
- TypeScript types/unions: lowercase (e.g., `type Role = 'admin' | 'mechanic' | 'client'`)

**Types:**
- Interfaces: PascalCase (e.g., `AuthState`, `MechanicCardProps`, `BookAppointmentInput`)
- Props interfaces: Suffix with `Props` (e.g., `MechanicCardProps`, `AppButtonProps`)
- Type aliases: lowercase (e.g., `type Role`, `type AppointmentStatus`)

**Constants:**
- Module-level constants: SCREAMING_SNAKE_CASE (e.g., `AUTH_TIMEOUT_MS`, `PROFILE_TIMEOUT_MS`, `LOGIN_TIMEOUT_MS`)
- Theme/config constants: camelCase objects (e.g., `colors`, `spacing`, `typography`)

## Code Style

**Formatting:**
- No Prettier configuration found — relies on ESLint for formatting
- Uses Expo's ESLint flat config (`eslint-config-expo`)
- Default formatting is enforced through linting

**Linting:**
- Framework: ESLint v9.25.0 with `eslint-config-expo`
- Config location: `eslint.config.js`
- Commands:
  ```bash
  npm run lint    # Run linting
  ```
- ESLint is configured to ignore `dist/*` directory

**TypeScript:**
- Strict mode enabled (`"strict": true` in `tsconfig.json`)
- Path aliases configured: `@/*` maps to project root
- Async functions always have explicit return types
- Function parameters and return types always annotated

## Import Organization

**Order:**
1. React/React Native imports
2. Expo imports
3. Third-party library imports
4. Internal absolute imports using `@/` alias
5. Local relative imports (rare)

**Example from `app/_layout.tsx`:**
```typescript
import { useEffect, useRef } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import * as SplashScreen from 'expo-splash-screen';
import { Inter_400Regular, ... } from '@expo-google-fonts/inter';
import { supabase } from '@/services/api';
import { useAuthStore } from '@/stores/auth-store';
import * as authService from '@/services/auth-service';
import { useAppTheme } from '@/hooks/use-theme';
```

**Path Aliases:**
- `@/*` — Refers to project root; use for all imports outside current directory

## Error Handling

**Patterns:**
- For Supabase operations: Check error and throw immediately
  ```typescript
  const { data, error } = await supabase.from('table').select('*');
  if (error) throw error;
  ```
- For async service calls: Use try/catch with `.catch()` for error logging
  ```typescript
  try {
    const user = await authService.login(email, password);
    // handle success
  } catch (error) {
    console.error('Login error:', error);
    // handle error
  }
  ```
- Custom error type guards for complex errors:
  ```typescript
  function isMissingBookingRpcError(error: unknown): boolean {
    const candidate = error as { code?: string; message?: string; details?: string };
    // Check error properties
    return candidate.code === 'PGRST202' || (text.includes('function'));
  }
  ```
- Errors stored in state as strings (e.g., `error: string | null` in Zustand stores)
- User-facing error messages should be Portuguese (pt-BR) when displayed to UI

## Logging

**Framework:** Console methods (`console.log`, `console.error`)

**Patterns:**
- Use `console.error()` for errors:
  ```typescript
  console.error('Initial session load error:', error);
  ```
- Use `console.log()` for debug information, wrapped in development guard:
  ```typescript
  if (typeof __DEV__ !== 'undefined' && __DEV__) {
    console.log(`[auth] login route replace queued in ${Date.now() - routeStart}ms`);
  }
  ```
- Bracket notation for categorization: `[auth]`, `[api]`, etc. prefixes categorize related logs

**Guidelines:**
- Only log in development or for errors in production
- Use `__DEV__` guard for non-essential logs
- Categorize logs with bracket prefix for easy filtering

## Comments

**When to Comment:**
- Explain *why*, not *what* (code should be self-documenting)
- Non-obvious business logic or workarounds
- Important state management side effects
- Type definitions at top of files:
  ```typescript
  // Domain models — single source of truth for all data shapes
  export type Role = 'admin' | 'mechanic' | 'client';
  ```

**JSDoc/TSDoc:**
- Not consistently used in codebase
- Inline comments preferred for explanations

## Function Design

**Size:** 
- Prefer smaller focused functions
- Helper functions extracted to module-level (e.g., `mapAppointmentRow()`, `isMissingBookingRpcError()`)

**Parameters:**
- Destructure objects when possible in component props
- Use interfaces for complex parameter objects
- Keep parameter count low (3 or fewer)

**Return Values:**
- Always annotate with explicit type
- Async functions return `Promise<Type>`
- Return early for guard clauses:
  ```typescript
  if (!email || !password) {
    throw new Error('Email and password are required');
  }
  ```

## Module Design

**Exports:**
- Named exports for functions and components (preferred)
- Default export for screen/page components in Expo Router
- Example from `components/app/AppButton.tsx`:
  ```typescript
  export function AppButton({ ... }: AppButtonProps) {
    // implementation
  }
  ```

**Barrel Files:**
- Not extensively used; imports are direct from source files
- Import services with namespace: `import * as authService from '@/services/auth-service'`

## Zustand Store Patterns

**Store Definition:**
```typescript
interface AuthState {
  user: User | Mechanic | null;
  isLoading: boolean;
  // state properties
  
  loginByPhone: (phone: string, password: string) => Promise<boolean>;
  // action methods
}

export const useAuthStore = create<AuthState>((set, get) => ({
  // initial state
  user: null,
  isLoading: false,
  
  // actions
  loginByPhone: async (phone, password) => {
    // implementation
  },
}));
```

**Usage in Components:**
```typescript
const { user, isLoading, loginByPhone } = useAuthStore();
```

## StyleSheet Patterns

- Use `StyleSheet.create()` for all styles in React Native components
- Style object naming: lowercase (base, row, text, etc.)
- Styles defined at bottom of component file
- Use theme constants for spacing, colors, typography:
  ```typescript
  import { FontSize, FontWeight, Spacing } from '@/constants/theme';
  
  const styles = StyleSheet.create({
    base: {
      minHeight: 54,
      paddingHorizontal: Spacing.md,
      borderRadius: BorderRadius.md,
    },
  });
  ```

---

*Convention analysis: 2026-08-07*
