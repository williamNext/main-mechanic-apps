---
phase: 01-foundation-auth-walking-skeleton
plan: 01
subsystem: infra
tags: [fastify, better-sqlite3, drizzle-orm, argon2, jsonwebtoken, zod, vitest, typescript]

# Dependency graph
requires: []
provides:
  - "Portable Node/TypeScript/ESM server scaffold with npm scripts for dev/build/test/migrate"
  - "src/config/index.ts — the sole validated environment-config entry point (DB_PATH, PORT, JWT_SECRET, JWT_EXPIRY_SECONDS)"
  - "src/db/schema.ts's profiles table, ROLES const, and Role type — the base every later table/route in this phase builds on"
  - "src/db/client.ts createDb() and src/db/migrate.ts runMigrations() — the DB connection + migration pattern later plans reuse"
  - "src/auth/hash.ts and src/auth/jwt.ts — password hashing and JWT sign/verify primitives for login/logout in 01-03"
  - "src/app.ts buildApp() assembly point and tests/helpers/db.ts makeTestDb() — the pattern every later route/test in this phase follows"
  - "GET /health and POST /auth/signup, live against a real migrated SQLite file"
affects: [01-02, 01-03]

# Actuals (#2632)
actuals:
  tokens: 6800
  tasks: 3
  commits: 3

# Tech tracking
tech-stack:
  added: [fastify@5.11.3, better-sqlite3@13.0.3, drizzle-orm@0.45.2, drizzle-kit@0.31.10, jsonwebtoken@9.0.3, argon2@0.45.1, zod@4.4.3, dotenv@17.4.2, typescript@5.11.x, tsx@4.23.x, vitest@4.1.10]
  patterns:
    - "Single validated config module (src/config/index.ts) — every other module imports `config` from here, never reads process.env directly"
    - "buildApp(db, connection) assembly point shared by src/server.ts and every test — no test-only code path"
    - "tests/helpers/db.ts makeTestDb() — every test gets its own throwaway temp-file SQLite db, never touches the developer's DB_PATH"
    - "ROLES as-const array in schema.ts is the single source of truth for the role CHECK constraint and the Role TS type"
    - "JWT verification always pins `algorithms: ['HS256']` explicitly — never call jwt.verify() without an allowlist"

key-files:
  created:
    - src/config/index.ts
    - src/db/schema.ts
    - src/db/client.ts
    - src/db/migrate.ts
    - src/auth/hash.ts
    - src/auth/jwt.ts
    - src/routes/health.ts
    - src/routes/auth.ts
    - src/app.ts
    - src/server.ts
    - src/db/migrations/0000_tranquil_kinsey_walden.sql
    - tests/helpers/db.ts
    - tests/config.test.ts
    - tests/routes/auth.test.ts
    - package.json
    - tsconfig.json
    - drizzle.config.ts
    - vitest.config.ts
    - README.md
    - .env.example
    - .gitignore
    - .nvmrc
  modified: []

key-decisions:
  - "Chose Fastify's native inject() over supertest for HTTP-level tests — one fewer native dependency and one fewer package flagged by the legitimacy scan, matching 01-01-PLAN.md's divergence note from 01-VALIDATION.md."
  - "Used Node's built-in crypto.randomUUID() instead of the uuid package — zero-dependency, matches the architectural_contract."
  - "better-sqlite3's native addon build required forcing the MSVC v143 toolset over the default ClangCL toolset (Node 24.15.0's Windows build reports clang=1, but this machine's VS2022 Build Tools has an incomplete Clang component). Documented as a README troubleshooting fallback."

patterns-established:
  - "Pattern 1 (01-RESEARCH.md): config-driven, hosting-agnostic boot — all runtime config through one zod-validated module."
  - "N-API-based native addons (better-sqlite3, argon2) are safe to build against a different compiler toolset than Node itself was built with, since N-API is ABI-stable across compilers."

requirements-completed: [INFRA-01, INFRA-02, AUTH-01]

