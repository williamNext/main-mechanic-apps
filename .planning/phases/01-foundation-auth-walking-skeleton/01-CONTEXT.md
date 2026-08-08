# Phase 1: Foundation & Auth Walking Skeleton - Context

**Gathered:** 2026-08-07
**Status:** Ready for planning

<domain>
## Phase Boundary

A portable, locally-runnable Node.js + SQLite server exists with the full data schema in place, and a client can sign up, log in with a persisted/refreshable session, and log out — proving the entire stack works end-to-end before any booking, admin, or notification business logic is layered on. Covers INFRA-01, INFRA-02, DATA-01, DATA-02, DATA-03, AUTH-01, AUTH-02, AUTH-03.

</domain>

<decisions>
## Implementation Decisions

### Notifications schema recovery (DATA-02)
- **D-01:** Live introspection against the Supabase project is not possible — the user confirmed the `notifications` feature was never actually planned/implemented in production, and access to the Supabase project is gone entirely. DATA-02 changes from "recover the live schema" to "infer a reasonable schema from how the client apps already call it." — **Reversibility:** reversible — it's a new table in a fresh SQLite DB with no production data or callers depending on an exact shape yet.
- **D-02:** Infer the `notifications` table schema from the columns/calls already used in `mechanic/services/notification-service.ts` and `oficina/services/notification-service.ts` (identical in both): `recipient_id`, `actor_id`, `appointment_id`, `type`, `title`, `body`, `data`, `read_at`, `created_at`, `updated_at`. Treat this as a best-effort port, not a verified-against-production schema.

### Token/session strategy
- **D-03:** Single long-lived JWT for the access token (not a short-lived-access + refresh-token pair). Chosen over mirroring Supabase's refresh-token flow for build simplicity. — **Reversibility:** costly — **rationale:** switching to a two-token flow later touches every client's auth-storage code (`services/api.ts`/`app/_layout.tsx` in admin/mechanic/oficina) and the server's login/refresh endpoints simultaneously; not a local change.
- **D-04:** Because a single long-lived JWT can't be invalidated by expiry alone, logout must actually revoke it: maintain a server-side token blocklist (or equivalent revoked-session record) in the same SQLite database. AUTH-03 ("log out invalidates session") is only satisfied if the blocklist is checked on every authenticated request.
- **D-05:** Blocklist/session-tracking data lives in the same SQLite DB as everything else — no separate store (e.g., in-memory or Redis). In-memory was explicitly rejected because a server restart would silently log everyone out.

### First admin bootstrap
- **D-06:** The first admin account is created by a standalone Node seed script (run manually, not exposed as an API endpoint), mirroring the existing `scripts/seed.js` / `create-mechanic-auth-users.js` pattern already used in `mechanic`/`oficina`. No env-var-triggered auto-bootstrap-on-first-boot logic in the server itself.

### Signup default role
- **D-07:** The public signup endpoint (AUTH-01) always creates a `client`-role account. Mechanic and admin accounts are only ever created via privileged admin action (ADMIN-01, Phase 3) or the bootstrap seed script (D-06) — matching current Supabase-backed behavior exactly. No self-service mechanic/admin signup path exists or is planned.

