---
phase: 01-foundation-auth-walking-skeleton
plan: 02
subsystem: database
tags: [drizzle-orm, better-sqlite3, sqlite-triggers, drizzle-kit, vitest]

# Dependency graph
requires:
  - phase: 01-01
    provides: "src/db/schema.ts's profiles table, ROLES const, createDb()/runMigrations(), tests/helpers/db.ts's makeTestDb() pattern"
provides:
  - "The full nine-table DATA-01 schema (mechanics, public_mechanics, timeslots, appointments, appointment_service_reports, appointment_service_items, admin_action_log, notifications) in src/db/schema.ts"
  - "APPOINTMENT_STATUSES/AppointmentStatus and ADMIN_ACTIONS/AdminAction literal-set exports, following the ROLES pattern"
  - "The partial unique index on appointments.timeslot_id restricted to active statuses — Phase 2's sole database-level double-booking guard"
  - "Six SQLite triggers keeping public_mechanics in sync with profiles/mechanics with zero application-level sync code"
  - "The real SQLite file at DB_PATH, migrated and proven to hold all nine tables and six triggers"
affects: [01-03, phase-02-booking, phase-03-admin, phase-04-notifications]

# Actuals (#2632)
actuals:
  tokens: 29100
  tasks: 3
  commits: 4

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "as-const literal-set pattern (ROLES from 01-01) extended to APPOINTMENT_STATUSES and ADMIN_ACTIONS"
    - "Drizzle's `text(col, { enum: [...] })` is TypeScript-only — does NOT emit a SQL CHECK constraint. Enum-like columns that need database-level rejection (not just TS narrowing) need an explicit `check(...)` in the table's extraConfig array"
    - "sqlLiteralInList() helper — CHECK constraints cannot use bound `?` parameters (SQLite rejects them at CREATE TABLE time with 'parameters prohibited in CHECK constraints'), so static as-const literal sets are inlined as escaped SQL string literals when building an IN (...) CHECK"
    - "drizzle-kit generate --custom for hand-written SQL (trigger DDL) that drizzle-kit cannot model — registers the file in meta/_journal.json so runMigrations actually applies it, unlike a hand-dropped .sql file"
    - "Delete-then-filtered-insert trigger body shape: withdrawal (deactivation, role change) works for free because the INSERT's WHERE clause simply matches nothing once a row no longer qualifies — never replace with an upsert"

key-files:
  created:
    - tests/db/schema.test.ts
    - tests/db/public-mechanics-sync.test.ts
    - src/db/migrations/0001_many_senator_kelly.sql
    - src/db/migrations/0002_public_mechanics_triggers.sql
    - src/db/migrations/meta/0001_snapshot.json
    - src/db/migrations/meta/0002_snapshot.json
  modified:
    - src/db/schema.ts
    - src/db/migrations/meta/_journal.json

key-decisions:
  - "Added explicit check(...) CHECK constraints for appointments.status and admin_action_log.action, deviating from the plan's implicit assumption that Drizzle's { enum } column option enforces the value set at the database level — it doesn't; profiles.role from 01-01 has the same gap, but that table is explicitly frozen (byte-identical) by this plan's own acceptance criteria, so only this plan's two new enum-like columns were fixed."
  - "Generated the 0001 table migration during Task 1 (required for makeTestDb() to build a working temp db for that task's own tests) but deferred its git commit to Task 2's commit, since Task 2's <files> ownership explicitly includes src/db/migrations/ and Task 2's own trigger tests equally require the tables it creates — mirrors 01-01's precedent of generating early, committing at the task that owns the migrations directory."
  - "Task 3 produced no code commit: the README's documented setup/run sequence worked verbatim against the real file, so nothing needed fixing, and data/dev.sqlite is (correctly) gitignored. Task 3's contribution is the verification evidence recorded below, not a diff."

requirements-completed: [DATA-01, DATA-02, DATA-03]

