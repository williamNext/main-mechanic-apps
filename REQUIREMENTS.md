# Requirements — Workshop platform backend

**Core value:** Clients can book a mechanic timeslot and mechanics/admins can manage it without double-booking or losing cross-app visibility — a booking, cancellation or completion made in one app is correctly visible to the others — with the same correctness guarantees the Supabase+Postgres setup provided, self-hosted on SQLite.

**Status of this document.** Canonical register of the requirement IDs cited throughout [`PROJECT_CONTEXT.md`](PROJECT_CONTEXT.md). Originally defined 2026-08-07 in `server/.planning/REQUIREMENTS.md` under the GSD workflow; **salvaged to the repository root on 2026-08-11 when GSD was deprecated** (see [`server/.planning/README.md`](server/.planning/README.md)). The GSD copy is frozen history and must not be updated.

`PROJECT_CONTEXT.md` remains **normative** for business rules (§8) and decisions (§10.3). Where this file and §8 disagree, §8 wins.

---

## v1 requirements

### Authentication

| ID | Requirement | Phase | Status |
|---|---|---|---|
| **AUTH-01** | Client can sign up with email and password | 1 | ✅ Complete |
| **AUTH-02** | User of any role can log in with email and password and stay logged in across app restarts | 1 | ✅ Complete |
| **AUTH-03** | User can log out, invalidating their session | 1 | ✅ Complete |
| **AUTH-04** | Every API endpoint enforces role-based authorization (`admin`/`mechanic`/`client`) via server-side middleware — no endpoint trusts a client-supplied role claim | 2 | ⬜ Pending |

> AUTH-02's original wording said the session was "refreshable". It is not: the design is a single 30-day JWT with no refresh flow (§9.3, §17.4). Persistence across restarts is what is required and what ships.

### Data & schema

| ID | Requirement | Phase | Status |
|---|---|---|---|
| **DATA-01** | Server defines and migrates a SQLite schema covering `profiles`, `mechanics`, `public_mechanics`, `timeslots`, `appointments`, `appointment_service_reports`, `appointment_service_items`, `admin_action_log`, `notifications` | 1 | ✅ Complete |
| **DATA-02** | `notifications` schema is ported as a best-effort, **unverified** shape inferred from client-code usage — live introspection is impossible | 1 | ✅ Complete, superseded by D-K |
| **DATA-03** | `public_mechanics` stays in sync with `profiles`/`mechanics` changes, preserving the read-only denormalized-projection behaviour | 1 | ✅ Complete |

> **DATA-02 is the one to read carefully.** No `CREATE TABLE notifications` exists in any repo, the feature was never actually implemented in production, and Supabase project access is gone — so the shipped shape is a guess, flagged ⚠️ UNVERIFIED in §7.2. Decision **D-K** (2026-08-11) supersedes it: the notification UI already built in `oficina` and `mechanic` is now the specification for the table shape, and reshaping is a free `DROP`/recreate because nothing is in production.

### Booking & appointments

| ID | Requirement | Phase | Status |
|---|---|---|---|
| **BOOK-01** | Client can book an available timeslot; concurrent attempts on the same timeslot never both succeed | 2 | ⬜ Pending |
| **BOOK-02** | Client can cancel their own confirmed or unfinalized appointment, freeing the timeslot for rebooking | 2 | ⬜ Pending |
| **BOOK-03** | Mechanic can cancel an appointment assigned to them | 2 | ⬜ Pending |
| **BOOK-04** | Mechanic can mark an appointment complete, recording a service report (summary, diagnosis, work performed, parts used, recommendations, total) with line items | 2 | ⬜ Pending |
| **BOOK-05** | Appointment status auto-transitions (`confirmado` → `nao_finalizado` → `acabado`) are computed on read/list | 2 | ⬜ Pending |

> BOOK-01 is the concurrency-critical path. Postgres achieved it with `SELECT … FOR UPDATE` plus a partial unique index; SQLite has no row-level locking, so it must be a write transaction plus a unique constraint — acceptable at this application's traffic volume.

### Admin management

| ID | Requirement | Phase | Status |
|---|---|---|---|
| **ADMIN-01** | Admin can create a mechanic account (auth user + profile + mechanic record) in one authenticated action, replacing the `admin-create-mechanic` edge function | 3 | ✅ Done |
| **ADMIN-02** | Admin can deactivate and reactivate a mechanic account, retaining service history and recording before/after state in `admin_action_log`, replacing destructive mechanic deletion | 3 | ✅ Done |
| **ADMIN-03** | Admin can retrieve dashboard summary, mechanic list/detail, appointment list/detail and financial reports, replacing the `admin_*` reporting RPCs | 3 | ✅ Done |

### Notifications

| ID | Requirement | Phase | Status |
|---|---|---|---|
| **NOTIF-01** | Booking, cancellation and completion create notification rows visible to the counterpart role (client ↔ mechanic) | **2** (was 4) | ⬜ Pending |
| **NOTIF-02** | User can list their own notifications and mark them read | **2–3** (was 4) | ⬜ Pending |