### Claude's Discretion
- Web framework (Express/Fastify/etc.), ORM (Drizzle recommended in PROJECT.md), password hashing algorithm/cost factor, exact JWT expiry duration, local dev DB file location/naming — none of these were raised as gray areas; treated as standard implementation choices for the planner/executor to make.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Schema to port (source of truth — current Postgres/Supabase schema)
- `../mechanic/scripts/sql/2026-05-16_rebuild_public_app_schema_from_scratch.sql` — canonical base schema: `profiles`, `mechanics`, `public_mechanics`, `timeslots`, `appointments`
- `../mechanic/scripts/sql/2026-05-16_migrate_profiles_to_phone_auth.sql` — profiles auth-column history (phone auth is being dropped per PROJECT.md; read for schema shape, not to replicate phone-auth behavior)
- `../mechanic/scripts/sql/2026-05-16_fix_book_client_appointment_rpc.sql` and `2026-05-15_cancel_client_appointment.sql` — current booking/cancellation RPC logic (needed in Phase 2, but the appointments schema shape they operate on is relevant now)
- `../mechanic/scripts/sql/2026-05-24_appointment_closure_finance.sql` — adds `appointment_service_reports`/line-item schema
- `../admin/scripts/sql/2026-05-22_admin_operations.sql`, `2026-05-24_admin_bulk_delete_mechanics.sql`, `2026-05-25_admin_create_mechanic.sql` — `admin_action_log` schema and admin-only additive migrations
- `../admin/scripts/sql/2026-05-24_finance_month_year_overview.sql` — financial reporting schema additions
- `../admin/scripts/sql/2026-05-25_remove_mechanic_approval_flow.sql` — confirms mechanic-approval flow was removed; do not port it
- `../oficina/scripts/sql/2026-05-23_allow_active_mechanic_browse.sql` — oficina-specific additive migration not present in mechanic's copy

### Notifications table shape (inferred, unverified — see D-01/D-02)
- `../mechanic/services/notification-service.ts` (identical in `../oficina/services/notification-service.ts`) — only source of truth for the `notifications` table's expected columns, since no `CREATE TABLE` exists anywhere

### Auth/session client shape to eventually match (informational — client rewiring is out of scope for this project, but the server's response shape should be usable by it)
- `../admin/services/api.ts`, `../mechanic/services/api.ts`, `../oficina/services/api.ts` — current Supabase client init pattern (AsyncStorage/SecureStore session persistence, `onAuthStateChange`, `autoRefreshToken`)
- `../admin/services/auth-service.ts` — current admin-only login pattern (`getAdminById()` throws if `role !== 'admin'`) — relevant context for Phase 2's AUTH-04 role-authorization design, not Phase 1

### Edge functions being replaced (Phase 3, referenced now for schema context only)
- `../supabase/functions/admin-create-mechanic/index.ts`
- `../supabase/functions/admin-delete-mechanics/index.ts`

No ADRs/PRDs exist for this project — PROJECT.md and REQUIREMENTS.md (`.planning/PROJECT.md`, `.planning/REQUIREMENTS.md`) are the canonical project-level context.

</canonical_refs>

<code_context>
## Existing Code Insights

This is a greenfield repo (`projetos/server/`) — no existing code to scout within it. All "existing code" context comes from the sibling repos listed under Canonical References above, which are the source the schema/auth behavior is being ported from, not code this project can import or reuse directly (different runtime — Postgres/Deno/Supabase SDK vs. Node/SQLite).

### Reusable Assets
- None within this repo (fresh start). The SQL migration files listed above are the closest thing to a "spec" for the schema.

### Established Patterns
- Sibling apps' Node seed scripts (`mechanic/scripts/seed.js`, `create-mechanic-auth-users.js`) establish the precedent for D-06 (seed-script-based admin bootstrap) — same pattern, new target DB.

### Integration Points
- None yet — this phase has no consumers. Phase 2+ within this same repo will build on the schema/auth foundation laid here.

</code_context>

<specifics>
## Specific Ideas

No specific UI/UX references (backend-only phase). Key specific facts from discussion:
- Notifications were never actually implemented against production — treat the whole `notifications` table as an unverified/best-effort inference, not a faithful port.
- User has no remaining access to the original Supabase project at all — no future phase in this project should assume live-Supabase access is available for verification or data migration.

</specifics>

<deferred>
## Deferred Ideas

- AUTH-04 (role-based authorization middleware) and the admin-only-login nuance (`admin/services/auth-service.ts`'s `getAdminById()` role check) belong to Phase 2, not Phase 1 — noted here so Phase 2's discussion doesn't have to rediscover it.
- Nothing else came up outside phase scope — discussion stayed within Phase 1's boundary.

### Reviewed Todos (not folded)
None — no pending todos matched this phase (`todo.match-phase` returned zero matches).

</deferred>

---

*Phase: 1-Foundation & Auth Walking Skeleton*
*Context gathered: 2026-08-07*
