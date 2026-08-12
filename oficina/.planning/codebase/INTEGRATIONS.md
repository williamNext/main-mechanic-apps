# External Integrations

**Analysis Date:** 2026-08-07

## APIs & External Services

**Supabase Backend:**
- Supabase Platform - Provides backend-as-a-service for authentication, database, and real-time functionality
  - SDK/Client: @supabase/supabase-js ^2.105.4 (`services/api.ts`)
  - Auth: Environment variables `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY`
  - Configuration: `config/env.ts` loads and validates these public credentials
  - Used by: All services in `services/` directory for data operations

**WhatsApp Integration:**
- WhatsApp Web/Desktop - Deep linking for messaging
  - Integration: `expo-linking` used to construct and open WhatsApp URLs
  - Format: `https://wa.me/{phone}?text={message}` deep links in:
    - `app/(client)/appointment/[id].tsx` - Contact mechanic via WhatsApp
    - `app/(client)/booking-success.tsx` - Share booking confirmation via WhatsApp
  - No SDK required - uses native URL scheme handling

## Data Storage

**Databases:**
- PostgreSQL (via Supabase)
  - Connection: Supabase-managed PostgreSQL instance
  - Client: @supabase/supabase-js (PostgREST client)
  - Tables: profiles, appointments, mechanics, timeslots, notifications, appointment_service_reports (from `schema.sql` and `scripts/sql/`)
  - RPC Functions: Custom PostgreSQL functions like `sync_unfinalized_appointments`, `book_client_appointment` (via `services/appointment-service.ts`)

**File Storage:**
- Not detected - Images use Expo's Image component with asset imports only (no remote file uploads observed)

**Caching:**
- None detected - Real-time sync via Supabase subscriptions, no Redis or similar

## Authentication & Identity

**Auth Provider:**
- Supabase Auth (native PostgreSQL auth)
  - Implementation: Email and phone-based authentication
  - `services/auth-service.ts` provides:
    - `login(email, password)` - Email/password login
    - `loginByPhone(phone, password)` - Brazilian phone-based login with E.164 normalization
    - `signUp(email, password, name, role, phone?)` - Email signup
    - `signUpWithPhone(phone, password, name, role)` - Phone signup
    - `logout()` - Sign out
    - `getCurrentSessionUser()` - Retrieve current authenticated user
  - Session persistence: Secure storage on mobile (via `expo-secure-store`) and browser localStorage on web
  - Auto-refresh: Configured in `services/api.ts` with:
    - Automatic token refresh when app becomes active (mobile)
    - Session persistence across app restarts
  - User roles: 'client' and 'mechanic' (stored in profiles table)

## Monitoring & Observability

**Error Tracking:**
- None detected - No Sentry, Rollbar, or similar configured

**Logs:**
- Console logging only
  - Development mode: `services/auth-service.ts` includes timing and error logs via `console.log()` when `__DEV__` is true
  - No centralized logging service configured

**Security Scanning:**
- Gitleaks (GitHub Actions) - Secrets detection in CI pipeline (`.github/workflows/security-and-build.yml`)
- Environment validation: `scripts/check-env.js` validates required Supabase credentials at build time

## CI/CD & Deployment

**Hosting:**
- **Web:** Vercel
  - Build configuration: `vercel.json` with command `npm run vercel-build`
  - Build script: `scripts/export-web.js` runs `expo export -p web`
  - Output directory: `dist/`
  - Environment variables: `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` required
  - SPA routing: Configured with rewrites to `/` for client-side routing

- **Mobile:** EAS (Expo Application Services)
  - Build profiles: `eas.json` with development, staging, and production channels
  - Development channel: Internal distribution with development client
  - Staging channel: Internal distribution
  - Production channel: Public distribution with auto-increment versioning

**CI Pipeline:**
- GitHub Actions (`.github/workflows/security-and-build.yml`)
  - Triggers: Pull requests and pushes to master branch
  - Jobs:
    - `secrets-scan`: Gitleaks scan for leaked credentials
    - `eas-build-check`: Validates environment variables and builds on push to master
  - Node.js version: 20
  - Secrets managed in GitHub: `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY`

**Local Development:**
- Expo dev server
  - Android: `npm run android` - Starts dev server and launches Android emulator
  - iOS: `npm run ios` - Starts dev server and launches iOS simulator
  - Web: `npm run web` or `npm start` - Starts dev server on port 19007 (for Playwright tests)
  - Reset: `npm run reset-project` - Clears cache and reinstalls dependencies

## Environment Configuration

**Required env vars:**
- `EXPO_PUBLIC_SUPABASE_URL` - Supabase project URL (format: `https://[project-ref].supabase.co`)
- `EXPO_PUBLIC_SUPABASE_ANON_KEY` - Supabase public anonymous key for client auth

**Secrets location:**
- `.env` file (Git ignored) - Local development configuration
- GitHub Secrets (`.github/workflows/security-and-build.yml`) - CI/CD environment variables
- Vercel Environment Variables - Web deployment secrets (no `.env` file on production)

**Configuration validation:**
- `scripts/check-env.js` - Validates presence of required variables before build
- `config/env.ts` - Runtime type safety for environment variables
- `.env.example` - Documentation of required variables for developers

## Webhooks & Callbacks

**Incoming:**
- None detected - Supabase Auth handles all authentication flows without external webhooks

**Outgoing:**
- None detected - App uses pull-based architecture with periodic syncs via `syncUnfinalizedAppointments()` RPC

## Data Synchronization

**Real-time Updates:**
- Supabase Realtime (if enabled on tables) - Via `@supabase/supabase-js` subscriptions
- Manual sync: `services/appointment-service.ts` calls `sync_unfinalized_appointments()` RPC function to sync appointment states

**API Calls:**
- All backend operations use Supabase PostgREST API through `@supabase/supabase-js` client
- Examples:
  - `supabase.from('appointments').select()` - Query appointments
  - `supabase.from('profiles').insert()` - Create user profiles
  - `supabase.rpc('book_client_appointment')` - Call server-side booking logic

---

*Integration audit: 2026-08-07*
