# Phase 1: Foundation & Auth Walking Skeleton - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-07
**Phase:** 1-Foundation & Auth Walking Skeleton
**Areas discussed:** Notifications schema recovery, Token/session strategy, First admin bootstrap, Signup default role

---

## Notifications schema recovery

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, I can query it | Run SQL against the live Supabase project and paste back the result | |
| No, but I remember the columns | Describe columns/types from memory | |
| No access, don't remember | Infer schema from `notification-service.ts` usage, flag as unverified | (effectively this, via free text) |

**User's choice:** Free text — "notifications weren't planned/implemented, i have no access to supabase anymore"
**Notes:** Changes DATA-02 from "recover via live introspection" to "infer from client code usage, treat as unverified." No future phase in this project can assume live Supabase access is available.

---

## Token/session strategy

**Q1 — Session mechanism:**

| Option | Description | Selected |
|--------|-------------|----------|
| Access + refresh token pair (Recommended) | Mirrors current Supabase behavior — short-lived access token + revocable refresh token | |
| Single long-lived JWT | Simpler to build; logout can't invalidate without a blocklist | ✓ |

**Q2 — Token/blocklist storage:**

| Option | Description | Selected |
|--------|-------------|----------|
| Same SQLite DB (Recommended) | No new infrastructure | ✓ |
| In-memory only | Simplest, but server restart logs everyone out | |

**User's choice:** Single long-lived JWT + SQLite-backed logout blocklist
**Notes:** Chosen for build simplicity over mirroring Supabase's two-token flow exactly. Flagged in CONTEXT.md as a "costly" reversibility decision since changing it later touches every client app's auth code.

---

## First admin bootstrap

| Option | Description | Selected |
|--------|-------------|----------|
| Seed script (Recommended) | Manual Node script, mirrors existing `seed.js`/`create-mechanic-auth-users.js` pattern | ✓ |
| Env-var bootstrap on first boot | Server auto-creates admin from env vars if none exist | |
| Manual SQL insert | No tooling, raw INSERT | |

**User's choice:** Seed script
**Notes:** None beyond the selection.

---

## Signup default role

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, always 'client' (Recommended) | Matches current behavior — self-signup is client-only | ✓ |
| Something different | Freeform alternative | |

**User's choice:** Yes, always 'client'
**Notes:** Mechanic/admin accounts only via ADMIN-01 (Phase 3) or the bootstrap seed script (D-06).

---

## Claude's Discretion

- Web framework (Express/Fastify/etc.)
- ORM choice (Drizzle recommended in PROJECT.md, not re-litigated)
- Password hashing algorithm/cost factor
- Exact JWT expiry duration
- Local dev SQLite file location/naming

## Deferred Ideas

- AUTH-04 (role-based authorization middleware) and the admin-only-login nuance from `admin/services/auth-service.ts` — belongs to Phase 2, noted for that phase's discussion.
