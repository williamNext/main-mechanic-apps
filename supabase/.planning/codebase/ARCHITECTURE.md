<!-- refreshed: 2026-08-07 -->
# Architecture

**Analysis Date:** 2026-08-07

## System Overview

```text
┌─────────────────────────────────────────────────────────────┐
│                   HTTP Request Layer                         │
│         Deno Runtime - Edge Functions Handlers               │
├──────────────────┬──────────────────┬───────────────────────┤
│  admin-create    │  admin-delete    │   [Future functions]  │
│   -mechanic      │   -mechanics     │                       │
│  `functions/`    │  `functions/`    │                       │
└────────┬─────────┴────────┬─────────┴──────────┬────────────┘
         │                  │                     │
         ▼                  ▼                     ▼
┌─────────────────────────────────────────────────────────────┐
│                 Authorization Middleware                     │
│     JWT Validation → Admin Role Check (requireAdmin)        │
│                 `functions/*/index.ts`                       │
└────────┬─────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│                    Database Layer                            │
│              Supabase PostgreSQL via JS Client              │
│  Tables: profiles, mechanics, admin_action_log, notifications │
│                `createClient()` initialization               │
└─────────────────────────────────────────────────────────────┘
```

## Component Responsibilities

| Component | Responsibility | File |
|-----------|----------------|------|
| admin-create-mechanic | Create new mechanic user with auth record, profile, and mechanic data | `functions/admin-create-mechanic/index.ts` |
| admin-delete-mechanics | Delete mechanics by ID with audit trail logging | `functions/admin-delete-mechanics/index.ts` |
| requireAdmin() | Extract and validate JWT token, check admin role from profiles table | Both edge functions |
| cleanText() | Trim and truncate string input | `functions/admin-create-mechanic/index.ts` |
| normalizePhoneToE164() | Convert phone numbers to E.164 format | `functions/admin-create-mechanic/index.ts` |
| uniqueUuidList() | Filter and deduplicate UUID array | `functions/admin-delete-mechanics/index.ts` |

## Pattern Overview

**Overall:** Serverless microservices with Deno edge functions

**Key Characteristics:**
- Each function is independently deployable and scalable
- Authorization check at function entry point before business logic
- Type-safe request body validation using TypeScript interfaces
- Consistent error response format (JSON with status codes)
- CORS headers included in all responses
- Database operations use Supabase client with service role authentication
- Stateless request handling (no session persistence needed)

## Layers

**HTTP Handler Layer:**
- Purpose: Accept and route incoming HTTP requests
- Location: `functions/*/index.ts`
- Contains: `Deno.serve()` entry point, request method validation, CORS preflight handling
- Depends on: Authorization layer, validation utilities, database layer
- Used by: External callers (admin UI, client applications)

**Authorization Layer:**
- Purpose: Verify caller identity and permissions
- Location: `requireAdmin()` function in each edge function
- Contains: JWT token extraction, user validation query, role checking
- Depends on: Supabase Auth API, profiles table
- Used by: HTTP handler layer

**Validation Layer:**
- Purpose: Sanitize and normalize user input
- Location: Utility functions (cleanText, normalizePhoneToE164, uniqueUuidList)
- Contains: Type guards, regex validation, data sanitization
- Depends on: None (pure functions)
- Used by: Business logic layer

**Business Logic Layer:**
- Purpose: Orchestrate database operations for mechanic lifecycle
- Location: Function bodies (after auth/validation checks)
- Contains: Auth user creation, profile insertion, audit logging, deletion transactions
- Depends on: Supabase client, database schema
- Used by: HTTP handler layer

**Database Layer:**
- Purpose: Persist and retrieve application state
- Location: Supabase PostgreSQL (accessed via `createClient()`)
- Contains: Tables (profiles, mechanics, admin_action_log, notifications)
- Depends on: Database schema, migrations
- Used by: Business logic layer

## Data Flow

### Primary Request Path (admin-create-mechanic)

1. HTTP POST received with mechanic data (`functions/admin-create-mechanic/index.ts:55`)
2. CORS preflight check returns 200 for OPTIONS requests (`index.ts:56`)
3. Authorization: Extract Bearer token and validate admin role (`index.ts:36-52`)
4. Parse JSON request body and validate required fields (`index.ts:70-88`)
5. Create auth user via `adminClient.auth.admin.createUser()` (`index.ts:90-102`)
6. Insert profile record in `profiles` table (`index.ts:104-110`)
7. Insert mechanic record in `mechanics` table (`index.ts:112-119`)
8. Return created user data with 200 status (`index.ts:126`)
9. On error: Rollback by deleting created auth user and return error response (`index.ts:122-123`)

**State Management:** None persisted at function level. Each request is independent. Database handles transactional consistency (rollback on profile/mechanic insert failure).

### Deletion Request Path (admin-delete-mechanics)

1. HTTP POST received with mechanic IDs (`functions/admin-delete-mechanics/index.ts:45`)
2. CORS preflight check returns 200 for OPTIONS requests (`index.ts:46`)
3. Authorization: Extract Bearer token and validate admin role (`index.ts:26-43`)
4. Parse JSON and extract unique UUID list (`index.ts:60-68`)
5. Fetch target mechanics data (with role check for 'mechanic') (`index.ts:71-76`)
6. Build audit log entries with before/after state (`index.ts:80-98`)
7. Insert audit log to `admin_action_log` table (`index.ts:100`)
8. Delete each auth user and collect any errors (`index.ts:102-106`)
9. Return deletion stats and error details if any (`index.ts:108-114`)

**State Management:** Audit trail stored in `admin_action_log` table capturing actor_id, target_mechanic_id, action, before_state, and after_state.

## Key Abstractions

**Authorization Abstraction (requireAdmin):**
- Purpose: Encapsulate JWT validation and role checking logic
- Examples: `functions/admin-create-mechanic/index.ts:36`, `functions/admin-delete-mechanics/index.ts:26`
- Pattern: Returns error response on auth failure, returns userId on success. Allows early return pattern.

**Response JSON Abstraction (json helper):**
- Purpose: Wrap all HTTP responses with consistent format and CORS headers
- Examples: Both edge functions use `json()` helper
- Pattern: Single function call with body and status code, automatically includes CORS headers

**Input Validation Utilities:**
- Purpose: Pure functions for data normalization and validation
- Examples: `cleanText()` (trim + truncate), `normalizePhoneToE164()` (format phone), `uniqueUuidList()` (deduplicate UUIDs)
- Pattern: Type guards and regex validation, idempotent transformations

## Entry Points

**admin-create-mechanic:**
- Location: `functions/admin-create-mechanic/index.ts:55`
- Triggers: HTTP POST to `/functions/v1/admin-create-mechanic` with admin authorization
- Responsibilities: Create new mechanic user with auth record, profile, and mechanic details. Return 200 with created user or 400-500 error response.

**admin-delete-mechanics:**
- Location: `functions/admin-delete-mechanics/index.ts:45`
- Triggers: HTTP POST to `/functions/v1/admin-delete-mechanics` with admin authorization
- Responsibilities: Delete mechanics by ID, log action to audit trail, return deletion stats.

## Architectural Constraints

- **Threading:** Deno runtime - single-threaded event loop per request. Multiple requests run concurrently but each function execution is sequential.
- **Global state:** No global mutable state. Service role key fetched from Deno.env on each request. Supabase client instantiated per request.
- **Circular imports:** None detected. Each function is self-contained.
- **Concurrency:** No request-to-request state sharing. Database handles concurrency control via PostgreSQL row-level locking.
- **Response time:** Dependent on database latency. Auth checks and profile queries are serial operations within request lifecycle.
- **Database transactions:** Admin-create-mechanic performs multi-table inserts without explicit transaction (auth user create is separate from profile/mechanic inserts). Rollback on error deletes created auth user.

## Anti-Patterns

### Repeated Authorization Logic

**What happens:** `requireAdmin()` function is duplicated in both edge function files rather than shared.

**Why it's wrong:** Maintenance burden - any fix to auth logic must be applied to both files. Risk of inconsistency if one copy is updated and the other is not.

**Do this instead:** Extract `requireAdmin()` to a shared `functions/auth-middleware.ts` or `functions/utils.ts` and import in both functions.

### Lack of Transactional Guarantee in Create Mechanic

**What happens:** Auth user is created, then profile insert, then mechanic insert. If profile succeeds but mechanic insert fails, only mechanic insert is rolled back (profile remains orphaned).

**Why it's wrong:** Inconsistent state - mechanic profile exists in system without mechanic record. Creates confusion in admin UI and reporting.

**Do this instead:** Use Supabase RPC (stored procedure) to wrap all three operations in a database transaction, or implement explicit 2-phase rollback where any failure deletes the auth user AND the profile.

### Missing Batch Delete Transaction

**What happens:** Mechanics are deleted one at a time in a loop. If deletion 5 of 10 fails due to constraint, the first 4 are already deleted.

**Why it's wrong:** Partial failure state is not clearly communicated and requires manual intervention to recover.

**Do this instead:** Use batch delete with `in()` clause where possible, or implement rollback logic that re-inserts deleted users on any failure.

## Error Handling

**Strategy:** Fail-fast with descriptive HTTP status codes and JSON error messages

**Patterns:**
- 400: Invalid input (missing fields, bad email, password too short, invalid JSON)
- 401: Missing or invalid authorization token
- 403: Valid token but insufficient permissions (not admin)
- 404: Resource not found (no matching mechanics)
- 405: Wrong HTTP method (not POST/OPTIONS)
- 500: Server misconfiguration (missing env vars) or deletion error

Error responses include message field. Deletion endpoint includes `details` array for per-mechanic errors.

## Cross-Cutting Concerns

**Logging:** No structured logging present. Consider adding:
- Function entry/exit logging
- Authorization check results
- Database operation timing
- Error stack traces for debugging

**Validation:** Input validation scattered across utility functions and business logic. Consider centralizing schema validation with a library like `zod` or `io-ts`.

**Authentication:** JWT Bearer token validation via Supabase. Service role key stored in environment variables. Token validation re-queries profiles table on every request (no caching).

**CORS:** Hardcoded to allow all origins (`*`). Consider restricting to specific allowed domains in production.

---

*Architecture analysis: 2026-08-07*