> **Remapped 2026-08-11 by decision D-K.** Phase 4 is dissolved. Fan-out lands inside the Phase 2 book/cancel/complete transactions that cause it, rather than in a later phase that would reopen all three handlers.

### Infrastructure

| ID | Requirement | Phase | Status |
|---|---|---|---|
| **INFRA-01** | Server is a portable Node process configured entirely via environment variables (SQLite path, port, JWT secret) with no hosting-platform-specific code | 1 | ✅ Complete |
| **INFRA-02** | Server runs locally against a local SQLite file, with a documented setup and run command | 1 | ✅ Complete |
| **INFRA-03** | Every server failure returns the house error envelope `{ error: '<lowercase message>' }`, via a handler registered inside `buildApp` | 1.5 | ⬜ Pending |
| **INFRA-04** | An Expo web build can reach the server without CORS errors, configured inside `buildApp` so tests exercise it | 1.5 | ⬜ Pending |
| **INFRA-05** | A `seed:dev` command fills an empty development database with a believable workshop, with known passwords, idempotently, refusing to run against a non-development database | 1.5 | ⬜ Pending |
| **INFRA-06** | Secrets scanning and the server test suite run at the repository root and gate merges | 1.5 | ⬜ Pending |
| **INFRA-07** | `oficina` authenticates against the self-hosted server end to end, on web and on a device, guarded by an automated end-to-end spec | 1.5 | ⬜ Pending |

> INFRA-03 … INFRA-07 were **added 2026-08-11** to cover Phase 1.5, which postdates the original register. They correspond to the tickets in `.scratch/phase-1.5-prove-the-wire/issues/` — see the traceability table below.

---

## v2 requirements

Tracked, deliberately deferred, not in the current roadmap.

| ID | Requirement | Reason deferred |
|---|---|---|
| **AUTH-05** | Phone/SMS OTP signup and login | Dropped for this migration — cuts significant auth complexity and a paid Twilio dependency. The login/register UIs still contain phone paths; Phase 1.5 removes them. |
| **DATA-04** | Production data migration from the live Supabase project | Nothing is in production and there are no users, so there is nothing to export (**D-L**). Avoids the uuid/timestamptz/jsonb → SQLite transform entirely. |

---

## Out of scope

| Item | Reason |
|---|---|
| Realtime subscriptions (websocket push) | Not used anywhere in the current apps — verified, zero usages. Cross-app visibility is by polling and refetch, as today (§13.4). |
| File and object storage | Not used anywhere in the current apps. |
| A concrete hosting or deployment target | **Deliberately deferred, and the last open design question.** Stops being deferrable around the end of Phase 3: a workshop LAN box makes a 30-day JWT on an unencrypted network and an unbacked-up SQLite file into real problems, and a deployed host needs CORS origins that do not exist yet. Neither is budgeted. |
| Password recovery (UC-A6) | Not implemented anywhere. The requested design was phone-based, and phone auth is being dropped, so it needs an email-based design decision first — and needs one before any real user depends on this system. |
| Rate limiting on `/auth/login` | Deferred (**D-H**). A `TODO` sits at the route. |
| Structured logging | `Fastify({ logger: false })` stands. |

> The original register also listed *"client app UI/screen changes"* and *"`tests-e2e/` repointing"* as out of scope. **Both are now in scope** — they were out of scope only for the standalone `server/` repo's own phases, and that framing died when the four repos became one monorepo on 2026-08-11. The client rewire is §16 and Phase 1.5; the e2e suites are replaced in Phase 1.5.

---

## Traceability

| Phase | Requirements | Tickets |
|---|---|---|
| **1 — Foundation & auth walking skeleton** ✅ | AUTH-01, AUTH-02, AUTH-03, DATA-01, DATA-02, DATA-03, INFRA-01, INFRA-02 | Completed 2026-08-08 |
| **1.5 — Prove the wire** (current) | INFRA-03 … INFRA-07 | `.scratch/phase-1.5-prove-the-wire/issues/01`–`07` |
| **2 — Booking & appointment lifecycle** | AUTH-04, BOOK-01 … BOOK-05, NOTIF-01, NOTIF-02 | Not yet broken down |
| **3 — Admin management** | ADMIN-01, ADMIN-02, ADMIN-03 | `.scratch/phase-3-admin-management/issues/01`–`12`, tickets 01–11 done, 12 (e2e) remaining |
| ~~**4 — Notifications**~~ | Dissolved into Phases 2–3 by D-K | — |

**Coverage:** 26 v1 requirements, all mapped to a phase, none unmapped.

Per-ticket mapping for Phase 1.5: INFRA-06 → ticket 01 · INFRA-03 → 02 · INFRA-04 → 03 · INFRA-05 → 04 · INFRA-07 → 05, 06, 07.