coverage:
  - id: D1
    description: "Server boots reading DB_PATH/PORT/JWT_SECRET from env via a single validated config module; fails fast with a message naming the offending variable when DB_PATH is absent, JWT_SECRET is absent, or JWT_SECRET is under 32 characters"
    requirement: "INFRA-01"
    verification:
      - kind: unit
        ref: "tests/config.test.ts#loadConfig > throws naming DB_PATH when DB_PATH is missing"
        status: pass
      - kind: unit
        ref: "tests/config.test.ts#loadConfig > throws naming JWT_SECRET when JWT_SECRET is missing"
        status: pass
      - kind: unit
        ref: "tests/config.test.ts#loadConfig > throws when JWT_SECRET is 31 characters, succeeds at 32"
        status: pass
      - kind: unit
        ref: "tests/config.test.ts#loadConfig > defaults PORT to 3000 when omitted, coerces string to number when supplied"
        status: pass
      - kind: unit
        ref: "tests/config.test.ts#loadConfig > defaults JWT_EXPIRY_SECONDS to 2592000 when omitted"
        status: pass
    human_judgment: false
  - id: D2
    description: "A brand-new client can POST /auth/signup with email/password and receive a signed JWT; the resulting profiles row has role=client and an argon2id password_hash, never the plaintext password"
    requirement: "AUTH-01"
    verification:
      - kind: integration
        ref: "tests/routes/auth.test.ts#POST /auth/signup > responds 201 with a token and a client-role user"
        status: pass
      - kind: integration
        ref: "tests/routes/auth.test.ts#POST /auth/signup > decoded JWT carries sub, role, and a non-empty jti"
        status: pass
      - kind: integration
        ref: "tests/routes/auth.test.ts#POST /auth/signup > stores an argon2id hash, never the plaintext password"
        status: pass
      - kind: integration
        ref: "tests/routes/auth.test.ts#POST /auth/signup > never returns password or password_hash in the response body"
        status: pass
    human_judgment: false
  - id: D3
    description: "Signup rejects a duplicate email with 409 and creates no second row; a client-supplied role is always overridden to client (D-07); malformed email/short password return 400"
    requirement: "AUTH-01"
    verification:
      - kind: integration
        ref: "tests/routes/auth.test.ts#POST /auth/signup > responds 409 on duplicate email and creates no second row"
        status: pass
      - kind: integration
        ref: "tests/routes/auth.test.ts#POST /auth/signup > ignores a client-supplied role and always creates a client account (D-07)"
        status: pass
      - kind: integration
        ref: "tests/routes/auth.test.ts#POST /auth/signup > responds 400 for a malformed email"
        status: pass
      - kind: integration
        ref: "tests/routes/auth.test.ts#POST /auth/signup > responds 400 for a password shorter than 8 characters"
        status: pass
    human_judgment: false
  - id: D4
    description: "GET /health responds 200 with a live database probe"
    verification:
      - kind: integration
        ref: "tests/routes/auth.test.ts#GET /health > responds 200 with status ok"
        status: pass
    human_judgment: false
  - id: D5
    description: "The real SQLite file at DB_PATH physically contains the profiles table and a __drizzle_migrations bookkeeping table after npm run db:migrate; re-running the migration command is idempotent; a running npm run dev server answers GET /health and POST /auth/signup for real"
    requirement: "INFRA-02"
    verification:
      - kind: manual_procedural
        ref: "Task 3 acceptance criteria — db:migrate run twice against ./data/dev.sqlite, sqlite_master query, npm run dev + live HTTP requests to /health and /auth/signup, all executed and confirmed this session"
        status: pass
    human_judgment: true
    rationale: "Proven this session via direct commands (see Task Commits below) but not captured as an automated test — a future CI/smoke-test harness could assert this, but this plan proved it by hand against the real file as the plan's <action> requires."

# Metrics
duration: 20min
completed: 2026-08-08
status: complete
---

# Phase 1 Plan 1: Foundation & Auth Walking Skeleton — Signup Tracer Summary

**Fastify + better-sqlite3 + Drizzle + argon2id + JWT walking skeleton: a portable Node/ESM server boots from validated env vars, migrates a real SQLite file, and lets a client sign up end-to-end via `POST /auth/signup`.**

## Performance

