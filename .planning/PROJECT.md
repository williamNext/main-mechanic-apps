# Workshop Backend Server (Supabase Replacement)

## What This Is

A self-hosted Node.js API server backed by SQLite that replaces the shared Supabase project currently used by three sibling Expo/React Native apps — `admin`, `mechanic`, and `oficina` (client-facing) — in a car-workshop booking system. It is the single shared backend for all three apps: one database, one auth system, one set of business-logic endpoints, segmented by role (`admin` / `mechanic` / `client`).

## Core Value

Clients can book a mechanic timeslot and mechanics/admins can manage it without double-booking or losing cross-app visibility (a booking, cancellation, or completion made in one app must be correctly visible to the others) — with the same correctness guarantees the current Supabase+Postgres setup provides, just self-hosted on SQLite.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Node API server (Express or Fastify) with SQLite storage (better-sqlite3 + Drizzle ORM), replacing the shared Supabase Postgres project
- [ ] Schema ported 1:1: `profiles`, `mechanics`, `public_mechanics` (+ its sync-trigger equivalent), `timeslots`, `appointments` (+ its single-active-booking-per-timeslot constraint), `appointment_service_reports`, `appointment_service_items`, `admin_action_log`
- [ ] `notifications` table schema recovered via live introspection against the current Supabase project (no `CREATE TABLE` for it exists in any repo) and ported
- [ ] JWT-based auth: signup/login with email+password only (no phone/SMS OTP), session refresh, logout — replacing `supabase.auth.*`
- [ ] API-layer authorization middleware keyed on `profiles.role`, replacing Postgres RLS + `private.is_admin()`/`private.can_view_profile()`
- [ ] Business-logic endpoints replacing the current SECURITY DEFINER RPCs: `book_client_appointment` (transactional, double-booking-safe), `cancel_client_appointment`, `cancel_mechanic_appointment`, `complete_mechanic_appointment`, `sync_unfinalized_appointments`, `sync_acabado_appointments`, and the `admin_*` reporting/aggregation endpoints (`admin_dashboard_summary`, `admin_list_mechanics`, `admin_list_appointments`, `admin_get_appointment_detail`, `admin_get_mechanic_detail`, `admin_financial_report`)
- [ ] Admin user-management endpoints replacing the two Supabase edge functions: `admin-create-mechanic` (create user + profile + mechanic record) and `admin-delete-mechanics` (delete user, cascade, write `admin_action_log` audit row)
- [ ] Notification fan-out preserved: booking/cancellation/completion actions create `notifications` rows visible cross-app (client ↔ mechanic ↔ admin)
- [ ] Runs as a plain, portable Node process (no hosting-specific assumptions baked in) — concrete hosting decided later
- [ ] Client rewiring guidance/contract stable enough for the 3 sibling apps (each in its own repo) to swap `@supabase/supabase-js` calls in their `services/*.ts` layer for calls to this API

### Out of Scope

- Phone/SMS OTP signup — dropped for this migration to cut Twilio integration cost; may return as a later phase if still needed
- Realtime subscriptions — current apps don't use Supabase Realtime (verified: zero usages across all three apps), so no realtime/websocket layer is being built; cross-app visibility is via polling/refetch as today
- Storage (file uploads) — not used anywhere in the current apps, not being built
- Production data migration from the live Supabase project — starting the new SQLite DB fresh; existing production data is not being carried over
- Concrete hosting/deployment target — deliberately deferred; server must just not assume a specific platform
- Rewiring the three client apps' UI/screens — only the `services/*.ts` + `app/_layout.tsx` layer in each app talks to the backend; actual client-side rewiring happens in each app's own repo, informed by (but not executed as part of) this project

## Context

- This project's code and planning live in `projetos/server/` (new git repo, sibling to the existing `admin/`, `mechanic/`, `oficina/`, and `supabase/` folders).
- The three client apps (`admin`, `mechanic`, `oficina`) are separate git repos under `projetos/`, each Expo/React Native, each currently pointing at the same Supabase project via `EXPO_PUBLIC_SUPABASE_URL`/`EXPO_PUBLIC_SUPABASE_ANON_KEY`. Only ~4-10 files per app touch Supabase directly (the `services/*.ts` layer + `app/_layout.tsx`), which keeps client rewiring scope small once this server exists.
- `projetos/supabase/` is the current (soon-to-be-replaced) shared backend: 2 edge functions (`admin-create-mechanic`, `admin-delete-mechanics`), docs, and empty SQL scripts folder — no migrations folder; real schema SQL lives duplicated across `mechanic/scripts/sql/` and `oficina/scripts/sql/` (byte-identical files) plus `admin/scripts/sql/` (admin-only additive migrations).
- Business logic today lives almost entirely in Postgres SECURITY DEFINER RPCs with RLS-based authorization — this is the single biggest porting cost, since there's no client-side equivalent to fall back on.
- `book_client_appointment` currently relies on `SELECT … FOR UPDATE` plus a partial unique index to prevent double-booking a timeslot; SQLite has no row-level locking, so the new server must achieve the same guarantee via write transactions + a unique constraint (acceptable at this app's traffic volume).
- `tests-e2e/` (root-level, sibling to these repos) runs Playwright flows against the live Supabase project directly via its own `@supabase/supabase-js` client + `db.ts` helper — will need to be repointed at this new server once it exists (not part of this project's scope, but a known downstream dependency).
- `--auto`/deep-research subagents (`gsd-project-researcher`, `gsd-research-synthesizer`) are not installed in this environment; this project's roadmap was built directly from requirements/context rather than automated domain research.

## Constraints

- **Tech stack**: Node.js server, SQLite as the storage engine (better-sqlite3 + Drizzle ORM recommended) — chosen specifically to replace Postgres/Supabase, not negotiable for this project
- **Compatibility**: Must preserve current multi-role (`admin`/`mechanic`/`client`), multi-app (3 separate Expo apps) shared-backend behavior — no per-device/offline-only architecture
- **Concurrency**: Booking must remain safe against concurrent double-booking of the same timeslot, without Postgres-style row locking
- **Auth surface**: Email+password only for this migration; no phone/SMS OTP
- **Data**: No production data carryover — schema-only port, fresh database
- **Hosting**: Must not hard-code assumptions about a specific host/platform; hosting decision deferred

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| New dedicated repo `projetos/server/` rather than reusing `projetos/supabase/` | Keeps `supabase/` as an untouched historical record until cutover; avoids a backend that isn't Supabase living in a folder named "supabase" | ✓ Good |
| Self-hosted server + SQLite (not per-device local-only SQLite) | Current system requires shared multi-user state (double-booking prevention, cross-app/cross-role visibility, shared auth) that per-device SQLite can't provide without a full sync layer | ✓ Good |
| Drop phone/SMS OTP for this migration | Cuts significant auth complexity and a paid third-party (Twilio) dependency; can be reintroduced as a later phase | ✓ Good |
| Start with a fresh SQLite DB, no production data migration | Current Supabase data is not being preserved; avoids Postgres→SQLite type-transform work (uuid/timestamptz/jsonb) blocking the roadmap | ✓ Good |
| Defer concrete hosting platform | Avoids premature lock-in; server built as a portable Node process instead | — Pending |
| `notifications` table schema inferred from client-code usage, not live introspection | No `CREATE TABLE notifications` exists in any committed repo, and it turned out the feature was never actually implemented in production; Supabase project access is also gone entirely (confirmed during Phase 1 discussion) | ✓ Good |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-08-07 after initialization*
