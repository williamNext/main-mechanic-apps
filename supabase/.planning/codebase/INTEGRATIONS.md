# External Integrations

**Analysis Date:** 2026-08-07

## APIs & External Services

**Supabase:**
- Supabase Core Platform - Integrated backend for all data operations
  - SDK/Client: `@supabase/supabase-js@2` (JSR package)
  - Auth: `SUPABASE_SERVICE_ROLE_KEY` (environment variable)
  - Used by: `functions/admin-create-mechanic/index.ts`, `functions/admin-delete-mechanics/index.ts`

**Planned Integrations (Deferred):**
- WhatsApp - For notification delivery (not yet implemented)
- SMS - For fallback notification delivery and OTP (not yet implemented)
- Expo Push - For mobile app push notifications (not yet implemented)

## Data Storage

**Databases:**
- PostgreSQL (Supabase-managed)
  - Connection: Via `SUPABASE_URL` environment variable
  - Client: Supabase JavaScript SDK (`@supabase/supabase-js@2`)
  - Tables accessed:
    - `profiles` - User account data
    - `mechanics` - Mechanic profile data
    - `appointments` - Booking records
    - `timeslots` - Mechanic availability slots
    - `notifications` - Event-based notifications
    - `admin_action_log` - Administrative action audit trail

**File Storage:**
- Not detected in current codebase

**Caching:**
- None detected (could leverage Supabase Realtime for real-time updates)

## Authentication & Identity

**Auth Provider:**
- Supabase Auth (native provider)
  - Implementation: OAuth and email/password via Supabase Auth system
  - User metadata: `name`, `role` (admin/mechanic/client), `phone`
  - Authorization pattern: Bearer token validation via `SUPABASE_SERVICE_ROLE_KEY` with role-based access control
  - Used by: All edge functions for admin authorization via `requireAdmin()` function

**Authorization:**
- Role-based access control (RBAC):
  - `admin` - Can create mechanics, delete mechanics, access audit logs
  - `mechanic` - Can manage own appointments and profile
  - `client` - Can book appointments, view notifications
  - Implementation: Role stored in `profiles.role` and checked before privileged operations

## Monitoring & Observability

**Error Tracking:**
- Not detected in current implementation

**Logs:**
- Supabase Edge Functions built-in logging (via Supabase dashboard)
- Administrative action audit log in `admin_action_log` table capturing:
  - Actor ID (admin performing action)
  - Target mechanic ID
  - Action type
  - Before/after state snapshots
  - Timestamp

## CI/CD & Deployment

**Hosting:**
- Supabase Cloud (edge functions deployed to Supabase platform)
- Functions execute on Deno Deploy infrastructure globally

**CI Pipeline:**
- Not detected (likely managed via Supabase CLI + GitHub Actions in parent workspace)

## Environment Configuration

**Required env vars:**
- `SUPABASE_URL` - Supabase project URL (e.g., `https://xxxxx.supabase.co`)
- `SUPABASE_SERVICE_ROLE_KEY` - Service role API key with admin privileges for user/profile management

**Secrets location:**
- Managed by Supabase Edge Functions environment configuration
- Injected at deployment/runtime via Supabase platform

## Webhooks & Callbacks

**Incoming:**
- HTTP POST endpoints for edge functions:
  - `POST /functions/v1/admin-create-mechanic` - Create new mechanic user
  - `POST /functions/v1/admin-delete-mechanics` - Delete mechanics in batch
  - CORS enabled for cross-origin requests

**Outgoing:**
- Supabase RPC-based event creation for notifications (documented in specs):
  - Appointment confirmation notifications
  - Appointment cancellation notifications
  - System operational notices

## Database Operations

**RPC Functions (Supabase Stored Procedures):**
- Appointment booking RPC - Creates appointment and generates notifications (referenced in `easy-first-notifications.md`)
- Appointment cancellation RPC - Updates timeslots and generates notifications
- Notification creation RPC - Triggered by appointment operations

**Real-time Subscriptions:**
- Architecture supports Supabase Realtime for live updates on:
  - Notifications table
  - Appointments table
  - Timeslots table
  - (Not yet implemented in frontend)

---

*Integration audit: 2026-08-07*