coverage:
  - id: D1
    description: "The full nine-table DATA-01 schema exists with the source system's constraints, indexes, and cascade behavior faithfully ported to SQLite (table presence, notifications' eleven-column set, all constraint enforcement/permissiveness cases, cascade deletes)"
    requirement: "DATA-01"
    verification:
      - kind: unit
        ref: "tests/db/schema.test.ts#DATA-01: full nine-table schema > creates all nine DATA-01 tables"
        status: pass
      - kind: unit
        ref: "tests/db/schema.test.ts#DATA-01: full nine-table schema > constraint enforcement — each insert must throw (7 cases)"
        status: pass
      - kind: unit
        ref: "tests/db/schema.test.ts#DATA-01: full nine-table schema > constraint permissiveness — each insert must succeed (4 cases)"
        status: pass
      - kind: unit
        ref: "tests/db/schema.test.ts#DATA-01: full nine-table schema > cascade behavior (2 cases)"
        status: pass
    human_judgment: false
  - id: D2
    description: "notifications carries exactly the eleven client-evidenced columns (id, recipient_id, actor_id, appointment_id, type, title, body, data, read_at, created_at, updated_at), with its unverified/inferred provenance recorded as a source comment"
    requirement: "DATA-02"
    verification:
      - kind: unit
        ref: "tests/db/schema.test.ts#notifications column set (DATA-02) > has exactly the eleven client-evidenced columns"
        status: pass
      - kind: unit
        ref: "tests/db/schema.test.ts#notifications column set (DATA-02) > defaults data to the empty-object literal and read_at to null when omitted"
        status: pass
    human_judgment: false
  - id: D3
    description: "public_mechanics is pinned to exactly five columns (no contact/credential field) and stays in sync with profiles/mechanics automatically via six SQLite triggers — appearance, propagation, withdrawal (deactivation/role-change/deletion), and exclusion all proven with zero application-level sync calls"
    requirement: "DATA-03"
    verification:
      - kind: unit
        ref: "tests/db/schema.test.ts#public_mechanics projection column set (DATA-03 privacy prohibition) > has exactly five columns and no contact or credential field"
        status: pass
      - kind: unit
        ref: "tests/db/public-mechanics-sync.test.ts#DATA-03: public_mechanics self-maintaining projection (15 cases: installation, appearance, propagation, withdrawal, exclusion)"
        status: pass
    human_judgment: false
  - id: D4
    description: "The real SQLite file at DB_PATH provably holds the complete nine-table schema and all six triggers after npm run db:migrate; the projection demonstrably maintains itself against that real file (not just the vitest temp db); re-running the migration command is a no-op; the developer's database is left empty"
    verification:
      - kind: manual_procedural
        ref: "Task 3 acceptance criteria — db:migrate run twice against ./data/dev.sqlite, sqlite_master table/trigger count query, direct insert/deactivate/cleanup against public_mechanics via a real short-lived process, __drizzle_migrations row count confirming zero new migrations on the second run, npm run dev + live GET /health request, all executed and confirmed this session"
        status: pass
    human_judgment: true
    rationale: "Proven this session via direct commands against the real file (see Task Commits / Accomplishments below) but not captured as an automated CI test — a future smoke-test harness could assert this, but this plan proved it by hand against the real file as the plan's <action> requires, matching 01-01's D5 precedent."

# Metrics
duration: ~35min
completed: 2026-08-08
status: complete
---

# Phase 1 Plan 2: Full Data Model & Self-Maintaining Public Mechanic Directory Summary

**Nine-table Drizzle/SQLite schema (mechanics, timeslots, appointments with a partial-unique double-booking guard, service reports/items, admin action log, and an inferred notifications table) plus six hand-written SQLite triggers that keep `public_mechanics` in sync with zero application code.**

## Performance

- **Duration:** ~35 min
- **Completed:** 2026-08-08T13:03:17Z
- **Tasks:** 3 (Task 1: data model + tests; Task 2: sync triggers + tests; Task 3: real-file push + smoke proof, blocking)
- **Files created:** 6 (2 test files, 2 migration `.sql` files, 2 drizzle-kit snapshot `.json` files)
- **Files modified:** 2 (`src/db/schema.ts`, `src/db/migrations/meta/_journal.json`)

