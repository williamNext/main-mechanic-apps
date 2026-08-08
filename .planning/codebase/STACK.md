# Technology Stack

**Analysis Date:** 2026-08-07

## Languages

**Primary:**
- TypeScript 5.9.2 - Application code, all logic, components (`**/*.ts`, `**/*.tsx`)
- JavaScript - Build scripts and configuration files (`scripts/`, `*.config.js`)

**Secondary:**
- SQL - Supabase database schema, migrations, and stored procedures (`scripts/sql/`)
- CSS/JSX - Component styling via React Native StyleSheet and Expo components

## Runtime

**Environment:**
- Node.js 20 (required for build and scripts, validated in `.github/workflows/security-and-build.yml`)
- React Native 0.81.5 - Mobile runtime
- Expo 54.0.33 - Build, development, and deployment platform
- Web runtime via `expo-router` for Vercel deployment (`build:web` script)

**Package Manager:**
- npm (specified in CI/CD via `actions/setup-node@v4`)
- Lockfile: `package-lock.json` present (844KB, maintained)

## Frameworks

**Core:**
- React 19.1.0 - UI component library (`app/`, `components/`)
- React Native 0.81.5 - Cross-platform mobile runtime
- Expo 54.0.33 - Development and build tooling, entry point: `expo-router/entry`

**Routing:**
- Expo Router 6.0.23 - File-based routing (`app/(auth)/`, `app/(mechanic)/`)
- React Navigation 7.1.8 - Core navigation library
  - `@react-navigation/native` - Navigation container
  - `@react-navigation/bottom-tabs` - Tab-based navigation (mechanic app tabs)
  - `@react-navigation/elements` - Navigation UI elements

**State Management:**
- Zustand 5.0.13 - Global state (`stores/auth-store.ts`, `stores/appointment-store.ts`, etc.)
  - Auth state: `useAuthStore`
  - Appointment state: `useAppointmentStore`
  - Mechanic state: `useMechanicStore`
  - TimeSlot state: `useTimeSlotStore`
  - Notifications state: `useNotificationStore`

**Forms & Validation:**
- React Hook Form 7.75.0 - Form state and validation integration (`components/`, `app/`)
- Zod 4.4.3 - Runtime schema validation for form inputs and API responses

**Testing:**
- Playwright 1.60.0 (`@playwright/test` dev dependency) - E2E testing
  - Config: `playwright.config.ts`
  - Tests run on Chromium against web build on port 19006
  - Test directory: `tests/e2e/`

**Build/Dev:**
- ESLint 9.25.0 - Code linting
  - Config extends `eslint-config-expo@10.0.0`
  - Config file: `eslint.config.js`
- Expo Lint integration - runs via `npm run lint`
- dotenv 17.4.2 - Environment variable loading for scripts

## Key Dependencies

**Critical:**
- `@supabase/supabase-js` 2.105.4 - Supabase backend client (`services/api.ts`)
  - Handles auth, database queries, real-time subscriptions
  - Configured with AsyncStorage for mobile, automatic token refresh

**Async Storage & Persistence:**
- `@react-native-async-storage/async-storage` 2.2.0 - Persistent storage for auth tokens (non-web)
- Supabase auth configured to persist sessions via AsyncStorage

**Date & Time Handling:**
- `date-fns` 4.1.0 - Date manipulation and formatting
- `@react-native-community/datetimepicker` 8.4.4 - Native date/time picker UI component

**UI & Icons:**
- `@expo/vector-icons` 15.0.3 - Icon library via Expo
- `lucide-react-native` 1.14.0 - Additional icon set
- `expo-image` 3.0.11 - Optimized image component
- `expo-linear-gradient` 15.0.8 - Gradient backgrounds
- `@expo-google-fonts/inter` 0.4.2 - Inter typeface

**Navigation & Linking:**
- `react-native-gesture-handler` 2.28.0 - Gesture detection for navigation
- `react-native-reanimated` 4.1.1 - Animation library for navigation transitions
- `react-native-screens` 4.16.0 - Native navigation UI optimization
- `react-native-safe-area-context` 5.6.0 - Safe area layout management
- `expo-linking` 8.0.11 - Deep linking support
- `expo-web-browser` 15.0.10 - Web browser integration (OAuth flows)

**Other Utilities:**
- `react-native-svg` 15.12.1 - SVG rendering in React Native
- `react-native-url-polyfill` 3.0.0 - URL API polyfill for RN
- `react-native-worklets` 0.5.1 - JavaScript worklets for performance-critical code
- `react-native-web` 0.21.0 - Web compatibility layer for Expo web

**Development:**
- `@types/react` 19.1.0 - TypeScript definitions for React

## Configuration

**Environment:**
- **Client-side secrets** (loaded at build time via Expo inlining):
  - `EXPO_PUBLIC_SUPABASE_URL` - Supabase project URL (required)
  - `EXPO_PUBLIC_SUPABASE_ANON_KEY` - Supabase anonymous key (required)
- **Validation**: `npm run env:check` runs `scripts/check-env.js` to fail early on missing values
- **.env file**: Present (`.env`) and example provided (`.env.example`). Secrets managed via environment vars in CI/CD.

**TypeScript:**
- `tsconfig.json` extends `expo/tsconfig.base`
- `strict: true` - Strict type checking enabled
- Path alias: `@/*` maps to root directory for imports

**Build:**
- Expo build via `expo start` (development)
- Web export via `node scripts/export-web.js` (production web build)
- Vercel deployment via `npm run vercel-build`

## Platform Requirements

**Development:**
- Node.js 20+
- npm with dependencies installed
- Native SDKs: Android SDK (for `android` command), Xcode (for `ios` command)
- Expo CLI (installed as dependency)
- Local Supabase instance or remote project with credentials

**Production:**
- **Mobile**: Deployed via EAS (Expo Application Services) or built locally
  - Requires build validation (CI via GitHub Actions: `security-and-build.yml`)
- **Web**: Deployed to Vercel or equivalent Node.js hosting
  - Entry point: exported web build from `scripts/export-web.js`
  - Requires `EXPO_PUBLIC_SUPABASE_*` env vars at runtime

---

*Stack analysis: 2026-08-07*