- **Duration:** ~20 min (this dispatch — Task 1's package-legitimacy checkpoint was approved in a prior session; this dispatch executed Tasks 2 and 3)
- **Completed:** 2026-08-08T12:22:05Z
- **Tasks:** 3 (Task 1: package legitimacy checkpoint, approved prior to this dispatch; Task 2: tracer; Task 3: real-file migration + smoke test)
- **Files created:** 21 (excluding package-lock.json and drizzle's generated meta/ files)

## Accomplishments

- A single validated `src/config/index.ts` module is the only place in `src/` that reads `process.env` — `DB_PATH` and `JWT_SECRET` (≥32 chars) are required with no defaults, `PORT`/`JWT_EXPIRY_SECONDS` default sensibly, and every failure names the offending variable (INFRA-01).
- `POST /auth/signup` hashes passwords with argon2id, always writes `role='client'` regardless of what the request body claims (D-07), strips unknown body keys via zod, replies 201 with `{token, user}` and never leaks `password_hash`, and replies 409 on a duplicate email without creating a second row (AUTH-01).
- JWT signing/verification pins the algorithm allowlist to `['HS256']` — a forged `alg: none` token is rejected (T-01-01), verified with a manual test this session.
- `GET /health` runs a live `SELECT 1` against the open connection rather than a static 200.
- The real SQLite file at `DB_PATH` was migrated for real (not just the vitest throwaway db): `npm run db:migrate` run twice is idempotent (1 row in `__drizzle_migrations`, zero new migrations applied the second time), `sqlite_master` lists both `profiles` and `__drizzle_migrations`, and `npm run dev` was started and exercised live over HTTP for both routes with the resulting row confirmed present via a separate short-lived process, then deleted (INFRA-02).
- 14/14 vitest tests pass; `npm run build` (`tsc --noEmit --strict`) is clean.

## Task Commits

Each task was committed atomically:

1. **Task 1: Package legitimacy gate** — approved in a prior dispatch session (no code commit; a human visited all four npm registry pages and confirmed `better-sqlite3`, `fastify`, `argon2`, `tsx` against `github.com/WiseLibs/better-sqlite3`, `github.com/fastify/fastify`, `github.com/ranisalt/node-argon2`, `github.com/privatenumber/tsx` respectively).
2. **Task 2: End-to-end signup tracer** — `43a0484` (test, RED), `d0f7eb4` (feat, GREEN)
3. **Task 3: Apply migrations to the real SQLite file and smoke the running server** — `6c7c518` (feat)

_TDD gate compliance: RED (`test(01-01): add failing tests...`) precedes GREEN (`feat(01-01): implement signup tracer...`) in git log — confirmed via `git log --oneline`. No REFACTOR commit was needed._

## Files Created/Modified

- `src/config/index.ts` — zod-validated env config; `loadConfig(env)` + `config` constant; sole `process.env` reader
- `src/db/schema.ts` — `profiles` sqliteTable, `ROLES` const, `Role` type
- `src/db/client.ts` — `createDb(dbPath)`: opens better-sqlite3, creates parent dir, sets WAL + foreign_keys pragmas
- `src/db/migrate.ts` — `runMigrations(db)` + standalone `db:migrate` entrypoint
- `src/db/migrations/0000_tranquil_kinsey_walden.sql` (+ `meta/`) — generated migration, committed as source
- `src/auth/hash.ts` — `hashPassword`/`verifyPassword` (argon2id)
- `src/auth/jwt.ts` — `signAccessToken`/`verifyAccessToken`, HS256 pinned
- `src/routes/health.ts` — `GET /health` with live DB probe
- `src/routes/auth.ts` — `POST /auth/signup`
- `src/app.ts` — `buildApp(db, connection)` assembly point
- `src/server.ts` — process entrypoint
- `tests/helpers/db.ts`, `tests/config.test.ts`, `tests/routes/auth.test.ts`
- `package.json`, `tsconfig.json`, `drizzle.config.ts`, `vitest.config.ts`, `.gitignore`, `.nvmrc`, `.env.example`, `README.md`

## Decisions Made

- Fastify's built-in `inject()` used instead of `supertest` for HTTP-level tests (fewer native deps, matches the plan's explicit divergence note).
- `crypto.randomUUID()` (Node built-in) used instead of the `uuid` package.
- `vitest.config.ts` sets placeholder `DB_PATH`/`JWT_SECRET` test env vars so `src/config/index.ts`'s eager `config = loadConfig(process.env)` succeeds at import time; individual tests still exercise `loadConfig()` directly against their own env records for the actual INFRA-01 assertions — no test ever depends on these placeholder values for behavior.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Forced the MSVC v143 toolset for better-sqlite3's native build**
- **Found during:** Task 2 (initial `npm install`)
- **Issue:** `better-sqlite3@13.0.3` ships no prebuilt binary for this Node 24.15.0/Windows/x64 combination and compiles from source via `node-gyp`. The build failed with `MSB8020: could not find build tools for ClangCL`. Root cause: this machine's Node 24.15.0 Windows binary reports `process.config.variables.clang = 1` (built with clang-cl), which `node-gyp` propagates into the addon's generated `config.gypi` as `msbuild_toolset: ClangCL` — but this machine's VS2022 Build Tools installation has an incomplete Clang component (the `VC/Tools/Llvm/` directory exists but `clang-cl.exe` itself is missing).
- **Fix:** Installed dependencies with `--ignore-scripts` to avoid the failed build rolling back the whole install, ran `npm rebuild argon2` normally (its build succeeded fine — it uses a prebuild via `node-gyp-build`), then for `better-sqlite3` specifically ran `node-gyp configure --clang=0 && node-gyp build` from inside `node_modules/better-sqlite3`, forcing the already-fully-installed standard MSVC v143 toolset instead of the incomplete ClangCL one. Verified `defaults.msbuild_toolset` changed from `ClangCL` to `v143` in the generated `config.gypi` before building.
- **Files modified:** None (environment-only fix; nothing in the repo changed). Documented as a README troubleshooting step (Pitfall 5) so any developer hitting the same error has the exact commands.
- **Verification:** `node -e "require('better-sqlite3')"` creates/queries an in-memory table successfully; `argon2.hash()`/`argon2.verify()` round-trip successfully; the full vitest suite (which exercises both natively) passes 14/14; this is safe because `better-sqlite3` builds against `node-addon-api` (N-API), which is deliberately ABI-stable across compilers — using a different compiler than Node itself was built with does not risk a runtime ABI mismatch for N-API addons.
- **Committed in:** `d0f7eb4` (documented in the commit body; no repo files changed by the fix itself, only the README troubleshooting note is a repo change)

**2. [Rule 3 - Blocking] Generated the drizzle migration during Task 2, committed it in Task 3**
- **Found during:** Task 2 (writing `tests/helpers/db.ts`)
- **Issue:** The plan's task boundary implies `npm run db:generate` happens in Task 3 (its `<files>` list includes `src/db/migrations/`, Task 2's does not). But Task 2's own acceptance criteria require `npx vitest run tests/config.test.ts tests/routes/auth.test.ts` to pass, and `tests/helpers/db.ts` calls `runMigrations(db)` against a throwaway temp-file db — which requires an actual `.sql` migration file to exist on disk, or every test hits "no such table: profiles".
- **Fix:** Ran `npx drizzle-kit generate` during Task 2's implementation (necessary for the schema to become physically real, even in a temp test db) but deferred `git add`-ing the generated file until Task 3's commit, matching the plan's stated file ownership. Task 3's own `npm run db:generate` call then correctly reported "No schema changes, nothing to migrate" — confirming the file generated in Task 2 already matched the schema Task 3 expected to produce.
- **Files modified:** `src/db/migrations/0000_tranquil_kinsey_walden.sql`, `src/db/migrations/meta/*` (generated in Task 2, committed in Task 3)
- **Verification:** `grep -c 'sqliteTable(' src/db/schema.ts` reports 1; the generated `.sql` contains a `CREATE TABLE profiles` statement; both vitest suites pass using this migration.
- **Committed in:** `6c7c518` (Task 3 commit)