## Accomplishments

- `src/db/schema.ts` grew from one table to nine: `mechanics`, `timeslots`, `appointments` (four-value status set, partial unique index over `timeslot_id` restricted to the two active statuses — Phase 2's entire database-level double-booking defence), `public_mechanics`, `appointment_service_reports`, `appointment_service_items`, `admin_action_log` (clean two-value `ADMIN_ACTIONS` set, dropping the source's two dead approval-era values), and `notifications` (D-01/D-02 inferred, provenance comment documents Phase 4 must re-derive it). `profiles`/`ROLES` from 01-01 are byte-identical (`git diff` shows only the top-of-file import line widened, plus pure additions below).
- All DATA-01 constraint behavior is proven by test, not assumed: status/action enum rejection, the partial unique index rejecting a second active booking on the same timeslot (while permitting rebooking after cancellation), timeslot time-ordering, service report/item length and non-negative-amount checks, the `mechanics -> profiles` foreign key, and cascade deletes (`profiles -> mechanics`, `appointment_service_reports -> appointment_service_items`) — 18/18 tests in `tests/db/schema.test.ts`.
- Six SQLite triggers (`trg_public_mechanics_{profiles,mechanics}_{ai,au,ad}`) inline Postgres's `refresh_public_mechanic()` delete-then-filtered-insert logic. `public_mechanics` appears, propagates name/avatar/specialty changes (and advances `updated_at`), and withdraws on deactivation, role change, or deletion — all with zero application-level sync calls, proven against both the vitest temp db (15/15 tests in `tests/db/public-mechanics-sync.test.ts`) and the real `DB_PATH` file directly.
- The custom trigger migration is registered in the migrations journal (verified: 3 journal entries, not merely a `.sql` file dropped on disk) and applied by `runMigrations`/`npm run db:migrate` for real.
- `npm run db:migrate` proven idempotent against the real file: `__drizzle_migrations` holds exactly 3 rows after two consecutive runs.
- `npm run dev` started against the real file and answered `GET /health` with 200 `{"status":"ok","db":"ok"}`; server stopped cleanly afterward.
- No migration file or schema comment reproduces the source system's `GRANT`/`REVOKE`/`ROW LEVEL SECURITY`/`SECURITY DEFINER`/`CREATE POLICY` statements (grepped clean across all three migration files) — Phase 1 correctly has no access-control layer, and nothing suggests otherwise.
- 47/47 vitest tests pass (14 from 01-01 + 18 + 15 from this plan); `npm run build` (`tsc --noEmit --strict`) is clean.

## Task Commits

Each task was committed atomically (TDD RED/GREEN pairs):

