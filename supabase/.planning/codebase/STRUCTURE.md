# Codebase Structure

**Analysis Date:** 2026-08-07

## Directory Layout

```
supabase/
├── .planning/
│   └── codebase/                    # Planning documents and analysis
├── docs/
│   └── specs/
│       └── easy-first-notifications.md  # Feature spec for notifications/appointments
├── functions/
│   ├── admin-create-mechanic/
│   │   └── index.ts                 # Create new mechanic user (auth + profile + data)
│   └── admin-delete-mechanics/
│       └── index.ts                 # Delete mechanics with audit logging
├── scripts/
│   └── sql/                         # Empty directory reserved for SQL migrations
└── [root files]                     # No package.json, tsconfig, or config files present
```

## Directory Purposes

**`.planning/codebase/`:**
- Purpose: Storage for generated codebase analysis documents
- Contains: Architecture, structure, conventions, testing, and concerns markdown files
- Key files: `ARCHITECTURE.md`, `STRUCTURE.md`, `CONVENTIONS.md`, `TESTING.md`, `CONCERNS.md`

**`docs/`:**
- Purpose: Project documentation and specifications
- Contains: Feature specs, design docs, requirements
- Key files: `easy-first-notifications.md` describes v1 notification and appointment system

**`docs/specs/`:**
- Purpose: Feature specifications and acceptance criteria
- Contains: `easy-first-notifications.md` - notification behavior, appointment lifecycle, profile editing rules
- Status: Describes implemented features plus deferred work (phone OTP, SMS, push notifications)

**`functions/`:**
- Purpose: Supabase Edge Functions (Deno runtime, serverless endpoints)
- Contains: Independent HTTP handler functions, each deployable separately
- Architecture: Microservice pattern - each function is a self-contained HTTP endpoint

**`functions/admin-create-mechanic/`:**
- Purpose: Admin endpoint to onboard new mechanic users
- Contains: Single entry point (`index.ts`) handling user creation workflow
- Operations: Create auth user, insert profile record, insert mechanic record (with rollback)
- Authorization: Requires admin role (checked in function)
- Inputs: JSON body with nome, celular, email, senha, especialidade, credenciais
- Outputs: 200 with created user data, 400-500 with error

**`functions/admin-delete-mechanics/`:**
- Purpose: Admin endpoint to delete mechanics with audit trail
- Contains: Single entry point (`index.ts`) handling deletion workflow
- Operations: Validate IDs, fetch target data, log to audit table, delete auth users
- Authorization: Requires admin role (checked in function)
- Inputs: JSON body with mechanicIds array (UUIDs)
- Outputs: 200 with deletion stats, 404 if not found, 500 if deletion fails
- Audit: Creates entries in `admin_action_log` table with before/after state

**`scripts/sql/`:**
- Purpose: Reserved for database migration scripts
- Contains: Empty - no SQL files present yet
- Usage: Expected location for PostgreSQL schema definitions and migrations
- Status: Placeholder directory, not yet populated

## Key File Locations

**Entry Points:**
- `functions/admin-create-mechanic/index.ts`: HTTP handler for mechanic creation
- `functions/admin-delete-mechanics/index.ts`: HTTP handler for mechanic deletion

**Configuration:**
- No configuration files present (package.json, tsconfig.json, Deno config)
- Supabase environment variables passed via `Deno.env.get()`

**Core Logic:**
- `functions/admin-create-mechanic/index.ts`: User creation, validation, database inserts
- `functions/admin-delete-mechanics/index.ts`: User deletion, audit logging, bulk operations

**Documentation:**
- `docs/specs/easy-first-notifications.md`: Feature spec and acceptance criteria

**Testing:**
- No test files present

## Naming Conventions

**Files:**
- Kebab-case directory names: `admin-create-mechanic`, `admin-delete-mechanics`
- `index.ts` as entry point for each function (Supabase convention)

**Functions:**
- camelCase for utility functions: `cleanText()`, `normalizePhoneToE164()`, `uniqueUuidList()`, `requireAdmin()`
- Purpose-driven names that describe the transformation or check

**Variables:**
- camelCase for all identifiers: `adminClient`, `mechanicIds`, `profileError`, `isActive`
- Descriptive names indicating content: `authData`, `userData`, `profile`, `targets`

**Types:**
- PascalCase interface names: `CreateMechanicBody`, `DeleteMechanicsBody`
- Body types exported at module level
- Fields use camelCase in code but snake_case in database (automatic conversion by Supabase client)

**Database Fields (from schema inference):**
- snake_case in PostgreSQL: `is_active`, `email_confirm`, `phone_confirm`, `user_metadata`
- Converted to camelCase by Supabase JS client in responses

## Where to Add New Code

**New Admin Function:**
- Create directory: `functions/admin-<action>/`
- Create entry point: `functions/admin-<action>/index.ts`
- Pattern: Import Supabase client, define types, implement requireAdmin check, Deno.serve() handler
- Follow CORS headers pattern from existing functions
- Location for shared utilities: Extract to `functions/shared/` if needed (currently duplicated)

**New Feature Documentation:**
- Location: `docs/specs/<feature-name>.md`
- Format: Follow `easy-first-notifications.md` structure (Current Scope, Behavior, Acceptance Criteria)

**Database Migrations:**
- Location: `scripts/sql/<YYYYMMDD>-<description>.sql`
- Convention: Timestamp-prefixed SQL files for migration ordering
- Tables for existing features: profiles, mechanics, admin_action_log, notifications, timeslots, appointments

**Shared Utilities:**
- Current state: Utilities are duplicated in both functions (`requireAdmin()`, `json()`, CORS headers)
- Recommendation: Create `functions/shared/` directory with utility exports
- Example: `functions/shared/auth.ts` for `requireAdmin()`, `functions/shared/response.ts` for `json()` helper

**Testing:**
- Location: `functions/<function-name>/*.test.ts` (co-located with function)
- No test framework configured - would need Deno test setup

## Special Directories

**`.planning/`:**
- Purpose: GSD (Getting Stuff Done) planning framework documents
- Generated: Yes (written by codebase mapper)
- Committed: Yes (should be version controlled)
- Contents: Analysis documents for architecture, conventions, testing, concerns

**`scripts/sql/`:**
- Purpose: Database schema and migration scripts
- Generated: No (manually created)
- Committed: Yes (version controlled)
- Status: Empty - ready for schema definitions

## Database Schema (Inferred from Code)

**tables used:**
- `profiles`: id (UUID), name, email, phone, role (admin/mechanic/client)
- `mechanics`: id (UUID), specialty, credentials, is_active
- `admin_action_log`: actor_id, target_mechanic_id, action, note, before_state, after_state
- `notifications`: (from spec) event_type, user_id, read_at, created_at

**relationships:**
- profiles.id → mechanics.id (one-to-one)
- admin_action_log.actor_id → profiles.id
- admin_action_log.target_mechanic_id → mechanics.id
- notifications.user_id → profiles.id

**roles:** admin, mechanic, client (inferred from role checks)

## Deployment Model

**Functions:** Supabase Edge Functions (Deno runtime)
- URL pattern: `https://<project-id>.supabase.co/functions/v1/<function-name>`
- Environment: Deno 1.x runtime (JSR/deno.land modules)
- Authentication: Service role key passed from function environment
- Availability: Global edge locations via Supabase CDN

**Database:** Supabase PostgreSQL
- Accessed via Supabase JS client (`jsr:@supabase/supabase-js@2`)
- Connection: URL and service role key from environment
- RLS: Row-level security policies (not visible in function code, defined in database)

---

*Structure analysis: 2026-08-07*
