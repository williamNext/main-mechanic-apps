# Technology Stack

**Analysis Date:** 2026-08-07

## Languages

**Primary:**
- TypeScript 5.9.2 - Application source code, configuration files, and services

**Secondary:**
- JavaScript - Build scripts (`scripts/*.js`)

## Runtime

**Environment:**
- Node.js - Development and build environment
- Expo Runtime (~54.0.33) - Cross-platform app runtime (iOS, Android, Web)
- React Native 0.81.5 - Core framework for native UI components

**Package Manager:**
- npm - Version from `package-lock.json` (locked 2024-05-24)
- Lockfile: `package-lock.json` present (854 KB)

## Frameworks

**Core:**
- React 19.1.0 - UI component library (web)
- React Native 0.81.5 - Native UI framework
- Expo ~54.0.33 - Cross-platform development platform
- Expo Router ~6.0.23 - File-based routing for React Native

**Navigation:**
- @react-navigation/native ^7.1.8 - Navigation infrastructure
- @react-navigation/bottom-tabs ^7.4.0 - Tab navigation
- @react-navigation/elements ^2.6.3 - Navigation utilities

**Form & Validation:**
- react-hook-form ^7.75.0 - Efficient form state management
- zod ^4.4.3 - TypeScript-first schema validation

**State Management:**
- zustand ^5.0.13 - Lightweight state management

**Testing:**
- @playwright/test ^1.60.0 - End-to-end testing framework
- Chromium browser (via Playwright)

**Build & Dev:**
- Expo CLI - Development server and build tooling
- EAS (Expo Application Services) - Build and deployment service
- Node.js scripts for custom build/export tasks

## Key Dependencies

**Critical:**
- @supabase/supabase-js ^2.105.4 - Backend-as-a-service client (auth, database, RPC, functions)
- @react-native-async-storage/async-storage 2.2.0 - Persistent session storage for mobile

**UI & Icons:**
- lucide-react-native ^1.14.0 - SVG icon library
- @expo/vector-icons ^15.0.3 - Expo built-in icon library
- expo-linear-gradient ~15.0.8 - Linear gradient component
- react-native-svg 15.12.1 - SVG support for React Native

**Native Modules:**
- @react-native-community/datetimepicker 8.4.4 - Native date/time picker
- react-native-gesture-handler ~2.28.0 - Gesture recognition
- react-native-reanimated ~4.1.1 - Animation library
- react-native-safe-area-context ~5.6.0 - Safe area handling
- react-native-screens ~4.16.0 - Optimized screen transitions
- react-native-worklets 0.5.1 - Background work processing

**Platform Support:**
- react-native-web ~0.21.0 - React Native components for web
- react-dom 19.1.0 - React DOM for web
- react-native-url-polyfill ^3.0.0 - URL API polyfill for React Native

**Utilities:**
- date-fns ^4.1.0 - Date manipulation and formatting
- pg ^8.21.0 - PostgreSQL client (for scripts)

**Assets & Fonts:**
- @expo-google-fonts/inter ^0.4.2 - Google Fonts integration
- expo-font ~14.0.11 - Font loading
- expo-image ~3.0.11 - Optimized image rendering
- expo-image-picker ~17.0.11 - Device image selection
- expo-constants ~18.0.13 - Build/version constants
- expo-status-bar ~3.0.9 - Status bar styling
- expo-symbols ~1.0.8 - System symbol icons
- expo-system-ui ~6.0.9 - System UI styling
- expo-web-browser ~15.0.10 - Web browser integration
- expo-splash-screen ~31.0.13 - Splash screen management
- expo-haptics ~15.0.8 - Haptic feedback
- expo-linking ~8.0.11 - Deep linking support

**Development:**
- dotenv ^17.4.2 - Environment variable loading for scripts
- eslint ^9.25.0 - Code linting
- eslint-config-expo ~10.0.0 - Expo ESLint configuration
- @types/react ~19.1.0 - TypeScript definitions for React

## Configuration

**Environment:**
- Expo EXPO_PUBLIC_* environment variables inlined at build time
- Environment variables configured via `.env` file (not committed)
- Template: `.env.example` documents required variables
- Supabase credentials: EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_ANON_KEY
- CI environment: CI=1 env var for Playwright web server configuration

**Build:**
- `tsconfig.json` - TypeScript configuration extending `expo/tsconfig.base` with strict mode
- `app.json` - Expo app configuration (name, version, icons, plugins)
- `eas.json` - EAS build profiles (development, staging, production)
- `eslint.config.js` - ESLint configuration using Expo flat config
- `playwright.config.ts` - E2E test configuration (port 19008, timeout 120s)
- Path aliases: `@/*` maps to project root for absolute imports

## Platform Requirements

**Development:**
- Node.js LTS or later
- npm or yarn
- Expo CLI installed globally or via npx
- PowerShell (Windows) or bash (macOS/Linux) for scripts
- .env file with Supabase credentials

**Production (Web):**
- Static hosting (Vercel, Netlify, etc.)
- Vercel deployment supported via `npm run vercel-build` script
- Static export: `expo export --platform web` (via `scripts/export-web.js`)
- No runtime server required for web build (static files only)

**Production (Mobile):**
- EAS build service (managed build)
- Minimum iOS 13, Android API 31+
- Supabase project credentials at build time

**Testing:**
- Chromium browser (downloaded by Playwright)
- Test server: Expo web on port 19008
- Windows PowerShell or bash for script execution

---

*Stack analysis: 2026-08-07*
