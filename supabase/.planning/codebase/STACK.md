# Technology Stack

**Analysis Date:** 2026-08-07

## Languages

**Primary:**
- TypeScript - Used for all Supabase Edge Functions (`functions/admin-create-mechanic/index.ts`, `functions/admin-delete-mechanics/index.ts`)

**Secondary:**
- SQL - PostgreSQL for schema and migrations (scripted in `scripts/sql/`)

## Runtime

**Environment:**
- Deno - JavaScript/TypeScript runtime for executing edge functions

**Package Manager:**
- JSR (JavaScript Registry) - Package registry for dependencies

## Frameworks

**Core:**
- Supabase Edge Functions - Serverless functions framework built on Deno, deployed via Supabase platform
- Supabase Auth - Built-in authentication system with user management
- Supabase Realtime - Real-time database subscriptions (architecture supports this)

## Key Dependencies

**Critical:**
- `@supabase/supabase-js@2` (from JSR) - Official Supabase JavaScript client SDK for database and authentication operations
  - Used for: Creating authenticated clients, querying PostgreSQL tables, managing Supabase Auth users

## Configuration

**Environment:**
- Configured via environment variables injected by Supabase Edge Functions platform
- Key configs required:
  - `SUPABASE_URL` - Supabase project URL
  - `SUPABASE_SERVICE_ROLE_KEY` - Admin API key for privileged operations

**Build:**
- Deno native TypeScript compilation (no external build tools required)
- Functions deployed directly to Supabase via CLI or GitHub integration

## Platform Requirements

**Development:**
- Deno CLI for local development
- Supabase CLI for local emulation and deployment
- TypeScript knowledge for edge function development

**Production:**
- Supabase Cloud or self-hosted Supabase instance
- Functions run on Supabase Edge Network (built on Deno Deploy infrastructure)
- PostgreSQL database instance (managed by Supabase)

## Database Schema

**Core Tables:**
- `public.profiles` - User profiles (id, name, phone, email, role)
- `public.mechanics` - Mechanic-specific data (specialty, credentials, is_active)
- `public.appointments` - Booking records
- `public.timeslots` - Mechanic availability
- `public.notifications` - Event notifications (appointment_confirmed, appointment_canceled, appointment_completed, system)
- `public.admin_action_log` - Audit log for admin operations

---

*Stack analysis: 2026-08-07*
