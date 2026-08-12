# External Integrations

**Analysis Date:** 2026-08-07

## APIs & External Services

**Supabase:**
- **What it's used for:** Backend-as-a-service providing authentication, database, RPC functions, and edge functions
- SDK/Client: @supabase/supabase-js ^2.105.4
- Auth: EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_ANON_KEY (anonymous key for client)
- Initialization: `services/api.ts` - Creates singleton Supabase client with AsyncStorage-based session persistence for mobile

**Expo Application Services (EAS):**
- **What it's used for:** Build and deployment pipeline for mobile and web
- CLI: EAS CLI >=10.0.0
- Config: `eas.json` defines profiles: development (internal), staging (internal), production (auto-increment version)
- Channel-based deployment: development, staging, production

## Data Storage

**Databases:**
- PostgreSQL (Supabase-hosted)
  - Connection: Via Supabase client `@supabase/supabase-js`
  - Env vars: EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_ANON_KEY
  - Authentication: Supabase Auth (row-level security applied to profiles table)

**Tables Used:**
- `profiles` - User accounts with roles (admin, mechanic, client)
  - Columns: id, name, email, role, phone, avatar_url, created_at
  - Access: `services/auth-service.ts` - `getUserById()`, `getAdminById()`

**RPC Functions (PostgreSQL Stored Procedures):**
- `admin_dashboard_summary(p_from, p_to)` - Dashboard metrics for date range (`services/admin-service.ts:32`)
- `admin_list_mechanics(p_search, p_page, p_page_size)` - Paginated mechanics listing (`services/admin-service.ts:41`)
- `admin_list_appointments(p_from, p_to, p_status, p_mechanic_id, p_search, p_page, p_page_size)` - Paginated appointments (`services/admin-service.ts:51`)
- `admin_financial_report(p_from, p_to, p_mechanic_id, p_search)` - Financial summary by mechanic/service (`services/admin-service.ts:65`)
- `admin_get_mechanic_detail(p_mechanic_id, p_from, p_to)` - Mechanic profile with appointment history (`services/admin-service.ts:76`)

**File Storage:**
- Not applicable - Avatar URLs stored in database as references

**Caching:**
- None (local only: AsyncStorage for session persistence on mobile via `services/api.ts`)

## Authentication & Identity

**Auth Provider:**
- Supabase Auth (built-in PostgreSQL auth)
- Implementation approach: Phone or email + password authentication
  - Login: `services/auth-service.ts:login()` - Supports email or E.164-formatted phone numbers
  - Phone format conversion: Brazilian format (11 digits → +55 prefix, `services/auth-service.ts:21`)
  - Session persistence: AsyncStorage (mobile), localStorage (web) via Supabase client
  - Auto-refresh: Enabled with AppState listener for foreground/background (mobile only)
  - Sign out: `supabase.auth.signOut()` (`services/auth-service.ts:54`)

**Role-Based Access Control:**
- User role stored in `profiles.role` field
- Admin verification: Enforced in `services/auth-service.ts:80` - `getAdminById()` throws if role != 'admin'
- Admin account creation: Via external SQL scripts (not self-signup)
- SQL migrations: `scripts/sql/` directory

**Session Management:**
- Current session: `supabase.auth.getSession()` (`services/auth-service.ts:91`)
- Timeout handling: 15-second timeout on auth operations with custom error messages (Portuguese)

## Edge Functions

**Admin-managed Functions (Supabase Functions):**
- `admin-delete-mechanics` - Soft-delete mechanics with transaction handling (`services/admin-service.ts:92`)
  - Invoked via: `supabase.functions.invoke('admin-delete-mechanics')`
  - Input: `{ mechanicIds: string[] }`
  - Output: `{ deletedCount, requestedCount }`
  
