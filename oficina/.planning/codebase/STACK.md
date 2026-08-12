# Technology Stack

**Analysis Date:** 2026-08-07

## Languages

**Primary:**
- TypeScript ~5.9.2 - All source code in `app/`, `services/`, `hooks/`, `components/`, `stores/`, `utils/`
- JavaScript - Build scripts in `scripts/`, configuration files

**Secondary:**
- SQL - Database migrations in `scripts/sql/` for Supabase schema management

## Runtime

**Environment:**
- Node.js 20 (via GitHub Actions workflows)
- Expo ~54.0.33 - React Native runtime for iOS, Android, and web platforms
- React Native 0.81.5 - Core mobile framework

**Package Manager:**
- npm - Lock file present at `package-lock.json`

## Frameworks

**Core:**
- React 19.1.0 - UI framework
- React Native 0.81.5 - Cross-platform mobile runtime
- Expo ~54.0.33 - Development platform for React Native

**Navigation:**
- expo-router ~6.0.23 - File-based routing for web and mobile (entry point configured in `package.json` as `expo-router/entry`)
- @react-navigation/native ~7.1.8 - Core navigation library
- @react-navigation/bottom-tabs ~7.4.0 - Bottom tab navigator
- @react-navigation/elements ~2.6.3 - Navigation utilities

**State Management:**
- zustand ^5.0.13 - Lightweight state store in `stores/`
- Supabase Auth - Session state management via `services/api.ts`

**Forms & Validation:**
- react-hook-form ^7.75.0 - Form state and validation
- zod ^4.4.3 - Schema validation and runtime type checking

**Utilities:**
- date-fns ^4.1.0 - Date formatting and manipulation
- react-native-url-polyfill ^3.0.0 - URL API support for React Native
- lucide-react-native ^1.14.0 - Icon library
- react-native-svg 15.12.1 - SVG rendering

**Testing:**
- @playwright/test ^1.60.0 - E2E testing configured in `playwright.config.ts`
- Test directory: `tests/e2e/`

**Build/Dev:**
- expo lint - Linting via `npm run lint`
- dotenv ^17.4.2 - Environment variable management in scripts
- eslint ^9.25.0 - Code linting
- eslint-config-expo ~10.0.0 - Expo-specific ESLint rules

**UI/Platform:**
- expo-splash-screen ~31.0.13 - Splash screen management
- expo-status-bar ~3.0.9 - Status bar styling
- expo-safe-area-context ~5.6.0 - Safe area insets
- expo-system-ui ~6.0.9 - System UI customization
- expo-symbols ~1.0.8 - Symbol rendering
- react-native-screens ~4.16.0 - Performance optimizations
- react-native-safe-area-context ~5.6.0 - Safe area handling
- react-native-gesture-handler ~2.28.0 - Native gesture handling
- react-native-reanimated ~4.1.1 - Smooth animations
- react-native-web ~0.21.0 - React Native for web
- expo-linear-gradient ~15.0.8 - Gradient component
- expo-image ~3.0.11 - Image handling

**Fonts & Assets:**
- @expo-google-fonts/inter ^0.4.2 - Inter font family
- @expo/vector-icons ^15.0.3 - Built-in icon sets

**Media:**
- expo-image-picker ~17.0.11 - Image/video selection
- expo-web-browser ~15.0.10 - Web browser integration
- expo-haptics ~15.0.8 - Haptic feedback
- expo-linking ~8.0.11 - Deep linking support
- expo-constants ~18.0.13 - App constants and configuration

**Performance:**
- react-native-worklets 0.5.1 - Worklet support for animations

## Key Dependencies

**Critical:**
- @supabase/supabase-js ^2.105.4 - Backend client for auth, database, and real-time sync (`services/api.ts`)
- expo ^54.0.33 - Development and build platform

**Infrastructure:**
- react-native-secure-store (via expo-secure-store ^55.0.14) - Secure credential storage for Android/iOS

## Configuration

**Environment:**
- Config file: `config/env.ts` - Loads Supabase credentials via `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- Example: `.env.example` documents required variables
- Build validation: `scripts/check-env.js` validates environment before build
- Web export: `scripts/export-web.js` handles Vercel build configuration

**Expo Configuration:**
- `app.json` - Expo app manifest with:
  - Platform-specific settings (iOS, Android, web)
  - Routing experiment enabled (`typedRoutes: true`)
  - React Compiler experiment enabled
  - Expo Router plugin configured
  - Splash screen plugin with dark mode support

**Build/Deployment:**
- `eas.json` - EAS Build configuration for mobile builds (development, staging, production channels)
- `vercel.json` - Vercel web deployment configuration with build command `npm run vercel-build`
- `playwright.config.ts` - E2E test configuration with web server startup on port 19007

**TypeScript:**
- `tsconfig.json` extends `expo/tsconfig.base` with:
  - Strict mode enabled
  - Path alias `@/*` mapped to project root
  - Includes `.expo/types/**/*.ts` and `expo-env.d.ts`

**Linting:**
- `eslint.config.js` - ESLint configuration using flat config with Expo preset

## Platform Requirements

**Development:**
- Node.js 20+
- npm (lockfile included)
- Expo CLI (`expo` commands via npm scripts)
- Playwright (for E2E tests)

**Production - Mobile:**
- EAS Build service (for iOS/Android builds)
- iOS 12+ (based on Expo 54 support matrix)
- Android 5.1+ (based on Expo 54 support matrix)

**Production - Web:**
- Vercel (primary deployment platform)
- Node.js 20+ runtime
- Web server with static file serving and SPA rewrites (configured in `vercel.json`)

---

*Stack analysis: 2026-08-07*
