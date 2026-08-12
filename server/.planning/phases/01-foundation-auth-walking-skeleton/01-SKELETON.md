# Walking Skeleton — Workshop Backend Server (Supabase Replacement)

**Phase:** 1
**Generated:** 2026-08-08

> This project has no UI surface of its own (the three sibling Expo apps live in their own repos and
> rewiring them is explicitly out of scope — see `.planning/REQUIREMENTS.md` "Out of Scope"). The
> standard skeleton checklist item "one real UI interaction" is therefore substituted with
> **one real end-to-end API interaction**: an HTTP request that crosses every layer of the stack and
> lands a row in the SQLite file.

## Capability Proven End-to-End

A brand-new client can `POST /auth/signup` with an email and password against a locally-running,
environment-configured Node process and receive a signed session token — with the resulting `profiles`
row physically present in the SQLite file at `DB_PATH`.

That single request traverses: process environment → validated config → Fastify route → zod validation
→ argon2 hashing → Drizzle query builder → better-sqlite3 driver → SQLite file → JSON response. Nothing
in that path is stubbed.

## Architectural Decisions

These are fixed for the whole project. Later phases build vertical slices on top of them and must not
renegotiate them. Any change here is a project-level architectural decision, not a plan-level one.

| Decision | Choice | Rationale |
|---|---|---|
| Language / module system | TypeScript 5.11.x, ESM (`"type": "module"`), executed via `tsx` | Sibling apps are TypeScript; Drizzle's value is its schema-derived type inference, which needs TS |
| HTTP framework | Fastify 5.x | Native TypeScript support and built-in schema-validation hooks; `inject()` gives HTTP-level tests with no extra dependency. Framework was Claude's Discretion per `01-CONTEXT.md` |
| SQLite driver | `better-sqlite3` 13.x | Fully synchronous API, which matches a request/response server with no need for async DB round-trips; most complete third-party SQLite driver for Node |
| ORM / schema-as-code | `drizzle-orm` 0.45.x + `drizzle-kit` 0.31.x | PROJECT.md's tentative pick, confirmed current. Generated `.sql` migrations preserve the sibling repos' "one file per schema change, committed to git" convention without hand-writing them |
| Migration application | Drizzle migrator invoked at process boot and via `npm run db:migrate`; applied-state tracked in `__drizzle_migrations` | DATA-01 requires the schema to be migrated on startup; the ledger makes re-running idempotent |
| Trigger DDL | Hand-written SQL inside a `drizzle-kit generate --custom` migration | drizzle-kit does not model triggers; `--custom` is the supported escape hatch that still registers the migration in the journal |
| Password hashing | `argon2` 0.45.x (argon2id), library-default cost parameters | OWASP's current recommendation for new systems; memory-hard. Algorithm was Claude's Discretion |
| Session tokens | `jsonwebtoken` 9.x, HS256, **single long-lived access token**, 30-day default expiry, per-token `jti` | Locked by `01-CONTEXT.md` **D-03**. Deliberately not an access+refresh pair — traded refresh-flow fidelity for build simplicity. **Reversibility: costly** (changing it later touches this server and all three sibling apps' token storage simultaneously) |
| Session revocation | SQLite `token_blocklist` table keyed by `jti`, checked on every authenticated request | Locked by **D-04**/**D-05**. A long-lived token cannot be invalidated by expiry alone, so logout must revoke explicitly; the blocklist lives in the same SQLite file because an in-memory store would silently un-revoke every token on restart |
| Request validation | `zod` 4.x, unknown keys stripped | Single validation vocabulary shared by config parsing and request bodies |
| Identifiers | Node built-in `crypto.randomUUID()`, stored as TEXT | SQLite has no UUID type and no `gen_random_uuid()`; the Node built-in removes a dependency entirely |
| Timestamps | TEXT, ISO-8601 UTC, SQLite default `strftime('%Y-%m-%dT%H:%M:%fZ','now')` | SQLite has no timestamptz; a single lexicographically-sortable text format avoids per-table drift |
| Booleans | INTEGER 0/1 via Drizzle `{ mode: 'boolean' }` | SQLite has no boolean type |
| Configuration | All runtime config from `process.env`, parsed once through a zod schema in `src/config/index.ts`; no other module reads the environment | INFRA-01. No hosting-platform branch anywhere in the codebase; `dotenv` is a local-dev convenience only |
| Deployment target | **Deliberately none.** The deliverable is a portable Node process with a documented local full-stack run command | PROJECT.md defers the hosting decision; hard-coding a platform now would violate INFRA-01 |
| Directory layout | `src/{config,db,auth,routes}` + `src/app.ts` / `src/server.ts`, `scripts/` for standalone jobs, `tests/` mirroring `src/` | Layer-per-folder with a single `buildApp(db)` assembly point, so tests exercise the same wiring the server does |
| Test strategy | `vitest` 4.x against a throwaway temp-file SQLite database per run; HTTP via Fastify `inject()` | No test-only code path in `src/`; tests never touch the developer's `DB_PATH` |

## Stack Touched in Phase 1

- [x] Project scaffold (TypeScript, ESM, build, test runner, migration tooling)
- [x] Routing — real routes: `GET /health`, `POST /auth/signup`, `POST /auth/login`, `POST /auth/logout`, `GET /auth/me`
- [x] Database — real write (`INSERT` into `profiles`, `token_blocklist`) and real read (credential lookup, blocklist lookup, `SELECT 1` health probe)
- [x] ~~UI~~ **One real end-to-end API interaction** — signup/login/logout exercised over HTTP against a real SQLite file (no-UI substitution)
- [x] Deployment — no platform chosen by design; a documented local full-stack run command (`npm run dev`) is the deliverable instead

## Out of Scope (Deferred to Later Slices)

Explicit so later phases do not re-litigate Phase 1's minimalism:

- **Role-based authorization middleware** (AUTH-04) — Phase 2. Phase 1 authenticates (proves *who* you are); it does not authorize (decide *what* you may do). The only role logic in Phase 1 is that signup always writes `client` (D-07).
- **All booking business logic** — booking, cancellation, completion, the `confirmado → nao_finalizado → acabado` transitions, and double-booking prevention (BOOK-01…05) — Phase 2. Phase 1 creates the `timeslots`/`appointments` tables but writes no rows to them.
- **Postgres RLS policies, `SECURITY DEFINER` functions, and `SELECT … FOR UPDATE` locking** — not ported at all. These are Postgres mechanisms; the equivalent guarantees are re-derived in application code and SQLite constraints in Phase 2.
- **Admin endpoints and reporting RPCs** (ADMIN-01…03) — Phase 3. Phase 1 creates `admin_action_log` but writes no rows to it.
- **Notification fan-out and the notification inbox** (NOTIF-01/02) — Phase 4. Phase 1 creates the `notifications` table from an inferred, unverified schema and nothing reads or writes it.
- **Phone/SMS OTP auth** (AUTH-05) — dropped from this migration entirely.
- **Production data migration** (DATA-04) — impossible; Supabase project access is gone (D-01).
- **Refresh tokens, token rotation, password reset, email verification, rate limiting** — none are required by a Phase 1 requirement and none are implied by D-03's single-token design.
- **A concrete hosting platform** — deferred by PROJECT.md.

## Subsequent Slice Plan

Each later phase adds vertical slices on top of this skeleton without altering the decisions above:

- **Phase 2 — Booking & Appointment Lifecycle:** a client books a mechanic's timeslot without double-booking; mechanics cancel and complete appointments; every endpoint is role-gated by the middleware this skeleton's `requireAuth` hook is extended into.
- **Phase 3 — Admin Management:** an admin creates and deletes mechanic accounts (writing the `admin_action_log` rows this skeleton's schema already reserves) and reads dashboard/mechanic/appointment/financial reports.
- **Phase 4 — Notifications & Cross-App Visibility:** booking-lifecycle events fan out into the `notifications` table this skeleton created, and users list and read their own inbox.

---

*Walking Skeleton recorded during Phase 1 planning. Treat as a contract, not a scratchpad.*