- `admin-create-mechanic` - Create mechanic user with auth and profile (`services/admin-service.ts:112`)
  - Invoked via: `supabase.functions.invoke('admin-create-mechanic')`
  - Input: `{ nome, celular, email, senha, especialidade, credenciais }`
  - Phone normalization: E.164 format conversion in function call (`services/admin-service.ts:110`)

## Monitoring & Observability

**Error Tracking:**
- None (native - errors logged to browser console only)

**Logs:**
- Console logging via browser DevTools
- Expo logs: Logs in `expo-admin-web-*.log` files (development)
- Error handling: Custom error messages in Portuguese passed through service layer

## CI/CD & Deployment

**Hosting:**
- Web: Vercel (static export)
  - Build command: `npm run vercel-build` (runs `scripts/export-web.js`)
  - Build output: Static files in `dist/` directory
  - Environment: EXPO_PUBLIC_* variables from Vercel project settings

- Mobile: EAS (Expo Application Services)
  - Development: Internal distribution (debug builds)
  - Staging: Internal distribution
  - Production: App store distribution (auto version increment)

**CI Pipeline:**
- GitHub Actions (configured in `.github/`)
- Pre-commit hooks: Git hooks setup via `npm run hooks:setup` (`scripts/setup-git-hooks.js`)
- Environment check: `npm run env:check` validates .env before build

## Environment Configuration

**Required env vars:**
- `EXPO_PUBLIC_SUPABASE_URL` - Supabase project URL (format: https://project-ref.supabase.co)
- `EXPO_PUBLIC_SUPABASE_ANON_KEY` - Supabase anonymous/public key (publishable)

**Optional env vars:**
- `CI` - Set to "1" for CI environments (affects Playwright web server configuration)

**Secrets location:**
- Development: `.env` file (Git-ignored, local only)
- CI/CD: GitHub Secrets or Vercel Environment Variables (for GitHub Actions or Vercel deployment)
- EAS Build: Environment variables configured in Vercel project or EAS secrets

**Environment validation:**
- Script: `scripts/check-env.js` - Run via `npm run env:check` before builds
- Build-time check: TypeScript compilation will fail if env vars cannot be read

## Webhooks & Callbacks

**Incoming:**
- Supabase Auth callbacks: Session management via `AppState` listener (mobile), automatic via `detectSessionInUrl: false`
- No custom webhook endpoints exposed

**Outgoing:**
- Supabase RPC function returns captured in service layer
- Supabase Edge Function responses handled with error/data extraction pattern (`services/admin-service.ts:25`)

## Testing & QA

**E2E Testing:**
- Framework: Playwright ^1.60.0
- Config: `playwright.config.ts`
- Test directory: `tests/e2e/`
- Browser: Chromium (Desktop Chrome)
- Base URL: http://127.0.0.1:19008 (Expo web server)
- Execution: `npm run e2e` (headless), `npm run e2e:ui` (with Playwright UI)
- Web server: Auto-launches via Expo on port 19008
  - Command: `powershell -NoProfile -Command "$env:CI=1; npx expo start --web --port 19008"`
- Reuses existing server if running
- Timeout: 120s per test, 15s per assertion, 180s web server startup

## Data & Seed Scripts

**Database Seeding:**
- Script: `scripts/seed.js` - General seeding
- Script: `scripts/create-mechanic-auth-users.js` - Bulk mechanic user creation with auth
- Script: `scripts/seed-mechanics-data.js` - Mechanic profile data seeding
- SQL migrations: `scripts/sql/` - SQL schema changes (already applied to production)

## Form Validation & Security

**Validation Library:** Zod ^4.4.3 (schemas defined in components or services)
**Form State:** React Hook Form ^7.75.0

**Data Transformation Patterns:**
- Phone number normalization: E.164 format for Brazil (local/international)
- Request timeout handling: 15-second timeout wrapper in `withTimeout()` (`services/auth-service.ts:7`)
- Error message localization: Portuguese error strings throughout service layer

---

*Integration audit: 2026-08-07*