---

**Total deviations:** 2 auto-fixed (2 blocking). **Impact on plan:** Both were necessary to make the plan's own acceptance criteria achievable; neither changed the plan's architecture, scope, or the shape of any deliverable. No scope creep.

## Issues Encountered

None beyond the two blocking deviations documented above (both resolved within the task, no open issues).

## User Setup Required

None — no external service configuration required. A local `.env` was created in the worktree from `.env.example` with a freshly generated 64-hex-char `JWT_SECRET` (`.env` is gitignored, never committed).

## Known Stubs

None. Every route, config path, and DB operation in this plan is fully wired — no placeholder data, no unwired props, no `TODO`/`FIXME` markers introduced.

## Next Phase Readiness

- The walking skeleton is proven end-to-end: env → Fastify → zod → argon2 → Drizzle → better-sqlite3 → SQLite file → JSON response, with nothing stubbed.
- `src/config`, `src/db/{schema,client,migrate}`, `src/auth/{hash,jwt}`, `src/app.ts`, and `tests/helpers/db.ts` establish the exact patterns 01-02 (remaining schema tables + `public_mechanics` triggers) and 01-03 (login/logout session lifecycle) build on directly — no rework needed.
- One environment caveat for this specific machine only: `better-sqlite3`'s native build needs the `--clang=0` override documented in README's Troubleshooting section until this machine's VS2022 Build Tools gets a complete Clang component (or `npm install` is run on a machine/Node version where a prebuilt binary matches). This does not block other developers or CI environments where either condition holds.
- No blockers for 01-02 or 01-03.

## Self-Check: PASSED

- All key files confirmed present on disk via `git ls-files` (21 created files, all tracked).
- Commit hashes confirmed present in `git log --oneline --all`: `43a0484` (test, RED), `d0f7eb4` (feat, GREEN), `6c7c518` (feat, real-file migration), `3cf991c` (docs, SUMMARY).
- Plan-level `<verification>` re-run and confirmed: `npx vitest run` → 14/14 pass; `npm run build` → exits 0; scoped `process.env` grep → only `src/config/index.ts`; real `DB_PATH` file confirmed to contain `profiles` + `__drizzle_migrations`; `npm run dev` answered `GET /health` (200) and `POST /auth/signup` (201) live.
- TDD gate compliance confirmed: `test(01-01)` commit precedes `feat(01-01)` commit in git log.

---
*Phase: 01-foundation-auth-walking-skeleton*
*Completed: 2026-08-08*