1. **Task 1: Complete the data model** — `5742d6b` (test, RED — 16/18 red against the single-table schema), `79fb2a5` (feat, GREEN — all nine tables, `npx vitest run tests/db/schema.test.ts` 18/18 green)
2. **Task 2: Make public_mechanics self-maintaining** — `972fbfc` (test, RED — 12/15 red with no triggers installed), `0ae3674` (feat, GREEN — six triggers + the deferred Task 1 table migration, both committed together since Task 2's `<files>` owns `src/db/migrations/`; `npx vitest run` 47/47 green)
3. **Task 3: Push to the real SQLite file** — no code commit. README's documented setup sequence (`cp .env.example .env`, `npm install`, `npm run db:generate`, `npm run db:migrate`) worked verbatim; nothing needed fixing. `data/dev.sqlite` is correctly gitignored (never committed). All verification evidence for this task is recorded above and in the self-check below.

_TDD gate compliance: both `test(01-02)` commits precede their matching `feat(01-02)` commits in git log (confirmed via `git log --oneline`). No REFACTOR commits were needed._

## Files Created/Modified

- `src/db/schema.ts` — extended from `profiles` alone to the full nine-table DATA-01 schema; `APPOINTMENT_STATUSES`/`AppointmentStatus`, `ADMIN_ACTIONS`/`AdminAction` exports; `sqlLiteralInList()` internal helper for enum CHECK constraints
- `tests/db/schema.test.ts` — DATA-01/DATA-02 coverage: table presence, notifications column set, constraint enforcement/permissiveness, cascades
- `tests/db/public-mechanics-sync.test.ts` — DATA-03 coverage: appearance, propagation, withdrawal, exclusion, installation
- `src/db/migrations/0001_many_senator_kelly.sql` (+ `meta/0001_snapshot.json`) — drizzle-kit generated migration for the eight new tables and their indexes, committed as source
- `src/db/migrations/0002_public_mechanics_triggers.sql` (+ `meta/0002_snapshot.json`) — hand-written custom migration (via `drizzle-kit generate --custom`) holding the six sync triggers
- `src/db/migrations/meta/_journal.json` — updated to register both new migrations

## Decisions Made

- **[Rule 1 - Bug] Added explicit `check(...)` CHECK constraints for `appointments.status` and `admin_action_log.action`.** Drizzle's `text(col, { enum: [...] })` option is TypeScript-only type narrowing — it does not emit a SQL CHECK constraint (confirmed by inspecting drizzle-kit's generated DDL, and by the pre-existing `profiles.role` column from 01-01 also having no CHECK). Two of this plan's own `<behavior>` assertions require database-level rejection of out-of-set `status`/`action` values, so an explicit constraint was required for the schema to actually satisfy its own test suite — this is a correctness fix to make the plan's stated behavior true, not a scope addition. `profiles.role`'s equivalent gap was left alone since `profiles.ts` is explicitly frozen byte-identical by this plan's acceptance criteria (out of scope: pre-existing, caused by 01-01, not this plan's changes).
- Fastify/argon2/native-addon Windows build fix from 01-01's README troubleshooting section (`--ignore-scripts` install + `node-gyp configure --clang=0 && node-gyp build` for `better-sqlite3`) was needed again in this fresh worktree's separate `node_modules` — applied per the documented steps, no new deviation.
- Migration commit ownership: generated `0001` during Task 1 (necessary for its own tests to run against a real temp db) but committed it alongside `0002` in Task 2, since Task 2's plan-declared `<files>` includes `src/db/migrations/` and both migrations are needed together for a coherent, working migrations directory.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `appointments.status` and `admin_action_log.action` needed explicit CHECK constraints, not just Drizzle's `{ enum }` type option**
- **Found during:** Task 1, first `npx vitest run tests/db/schema.test.ts` after generating the migration — 2/18 tests failed ("expected [Function] to throw an error") for the two enum-rejection cases
- **Issue:** Drizzle's `{ enum: [...] }` column option only narrows the TypeScript type; it does not generate a SQL `CHECK (col IN (...))` constraint. The generated migration's `status`/`action` columns had no constraint at all, so an out-of-set value inserted successfully instead of throwing.
- **Fix:** Added `check('appointments_status_check', ...)` and `check('admin_action_log_action_check', ...)` to each table's `extraConfig` array, deriving the value list from `APPOINTMENT_STATUSES`/`ADMIN_ACTIONS` via a small `sqlLiteralInList()` helper.
- **Second issue found mid-fix:** The first attempt built the `IN (...)` list using `sql.join(values.map(v => sql\`${v}\`), sql\`, \`)`, which binds each value as a `?` parameter. SQLite's CREATE TABLE parser rejects bound parameters inside CHECK constraints ("parameters prohibited in CHECK constraints"), so `runMigrations` threw at migration-apply time.
- **Second fix:** `sqlLiteralInList()` inlines each value as an escaped SQL string literal (`sql.raw(...)`) instead of a bound parameter — safe because every caller passes one of this file's own `as const` arrays, never user/runtime input.
- **Files modified:** `src/db/schema.ts`
- **Verification:** `npx vitest run tests/db/schema.test.ts` — 18/18 pass; generated migration SQL inspected directly and confirmed literal values (`CHECK("appointments"."status" IN ('confirmado', 'nao_finalizado', 'cancelado', 'acabado'))`), not bind-parameter placeholders
- **Committed in:** `79fb2a5` (Task 1 GREEN commit)

---

**Total deviations:** 1 auto-fixed (1 bug, discovered and fixed in two steps within the same task). **Impact on plan:** Necessary for the plan's own `<behavior>` assertions to be true at the database level; no scope creep, no architectural change — same two columns, same value sets, just an added constraint neither the plan text nor 01-01's `{ enum }` precedent flagged as insufficient.

## Issues Encountered

- Fresh worktree, fresh `node_modules`: hit the same `better-sqlite3` ClangCL/MSVC toolset build failure documented in README's Troubleshooting section (from 01-01). Resolved with the documented `npm install --ignore-scripts` + `npm rebuild argon2` + `node-gyp configure --clang=0 && node-gyp build` (inside `node_modules/better-sqlite3`) sequence — not a new issue, the documented fallback worked exactly as written.

## User Setup Required

None — no external service configuration required. `.env` was created in this worktree from the documented variable set (`DB_PATH`, `PORT`, `JWT_SECRET` — 64 hex chars, `JWT_EXPIRY_SECONDS`); `.env` is gitignored, never committed.

## Known Stubs

None. Every table, constraint, index, and trigger this plan specifies is fully implemented and proven by test — no placeholder data, no unwired columns, no `TODO`/`FIXME` markers introduced.

## Next Phase Readiness

- The complete DATA-01/DATA-02/DATA-03 foundation is ready for 01-03 (login/logout session lifecycle) and every later phase: Phase 2's booking logic writes into `timeslots`/`appointments` against an already-proven double-booking guard; Phase 3's admin logic writes into `admin_action_log` against an already-clean action set; Phase 4 must re-derive `notifications` from scratch per its documented unverified provenance, not trust this plan's assumptions.
- `public_mechanics` requires zero future application-level sync code — any future write path to `profiles`/`mechanics` is automatically reflected, by design.
- One repo-wide pattern worth carrying forward: Drizzle's `{ enum }` column option is TS-only. Any future enum-like column (e.g., a Phase 3/4 status field) needs an explicit `check(...)` constraint if database-level rejection is required, not just the `{ enum }` shorthand — `profiles.role` from 01-01 still lacks one; if Phase 2+ needs `role` rejection enforced at the DB level (not just via zod/TS at the API boundary), that gap will need a follow-up migration.
- No blockers for 01-03.

## Self-Check: PASSED

- All key files confirmed present on disk: `src/db/schema.ts`, `tests/db/schema.test.ts`, `tests/db/public-mechanics-sync.test.ts`, `src/db/migrations/0001_many_senator_kelly.sql`, `src/db/migrations/0002_public_mechanics_triggers.sql` (`ls` confirmed all five).
- Commit hashes confirmed present in `git log --oneline --all`: `5742d6b` (test, RED), `79fb2a5` (feat, GREEN), `972fbfc` (test, RED), `0ae3674` (feat, GREEN).
- Plan-level `<verification>` re-run and confirmed: `npx vitest run` → 47/47 pass; `npm run build` → exits 0; real `DB_PATH` file confirmed to contain all nine tables and exactly six triggers via a separate short-lived process; `PRAGMA table_info(notifications)` → eleven columns exactly; `PRAGMA table_info(public_mechanics)` → five columns, no contact/credential field; insert/deactivate against the real file proved the projection self-maintains; `grep`-clean across all migration files for drop-table/GRANT/REVOKE/RLS/SECURITY DEFINER/CREATE POLICY; `npm run db:migrate` run twice — `__drizzle_migrations` holds exactly 3 rows both times.
- TDD gate compliance confirmed: both `test(01-02)` commits precede their matching `feat(01-02)` commits in git log.

---
*Phase: 01-foundation-auth-walking-skeleton*
*Completed: 2026-08-08*
