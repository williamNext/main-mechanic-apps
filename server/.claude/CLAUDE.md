## Project

**Workshop backend server** — the self-hosted replacement for the shared Supabase project.

A Node.js API server backed by SQLite, serving all three sibling Expo apps — `admin`, `mechanic`, and `oficina` (client-facing) — in a car-workshop booking system. One database, one auth system, one set of business-logic endpoints, segmented by role (`admin` / `mechanic` / `client`).

**Core value:** Clients can book a mechanic timeslot and mechanics/admins can manage it without double-booking or losing cross-app visibility — a booking, cancellation or completion made in one app is correctly visible to the others — with the same correctness guarantees the Supabase+Postgres setup provided, self-hosted on SQLite.

Since 2026-08-11 this directory is part of the `main-mechanic-apps` monorepo, not its own repository. Changes here routinely land alongside changes in `oficina/`, `mechanic/`, `admin/` and root-level CI.

## Read these, in this order

| Doc | Why |
|---|---|
| [`../PROJECT_CONTEXT.md`](../PROJECT_CONTEXT.md) | **Normative.** §8 business rules, §9 this server, §10 API contracts and §10.3 decisions (`D-A`…`D-M`), §15.1 test skeleton. Use its §1.1 table — it is ~1700 lines, do not read it whole |
| [`../REQUIREMENTS.md`](../REQUIREMENTS.md) | The `AUTH-`/`DATA-`/`BOOK-`/`ADMIN-`/`NOTIF-`/`INFRA-` requirement register, and which phase each belongs to |
| [`../SPEC-phase-1.5-prove-the-wire.md`](../SPEC-phase-1.5-prove-the-wire.md) | The current phase |

Where any document disagrees with `PROJECT_CONTEXT.md` §8, §8 wins.

## Constraints

- **Tech stack**: Node.js + SQLite (better-sqlite3 + Drizzle ORM) — chosen specifically to replace Postgres/Supabase, not negotiable
- **Compatibility**: preserve the multi-role, multi-app shared-backend behaviour — no per-device or offline-only architecture
- **Concurrency**: booking must stay safe against concurrent double-booking of the same timeslot, without Postgres-style row locking. A write transaction plus a unique constraint replaces `SELECT … FOR UPDATE` plus a partial unique index
- **Auth surface**: email and password only. No phone or SMS OTP
- **Data**: no production data carryover — schema-only port, fresh database
- **Hosting**: no hard-coded assumptions about a host or platform. The hosting decision is deferred and is the last open design question

## Conventions

- **Every endpoint ships with a test.** `tests/routes/auth.test.ts` is the pattern; the skeleton and helper names are in `PROJECT_CONTEXT.md` §15.1
- **Build through `buildApp(db, connection)`.** Both the real server and every test assemble the app through that one function — there is no test-only code path. Cross-cutting plugins (CORS, the error handler) register *inside* it so tests exercise the same configuration the server runs (**D-G**)
- **One error envelope**: `{ error: '<lowercase message>' }` on every failure (**D-C**). Clients substring-match these messages, so wording is a contract — never rewrite, wrap or prefix one
- **camelCase JSON** on the wire (**D-A**), so clients can delete their `map*Row` helpers
- **No path versioning** (**D-D**)
- **Never trust a role from a token.** Re-read it from the DB row. The server forces `client` on signup and strips any supplied role (§5, D-07)
- User-facing strings are Brazilian Portuguese; code and identifiers are English (§18.9, glossary in §19)
- Schema changes go through a Drizzle migration. Never edit an applied migration
- **Comments are prohibited unless the code is highly non-obvious** — a hidden constraint, a subtle invariant, a workaround for a specific bug. Never a comment explaining *what* the code does. Documentation, rationale and decision history belong in `PROJECT_CONTEXT.md` / `docs/`, never inline

## Planning

Planning artifacts live at the repository root: `PROJECT_CONTEXT.md`, `REQUIREMENTS.md`, the current `SPEC-*.md`, and tickets under `docs/phases/<phase>/issues/` (the location Phase 2b established; a phase's own orchestration session may also keep a working copy under `.scratch/<phase>/issues/`, which dies with that session).

`.planning/` in this directory is a **frozen historical record** of the GSD workflow used to build Phase 1 — deprecated 2026-08-11, read-only. See [`.planning/README.md`](.planning/README.md). Do not update it, and do not treat its `ROADMAP.md` or `STATE.md` as current; both predate Phase 1.5 and the dissolution of Phase 4.
