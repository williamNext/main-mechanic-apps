# External Integrations

**Analysis Date:** 2026-08-07

## APIs & External Services

**Supabase Backend:**
- Supabase - Complete backend platform
  - SDK/Client: `@supabase/supabase-js` 2.105.4
  - Implementation: `services/api.ts` creates singleton client
  - Auth: Environment variables `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY`
  - Usage: All services (`services/*-service.ts`) depend on `supabase` client

## Data Storage

**Databases:**
- PostgreSQL (via Supabase)
  - Connection: Configured in Supabase project, accessed via `@supabase/supabase-js`
  - Client: Supabase JavaScript client (`services/api.ts`)
  - ORM: None — direct RLS-enabled SQL queries via Supabase PostgREST API
  - Schema location: `scripts/sql/` contains migrations and seed scripts
  - Key tables:
    - `profiles` - User profiles with roles (admin, mechanic, client)
    - `mechanics` - Mechanic-specific data (specialty, credentials, active status)
    - `timeslots` - Mechanic availability (`date`, `start_time`, `end_time`, `is_available`)
    - `appointments` - Service appointments with status tracking
    - `appointment_service_reports` - Detailed service completion reports
    - `service_items` - Line items for appointment charges
    - `notifications` - In-app notifications for users
    - `public_mechanics` - Public-facing mechanic directory

**File Storage:**
- Local filesystem only - No S3, cloud storage, or CDN integration detected
  - Avatar URLs stored as nullable strings in `profiles.avatar_url`
  - Image selection via `expo-image-picker` 17.0.11, stored locally on device

**Caching:**
- In-memory client-side caching via Zustand stores
  - No server-side cache layer (Redis, etc.)
  - Session persistence via AsyncStorage (mobile) for auth tokens only

## Authentication & Identity

**Auth Provider:**
- Supabase Auth (built-in PostgreSQL auth)
  - Implementation: Email and phone number-based authentication
  - Email login: `services/auth-service.ts` → `login(email, password)`
  - Phone login: `services/auth-service.ts` → `loginByPhone(phone, password)`
    - Normalizes Brazilian phone numbers to E.164 format: `toE164BrPhone()`
    - Accepts +55 country code or 10-11 digit format
  - Session management:
    - Auto-refresh enabled: `autoRefreshToken: true`, `persistSession: true`
    - Mobile: Tokens persisted via AsyncStorage with process lock
    - Web: Tokens in browser memory
    - App lifecycle handler: `app/_layout.tsx` pauses/resumes auto-refresh based on app state
  - Auth state subscription: `supabase.auth.onAuthStateChange()` listener in root layout

**OAuth/SSO:**
- Not integrated - No Google, GitHub, or other provider support

## Monitoring & Observability

**Error Tracking:**
- None detected - No Sentry, Rollbar, or similar integration
- Development only: Console logging with `console.log()` and `console.error()` calls prefixed with `[auth]`, `[appointment]`

**Logs:**
- Development: Console output when `__DEV__` is true
- Timing logs: `timed()` wrapper in `services/auth-service.ts` logs operation duration on dev
- Timeout tracking: Timeout errors with contextual messages (e.g., "Tempo limite excedido ao entrar")
- No centralized logging to external service (Datadog, LogRocket, etc.)

**Tracing:**
- Playwright test traces on failure: `trace: 'on-first-retry'` in `playwright.config.ts`

## CI/CD & Deployment

**Hosting:**
- **Mobile**: EAS (Expo Application Services) — indicated by build validation in GitHub Actions
  - `.github/workflows/security-and-build.yml` runs on push to master
- **Web**: Vercel — `npm run vercel-build` target in `package.json`
  - Build command: `node scripts/export-web.js` (Expo web export)
  - Server: Runs on port 19006 during E2E testing

**CI Pipeline:**
- GitHub Actions (`.github/workflows/security-and-build.yml`)
  - **Secrets scanning**: Gitleaks (`gitleaks/gitleaks-action@v2`)
  - **Build validation**: 
    - Node.js 20 setup
    - Dependencies install via `npm ci`
    - Environment validation via `npm run env:check`
  - **Triggers**: Pull requests and pushes to master branch

**Secrets Management:**
- GitHub Secrets (referenced in CI/CD workflow):
  - `secrets.EXPO_PUBLIC_SUPABASE_URL`
  - `secrets.EXPO_PUBLIC_SUPABASE_ANON_KEY`

## Environment Configuration

**Required env vars:**
- `EXPO_PUBLIC_SUPABASE_URL` - Supabase project URL (e.g., `https://your-project-ref.supabase.co`)
- `EXPO_PUBLIC_SUPABASE_ANON_KEY` - Supabase anonymous key for client-side access

**Optional env vars:**
- `CI=1` - Set in Playwright web server command to indicate CI environment
- `__DEV__` - Automatic, controls development-only logging in services

**Secrets location:**
- `.env` file for local development (git-ignored, not committed)
- `.env.example` - Template showing required variables
- GitHub Secrets for CI/CD pipeline
- Expo build credentials managed via EAS project

**Config file:** `config/env.ts` exports typed `env` object with validated Supabase credentials

## Webhooks & Callbacks

**Incoming:**
- None — No webhook endpoints for external services

**Outgoing:**
- None — No outbound webhooks to external services
- Database-level real-time: Supabase uses PostgreSQL LISTEN/NOTIFY for subscriptions (if implemented, not found in codebase)

## Data Backup & Recovery

**Backup Strategy:**
- Supabase handles automatic backups (managed by Supabase infrastructure)
- No custom backup scripts or offsite replication detected

## Third-Party Libraries with Network I/O

**Gitleaks (CI/CD only):**
- `gitleaks/gitleaks-action@v2` - GitHub Action for secret scanning
- Runs only in CI pipeline, not in application code

## API Rate Limiting

**Supabase:**
- RLS (Row-Level Security) policies enforce authorization
- Function-level timeouts in auth service:
  - `AUTH_TIMEOUT_MS = 15000` - Auth operations (15 seconds)
  - `PROFILE_TIMEOUT_MS = 15000` - Profile loads (15 seconds)
- Booking endpoint protection: `book_client_appointment` RPC has schema cache validation

---

*Integration audit: 2026-08-07*
