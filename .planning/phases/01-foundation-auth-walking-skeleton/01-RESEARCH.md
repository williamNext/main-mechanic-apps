# Phase 1: Foundation & Auth Walking Skeleton - Research

**Researched:** 2026-08-07
**Domain:** Node.js + SQLite backend foundation (schema migration, JWT auth with revocation, config-driven portable server)
**Confidence:** MEDIUM

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01/D-02 (Notifications schema):** Live introspection against Supabase is impossible (feature never shipped to production, project access gone). Infer the `notifications` table schema from `mechanic/services/notification-service.ts` / `oficina/services/notification-service.ts` (identical): `recipient_id`, `actor_id`, `appointment_id`, `type`, `title`, `body`, `data`, `read_at`, `created_at`, `updated_at`. Treat as best-effort port, not verified-against-production.
- **D-03 (Token strategy):** Single long-lived JWT for the access token — NOT a short-lived-access + refresh-token pair. Chosen for build simplicity. Reversibility: costly (touches every client's auth-storage code later).
- **D-04 (Revocation):** Because a single long-lived JWT can't be invalidated by expiry alone, logout must revoke it via a server-side token blocklist / revoked-session record. AUTH-03 is only satisfied if the blocklist is checked on every authenticated request.
- **D-05 (Blocklist storage):** Blocklist/session-tracking data lives in the same SQLite DB as everything else — no separate in-memory or Redis store. In-memory was explicitly rejected (server restart would silently log everyone out).
- **D-06 (Admin bootstrap):** First admin account created by a standalone Node seed script (run manually, not an API endpoint), mirroring `mechanic/scripts/seed.js` / `create-mechanic-auth-users.js`. No env-var-triggered auto-bootstrap in the server itself.
- **D-07 (Signup default role):** Public signup endpoint (AUTH-01) always creates a `client`-role account. Mechanic/admin accounts only via privileged admin action (Phase 3) or the bootstrap seed script (D-06). No self-service mechanic/admin signup.

### Claude's Discretion

Web framework (Express/Fastify/etc.), ORM (Drizzle recommended in PROJECT.md), password hashing algorithm/cost factor, exact JWT expiry duration, local dev DB file location/naming — none of these were raised as gray areas; treated as standard implementation choices for the planner/executor to make.

### Deferred Ideas (OUT OF SCOPE)

- AUTH-04 (role-based authorization middleware) and the admin-only-login nuance (`admin/services/auth-service.ts`'s `getAdminById()` role check) belong to Phase 2, not Phase 1.
- Nothing else came up outside phase scope.

</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| INFRA-01 | Portable Node process, all config via env vars, no hosting-specific code | 12-factor/dotenv pattern research; Standard Stack; Code Examples |
| INFRA-02 | Runs locally against a local SQLite file, documented setup/run command | better-sqlite3 driver research; Recommended Project Structure |
| DATA-01 | Full SQLite schema migrated on startup (profiles, mechanics, public_mechanics, timeslots, appointments, appointment_service_reports, appointment_service_items, admin_action_log, notifications) | Verbatim Postgres schema quotes below; Drizzle-kit migration research; Pitfalls (type porting) |
| DATA-02 | `notifications` schema inferred from client code, not live introspection | Verbatim quote from `notification-service.ts`; Assumptions Log |
| DATA-03 | `public_mechanics` stays in sync with `profiles`/`mechanics` automatically | SQLite `CREATE TRIGGER` research; Pattern 3 below |
| AUTH-01 | Signup with email/password | Password hashing research (argon2/bcrypt); Code Examples |
| AUTH-02 | Login + persisted/refreshable session across restart | Single-long-lived-JWT research; jsonwebtoken research |
| AUTH-03 | Logout invalidates session | JWT blocklist/denylist design research; Pattern 2 below |
</phase_requirements>

## Summary

This phase builds the skeleton of a from-scratch Node.js + SQLite backend that will eventually replace a Supabase/Postgres project. There is no existing code in this repo — the research task is stack selection plus faithful reproduction of the Postgres schema's *shape* (not its Postgres-specific mechanisms: RLS, `SECURITY DEFINER` functions, and `FOR UPDATE` locking are Phase 2+ concerns and are explicitly out of scope here).

The current (2025-2026) standard stack for this shape of project is **TypeScript + Fastify + better-sqlite3 + Drizzle ORM + drizzle-kit** for schema/migrations, **jsonwebtoken** for the single long-lived access token, **argon2** (argon2id) for password hashing, **zod** for request validation, and **vitest + supertest** for tests. All of these are extremely well-established (millions of weekly downloads, official GitHub repos) — three of them (`better-sqlite3`, `fastify`, `argon2`) were flagged `SUS` by the automated legitimacy scanner purely because their *most recent* npm publish is very recent; this is a false-positive pattern for actively-maintained, high-download packages and is called out explicitly in the Package Legitimacy Audit below with the required human-verify checkpoint.

The two structurally interesting problems in this phase are (1) replicating Postgres's `public_mechanics` sync trigger using SQLite's `CREATE TRIGGER` (SQLite supports the same `AFTER INSERT/UPDATE/DELETE ... FOR EACH ROW` shape, just without PL/pgSQL — the logic must be inlined as SQL statements in the trigger body), and (2) implementing single-long-lived-JWT + SQLite-backed revocation (a `token_blocklist` table storing the token's `jti`, checked via an indexed lookup on every authenticated request, with rows naturally prunable once their `expires_at` passes). Both are well-documented, low-risk patterns given SQLite's feature set.

**Primary recommendation:** TypeScript + Fastify + better-sqlite3 + Drizzle ORM (drizzle-kit for migrations) + jsonwebtoken + argon2 + zod, with a hand-written SQL migration file for the `public_mechanics` triggers (Drizzle does not manage triggers) and a `token_blocklist` table (`jti` TEXT PRIMARY KEY, `expires_at` INTEGER) checked in an auth middleware on every request.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Schema migration & row storage | Database / Storage | — | SQLite file is the sole source of truth; migrations run at process boot |
| `public_mechanics` sync (DATA-03) | Database / Storage | API / Backend | A SQLite `AFTER` trigger keeps the projection consistent at write time with zero app-code coordination; API/Backend is secondary only if a trigger edge case forces an application-level fallback |
| Signup / login (JWT issuance) | API / Backend | Database / Storage | Backend validates credentials, hashes/verifies passwords, signs the JWT; profiles row lives in SQLite |
| Logout / session revocation | API / Backend | Database / Storage | Backend inserts into `token_blocklist`; every authenticated request's middleware re-checks that table |
| Password hashing | API / Backend | — | Fully server-side, never touches the client or DB in plaintext |
| Session persistence across app restart | Client (mobile apps — out of scope for this repo) | API / Backend | The three Expo apps store the JWT in SecureStore/AsyncStorage (their own repos); this server only issues/validates tokens, it never persists client sessions itself |
| Server configuration (DB path, port, JWT secret) | API / Backend | — | Read from `process.env` at boot; no hosting-platform code paths |
| Admin bootstrap (D-06 seed script) | API / Backend (standalone script) | Database / Storage | A Node script outside the HTTP server writes directly to SQLite via the same driver/schema |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|---------------|
| `typescript` | 5.11.2 [VERIFIED: npm registry] | Language | Sibling apps (`admin`/`mechanic`/`oficina`) are TypeScript; Drizzle's type inference is the main reason to use it (query results are typed from the schema) — recommended, not locked (CONTEXT.md leaves language/framework to discretion) |
| `fastify` | 5.2.1 [VERIFIED: npm registry] | HTTP server framework | Native TypeScript support, built-in JSON-schema request validation, ~2-3x throughput over Express [CITED: web search, multiple 2026 comparison articles] — flagged `SUS` by legitimacy scan (see audit below, false positive) |
| `better-sqlite3` | 13.0.3 [VERIFIED: npm registry] | Synchronous SQLite driver | Mature, fully synchronous API (fits request/response flow without async DB round-trips), most complete third-party SQLite driver for Node [CITED: web search] — flagged `SUS` (false positive, see audit) |
| `drizzle-orm` | 0.45.2 [VERIFIED: npm registry] | Query layer / schema-as-code | Lightweight (no runtime overhead beyond the driver), first-class `better-sqlite3` dialect, schema defined in TypeScript with generated SQL migrations — this was PROJECT.md's tentative pick; confirmed still current in 2026 |
| `drizzle-kit` | 0.31.10 [VERIFIED: npm registry] | Migration generator/runner | Generates timestamped `.sql` migration files from schema diffs — satisfies the "SQL-file-per-change convention" the sibling repos already use, just generated instead of hand-written |
| `jsonwebtoken` | 9.0.3 [VERIFIED: npm registry] | JWT sign/verify | Synchronous API matches `better-sqlite3`'s synchronous style; simplest library for the locked single-long-lived-token design (no refresh-token machinery needed) |
| `argon2` | 0.45.1 [VERIFIED: npm registry] | Password hashing | OWASP's current recommended algorithm for new systems (Argon2id) — memory-hard, more resistant to GPU/FPGA attacks than bcrypt [CITED: web search, OWASP-aligned 2026 sources] — flagged `SUS` (false positive, see audit) |
| `zod` | 4.4.3 [VERIFIED: npm registry] | Request validation | Standard TypeScript-first schema validation; pairs naturally with Fastify's schema-validation hooks and with Drizzle (via `drizzle-zod`, optional) |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `dotenv` | 17.4.2 [VERIFIED: npm registry] | Loads `.env` into `process.env` for local dev only | INFRA-01/02 — never used to inject secrets in a real deployment, purely a local-dev convenience; `.env` must be gitignored |
| `uuid` | 14.0.1 [VERIFIED: npm registry] | UUID v4 generation | Generate `id` values in app code before insert, since SQLite has no `gen_random_uuid()` equivalent built in — `crypto.randomUUID()` (Node built-in) is a viable zero-dependency alternative, see Don't Hand-Roll |
| `pino` | 10.3.1 [VERIFIED: npm registry] | Structured logging | Fastify's native logger is pino-based already; use it rather than `console.log` for anything beyond quick debugging |
| `bcrypt` | 6.0.0 [VERIFIED: npm registry] | Alternative password hasher | Fallback if `argon2`'s native-addon build proves troublesome in the target deploy environment — see Alternatives Considered |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `fastify` | `express` (5.2.1 [VERIFIED: npm registry]) | Larger ecosystem (~30M weekly downloads, 50k+ middleware packages) and more StackOverflow/tutorial coverage, but no native TypeScript support and no built-in schema validation — would need `express` + manual `zod` middleware wiring instead of Fastify's native hooks |
| `better-sqlite3` | `node:sqlite` (built-in, Node ≥22.13, release-candidate on Node 24+) | Zero install / no native compilation, but still not marked stable and has a smaller API surface [CITED: web search] — revisit once it stabilizes |
| `jsonwebtoken` | `jose` | More modern, ESM-native, supports async/Web Crypto — worth it only if the single-long-lived-JWT design later grows into asymmetric (RS256) signing; unnecessary complexity for D-03's symmetric HS256 use case |
| `argon2` | `bcrypt` | Simpler native-addon footprint (older, extremely battle-tested prebuilds), cost factor ≥12 still considered safe by OWASP, but memory-hardness (GPU-attack resistance) is weaker than Argon2id |
| Drizzle-generated migrations | Hand-written `.sql` files (sibling-repo style) | Sibling repos hand-write dated `.sql` files run manually; drizzle-kit's generated migrations achieve the same "one file per schema change, kept in git" property but stay in sync with the TypeScript schema automatically — recommended over hand-writing to avoid schema/code drift |

**Installation:**
```bash
npm install fastify better-sqlite3 drizzle-orm jsonwebtoken argon2 zod dotenv pino uuid
npm install -D drizzle-kit typescript tsx vitest supertest @types/node @types/better-sqlite3 @types/jsonwebtoken
```

**Version verification:** All versions above were checked via `npm view <package> version` against the live npm registry on 2026-08-07 (see Package Legitimacy Audit for full signal data). Training-data versions for a fast-moving ecosystem like this are frequently stale by months — always re-verify before the plan locks dependency versions.

## Package Legitimacy Audit

| Package | Registry | Age (last publish) | Downloads/wk | Source Repo | Verdict | Disposition |
|---------|----------|---------------------|---------------|--------------|---------|-------------|
| `better-sqlite3` | npm | published 2026-08-05 | 9,307,832 | github.com/WiseLibs/better-sqlite3 | SUS (`too-new`) | Flagged — see note below |
| `fastify` | npm | published 2026-08-03 | 10,724,669 | github.com/fastify/fastify | SUS (`too-new`) | Flagged — see note below |
| `argon2` | npm | published 2026-07-21 | 1,859,526 | github.com/ranisalt/node-argon2 | SUS (`too-new`) | Flagged — see note below |
| `tsx` | npm | published 2026-08-07 | 80,495,767 | github.com/privatenumber/tsx | SUS (`too-new`) | Flagged — see note below |
| `jose` | npm | published 2026-08-03 | 112,836,418 | github.com/panva/jose | SUS (`too-new`, not adopted — see Alternatives) | N/A, not selected |
| `drizzle-orm` | npm | published 2026-03-27 | 17,950,683 | github.com/drizzle-team/drizzle-orm | OK | Approved |
| `drizzle-kit` | npm | published 2026-03-17 | 15,112,971 | github.com/drizzle-team/drizzle-orm | OK | Approved |
| `jsonwebtoken` | npm | published 2025-12-04 | 53,252,902 | github.com/auth0/node-jsonwebtoken | OK | Approved |
| `zod` | npm | published 2026-05-04 | 251,703,836 | github.com/colinhacks/zod | OK | Approved |
| `express` | npm | published 2025-12-01 | 126,730,328 | github.com/expressjs/express | OK | Approved (alternative, not selected) |
| `bcrypt` | npm | published 2025-05-11 | 5,662,352 | github.com/kelektiv/node.bcrypt.js | OK | Approved (fallback) |
| `dotenv` | npm | published 2026-04-12 | 164,591,023 | github.com/motdotla/dotenv | OK | Approved |
| `uuid` | npm | published 2026-06-20 | 272,113,150 | github.com/uuidjs/uuid | OK | Approved |
| `pino` | npm | published 2026-02-09 | 41,933,888 | github.com/pinojs/pino | OK | Approved |
| `vitest` | npm | published 2026-07-06 | 88,401,360 | github.com/vitest-dev/vitest | OK | Approved |
| `supertest` | npm | published 2026-01-06 | 16,725,471 | github.com/ladjs/supertest | OK | Approved |
| `typescript` | npm | published 2026-07-08 | 259,561,424 | github.com/microsoft/TypeScript | OK | Approved |

**Packages removed due to `[SLOP]` verdict:** none.

**Packages flagged as suspicious `[SUS]`:** `better-sqlite3`, `fastify`, `argon2`, `tsx`. In every case the `too-new` signal fired because the package's *most recent version publish date* is within days of the research date — not because the package itself is new. All four have official, actively-maintained GitHub repos and multi-million-to-tens-of-millions weekly download counts, which is inconsistent with a slopsquatted or hallucinated package. This is a **known false-positive pattern for the legitimacy heuristic when applied to actively-maintained, frequently-released libraries** — but per protocol they must still be treated as flagged. **The planner must insert a `checkpoint:human-verify` task before each of these four packages is installed**, so a human confirms the package name/version against npmjs.com immediately before `npm install` runs.

`jose` was evaluated as an alternative to `jsonwebtoken` (also `SUS`/`too-new`) but was not selected — no action needed since it is not part of the Standard Stack.

## Architecture Patterns

### System Architecture Diagram

```
                        ┌─────────────────────────────┐
                        │   Env vars (.env / host)     │
                        │  DB_PATH, PORT, JWT_SECRET   │
                        └──────────────┬───────────────┘
                                       │ read at boot
                                       ▼
┌──────────┐   HTTP    ┌───────────────────────────────┐
│  Client  │──────────▶│        Fastify app             │
│ (mobile  │           │  (routes + zod validation)     │
│  apps)   │◀──────────│                                 │
└──────────┘   JSON    └───────────────┬─────────────────┘
                                        │
                     ┌──────────────────┼───────────────────┐
                     ▼                  ▼                   ▼
          ┌─────────────────┐ ┌──────────────────┐ ┌──────────────────┐
          │  Auth handlers   │ │  Auth middleware  │ │  (Phase 2+)      │
          │ signup / login / │ │ verify JWT sig +  │ │  business routes │
          │ logout           │ │ check blocklist   │ │                  │
          └────────┬─────────┘ └─────────┬──────────┘ └──────────────────┘
                    │  argon2.hash/verify │  jwt.verify + blocklist lookup
                    │  jwt.sign            │
                    ▼                     ▼
          ┌───────────────────────────────────────────────┐
          │         Drizzle ORM (schema-typed queries)      │
          └───────────────────────┬───────────────────────┘
                                   ▼
          ┌───────────────────────────────────────────────┐
          │              better-sqlite3 driver               │
          └───────────────────────┬───────────────────────┘
                                   ▼
          ┌───────────────────────────────────────────────┐
          │  SQLite file (DB_PATH)                          │
          │  profiles, mechanics, public_mechanics (trigger  │
          │  synced), timeslots, appointments,               │
          │  appointment_service_reports/_items,             │
          │  admin_action_log, notifications, token_blocklist│
          └───────────────────────────────────────────────┘
                                   ▲
                     ┌─────────────┴──────────────┐
                     │  scripts/seed-admin.ts       │
                     │  (D-06 standalone script,    │
                     │  writes directly, no API)    │
                     └───────────────────────────────┘
```

Trace of the primary use case (signup → login → restart → logout):
1. Client POSTs `/auth/signup` → Fastify validates body with `zod` → handler hashes password with `argon2` → Drizzle inserts a `profiles` row with `role='client'` (D-07) → JWT signed and returned.
2. Client stores the JWT (its own concern, out of scope) and sends it as `Authorization: Bearer <token>` on every request.
3. Auth middleware verifies the JWT signature/expiry, then does an indexed `SELECT 1 FROM token_blocklist WHERE jti = ?` — if absent, request proceeds.
4. "Restart" is simulated by the client re-sending the same stored JWT after a fresh app launch — since it's a single long-lived token (D-03), no refresh call is needed; the same middleware check in step 3 re-validates it.
5. Client POSTs `/auth/logout` → handler extracts the JWT's `jti` and inserts it into `token_blocklist` → any subsequent request with that token is rejected at step 3.

### Recommended Project Structure

```
server/
├── src/
│   ├── config/          # env var loading/validation (single source of truth)
│   ├── db/
│   │   ├── schema.ts     # Drizzle schema definitions (all tables)
│   │   ├── client.ts     # better-sqlite3 connection + Drizzle instance
│   │   └── migrations/   # drizzle-kit generated .sql files + hand-written trigger migration
│   ├── auth/
│   │   ├── hash.ts        # argon2 wrap
│   │   ├── jwt.ts         # sign/verify + jti generation
│   │   ├── blocklist.ts   # insert/check against token_blocklist
│   │   └── middleware.ts  # Fastify preHandler hook
│   ├── routes/
│   │   └── auth.ts        # /auth/signup, /auth/login, /auth/logout
│   ├── app.ts             # Fastify instance assembly (routes, plugins)
│   └── server.ts          # entrypoint: load env, run migrations, app.listen()
├── scripts/
│   └── seed-admin.ts      # D-06 standalone admin bootstrap script
├── drizzle.config.ts
├── .env.example
└── package.json
```

### Pattern 1: Config-driven, hosting-agnostic boot (INFRA-01/INFRA-02)

**What:** All runtime configuration (`DB_PATH`, `PORT`, `JWT_SECRET`) is read from `process.env` at a single point (`src/config/index.ts`), validated with `zod` (fail fast if missing/malformed), and never branched on a hosting platform.
**When to use:** Every place the server needs config — never read `process.env` ad hoc elsewhere in the codebase.
**Example:**
```typescript
// src/config/index.ts
import { z } from 'zod';
import 'dotenv/config'; // local-dev only; no-op if vars already set by the host

const EnvSchema = z.object({
  DB_PATH: z.string().min(1),
  PORT: z.coerce.number().int().positive().default(3000),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
});

export const config = EnvSchema.parse(process.env);
```
[CITED: 12-factor / dotenv web research — dotenv used only as local convenience, never as the source of truth in a real deploy]

### Pattern 2: JWT + SQLite-backed revocation blocklist (D-03/D-04/D-05, AUTH-02/AUTH-03)

**What:** A single long-lived JWT is signed with a unique `jti` claim. Logout inserts that `jti` into a `token_blocklist` table. Every authenticated request checks the blocklist by `jti` after verifying the signature.
**When to use:** All authenticated routes, via a shared Fastify `preHandler` hook.
**Example:**
```typescript
// src/db/schema.ts (blocklist table)
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const tokenBlocklist = sqliteTable('token_blocklist', {
  jti: text('jti').primaryKey(),
  expiresAt: integer('expires_at').notNull(), // unix seconds; matches JWT `exp`
  revokedAt: integer('revoked_at').notNull(),
});

// src/auth/jwt.ts
import jwt from 'jsonwebtoken';
import { randomUUID } from 'node:crypto';
import { config } from '../config';

const JWT_EXPIRY_SECONDS = 60 * 60 * 24 * 30; // 30 days — exact duration is Claude's discretion per CONTEXT.md

export function signAccessToken(userId: string, role: string) {
  const jti = randomUUID();
  const token = jwt.sign({ sub: userId, role, jti }, config.JWT_SECRET, {
    algorithm: 'HS256',
    expiresIn: JWT_EXPIRY_SECONDS,
  });
  return { token, jti };
}

// src/auth/middleware.ts (simplified)
export async function requireAuth(req, reply) {
  const token = extractBearerToken(req);
  let payload;
  try {
    payload = jwt.verify(token, config.JWT_SECRET) as { sub: string; role: string; jti: string };
  } catch {
    return reply.code(401).send({ error: 'invalid or expired token' });
  }
  const blocked = db.select().from(tokenBlocklist).where(eq(tokenBlocklist.jti, payload.jti)).get();
  if (blocked) return reply.code(401).send({ error: 'token revoked' });
  req.user = payload;
}

// logout handler
export async function logout(req, reply) {
  const { jti, exp } = req.user; // exp comes from the verified JWT payload
  db.insert(tokenBlocklist).values({ jti, expiresAt: exp, revokedAt: Math.floor(Date.now() / 1000) }).run();
  reply.code(204).send();
}
```
[CITED: JWT denylist/blocklist pattern research — "store every generated token's jti ... mark that token row as invalid"; adapted to this project's single-token design]

**Note on "expired" blocklist rows:** because `expiresAt` mirrors the JWT's own `exp`, a periodic cleanup job (`DELETE FROM token_blocklist WHERE expires_at < ?`) can safely prune rows for tokens that could no longer pass signature verification anyway — this keeps the table bounded despite the long token lifetime. This is an optimization, not required for AUTH-03 correctness.

### Pattern 3: `public_mechanics` sync via SQLite triggers (DATA-03)

**What:** Postgres's design (verbatim, [VERIFIED: `mechanic/scripts/sql/2026-05-16_rebuild_public_app_schema_from_scratch.sql:200-262`]) uses a `private.refresh_public_mechanic(id)` function called from two triggers — one on `profiles` (`AFTER INSERT OR UPDATE OF name, role, avatar_url OR DELETE`), one on `mechanics` (`AFTER INSERT OR UPDATE OF specialty, is_active OR DELETE`) — that deletes then re-inserts the `public_mechanics` row, filtered to `role = 'mechanic' AND is_active = true`. SQLite has no stored functions, so the equivalent logic must be inlined directly in each trigger body using SQL, not delegated to a shared routine.
**When to use:** Any write to `profiles` or `mechanics` that could affect the public projection.
**Example:**
```sql
-- src/db/migrations/000X_public_mechanics_triggers.sql (hand-written, not drizzle-kit generated)
CREATE TRIGGER IF NOT EXISTS trg_public_mechanics_from_profiles
AFTER UPDATE OF name, role, avatar_url ON profiles
FOR EACH ROW
BEGIN
  DELETE FROM public_mechanics WHERE id = NEW.id;
  INSERT INTO public_mechanics (id, name, specialty, avatar_url, updated_at)
  SELECT p.id, p.name, m.specialty, p.avatar_url, strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
  FROM profiles p JOIN mechanics m ON m.id = p.id
  WHERE p.id = NEW.id AND p.role = 'mechanic' AND m.is_active = 1;
END;

CREATE TRIGGER IF NOT EXISTS trg_public_mechanics_from_mechanics
AFTER UPDATE OF specialty, is_active ON mechanics
FOR EACH ROW
BEGIN
  DELETE FROM public_mechanics WHERE id = NEW.id;
  INSERT INTO public_mechanics (id, name, specialty, avatar_url, updated_at)
  SELECT p.id, p.name, m.specialty, p.avatar_url, strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
  FROM profiles p JOIN mechanics m ON m.id = p.id
  WHERE p.id = NEW.id AND p.role = 'mechanic' AND m.is_active = 1;
END;

-- plus AFTER INSERT variants (mirroring the same SELECT/DELETE/INSERT), and
-- AFTER DELETE variants that just DELETE FROM public_mechanics WHERE id = OLD.id
```
[VERIFIED: `mechanic/scripts/sql/2026-05-16_rebuild_public_app_schema_from_scratch.sql:200-262` — Postgres trigger/function logic being ported] + [CITED: web search — SQLite `CREATE TRIGGER [AFTER INSERT|UPDATE|DELETE] ON table FOR EACH ROW BEGIN...END`, `NEW`/`OLD` row references]

**Important divergence from the Postgres source:** the Postgres trigger fires `AFTER INSERT OR UPDATE OF ... OR DELETE` as a single trigger definition — SQLite requires **separate trigger statements per event type** (`AFTER INSERT`, `AFTER UPDATE OF ...`, `AFTER DELETE` are each their own `CREATE TRIGGER`). Budget for 6 total triggers (3 events × 2 source tables), not 2.

Drizzle-kit does not manage trigger DDL — write this as a plain `.sql` file placed in the same migrations folder drizzle-kit generates into, so it runs in the same migration pass (drizzle's `migrate()` applies all `.sql` files in the folder in filename order — name this file so it sorts after the table-creation migrations).

### Anti-Patterns to Avoid

- **In-memory blocklist (e.g., a `Set` in a module-level variable):** explicitly rejected by D-05 — a server restart would silently re-authorize every revoked token. Always the SQLite table.
- **Reading `process.env` directly in route handlers:** breaks INFRA-01's "config supplied via environment variables" intent by scattering config access; centralize in one validated `config` module.
- **Porting Postgres RLS/`SECURITY DEFINER` authorization logic into Phase 1:** AUTH-04 (role-based middleware) is explicitly Phase 2 scope (see Deferred Ideas). Phase 1 only needs the schema and the walking-skeleton auth flow — don't build authorization middleware here.
- **Trying to express the trigger logic as a shared SQL function:** SQLite has no stored procedures/functions comparable to `private.refresh_public_mechanic()`; inline the SELECT/DELETE/INSERT logic in every trigger body (small amount of duplication is unavoidable and acceptable here).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|--------------|-----|
| Password hashing | Custom salt+hash scheme | `argon2` (or `bcrypt` fallback) | Timing-attack resistance, salt generation, and parameter tuning are exactly the kind of thing that looks simple and isn't; both libraries are the audited standard |
| JWT signing/verification | Custom HMAC token format | `jsonwebtoken` | Signature verification, expiry checking, and algorithm-confusion attacks (e.g., accepting `alg: none`) are handled correctly by the library; a hand-rolled scheme is a classic auth vulnerability source |
| Schema migrations | Hand-tracked "did I run this SQL file yet" via a flag file | `drizzle-kit` generated migrations + Drizzle's `migrate()` (tracks applied migrations in a `__drizzle_migrations` table) | Idempotent, ordered, and tracks what's already applied — exactly the DATA-01 "migrated on startup" requirement |
| UUID generation | Custom random-string ID generator | `uuid` (`v4()`) or Node's built-in `crypto.randomUUID()` | `crypto.randomUUID()` is actually built into Node ≥14.17 and needs no dependency at all — prefer it over the `uuid` package unless a specific UUID version (v1/v5) is needed |
| Env var validation | Manual `if (!process.env.X) throw ...` scattered across files | `zod` schema parsed once in `src/config/index.ts` | Single source of truth, fails fast at boot with a clear error, and gives typed config everywhere else |

**Key insight:** every "don't hand-roll" item above is exactly the kind of code that's easy to get 90% right and dangerously wrong in the last 10% (timing attacks, algorithm confusion, migration double-application) — none of it is business logic specific to this project, so there is no reason to write it from scratch.

## Common Pitfalls

### Pitfall 1: Porting Postgres's nullable `email` column verbatim

**What goes wrong:** The canonical schema file was later patched by `2026-05-16_migrate_profiles_to_phone_auth.sql` [VERIFIED: `mechanic/scripts/sql/2026-05-16_migrate_profiles_to_phone_auth.sql:4-5` — `ALTER TABLE public.profiles ALTER COLUMN email DROP NOT NULL;`] to make `email` nullable, because that system later supported phone-only auth. This project's PROJECT.md explicitly drops phone/SMS auth and uses email+password only. If the planner copies the *final* Postgres column definition literally, `profiles.email` will end up nullable in SQLite too, which is wrong for this project's auth model.
**Why it happens:** The canonical schema files represent the *end state* of a system with different auth requirements than this one; CONTEXT.md's canonical_refs section explicitly warns "read for schema shape, not to replicate phone-auth behavior."
**How to avoid:** Define `profiles.email` as `NOT NULL UNIQUE` in the SQLite schema, diverging intentionally from the literal Postgres column nullability.
**Warning signs:** A signup test that omits email succeeding, or duplicate emails being allowed.

### Pitfall 2: Trying to port the mechanic-approval workflow along with the base tables

**What goes wrong:** Early schema versions gate mechanics behind `is_active = false, credentials = 'PENDENTE'` with an approval-guard trigger (`enforce_mechanic_approval_guard`); a later migration [VERIFIED: `admin/scripts/sql/2026-05-25_remove_mechanic_approval_flow.sql:1-51`, quote: `"ALTER TABLE public.mechanics ALTER COLUMN is_active SET DEFAULT true;"` and `"DROP TRIGGER IF EXISTS enforce_mechanic_approval_guard ON public.mechanics; DROP FUNCTION IF EXISTS private.enforce_mechanic_approval_guard();"`] explicitly removes this flow and confirms `is_active` should default to `true`. CONTEXT.md's canonical_refs section flags this file as "confirms mechanic-approval flow was removed; do not port it." If the planner copies an earlier version of the schema, Phase 1's `mechanics` table will incorrectly gate new rows behind an approval state that no longer exists in the source system.
**Why it happens:** Multiple dated `.sql` files represent successive states of the same table; only the *final* state is correct to port, and it takes cross-referencing several files to know which is final.
**How to avoid:** Define `mechanics.is_active` with `DEFAULT true` (integer 1) and do not implement any approval-guard trigger equivalent in Phase 1.
**Warning signs:** Newly admin-created mechanics (Phase 3, ADMIN-01) appearing inactive/unapproved by default.

### Pitfall 3: SQLite CHECK constraints on `TEXT` role/status columns must be spelled out per-table, not enforced via a shared enum type

**What goes wrong:** Postgres uses `TEXT ... CHECK (role IN ('admin','mechanic','client'))` [VERIFIED: `mechanic/scripts/sql/2026-05-16_rebuild_public_app_schema_from_scratch.sql:31`, quote: `"role TEXT NOT NULL CHECK (role IN ('admin', 'mechanic', 'client'))"`] and `appointments.status` ends at four values after the finance migration [VERIFIED: `mechanic/scripts/sql/2026-05-24_appointment_closure_finance.sql:26-28`, quote: `"CHECK (status IN ('confirmado', 'nao_finalizado', 'cancelado', 'acabado'))"`]. SQLite supports the identical `CHECK` constraint syntax, but there is no shared/reusable enum type — each table's CHECK must repeat the literal value list. A common mistake is defining the constraint once and assuming it propagates, or drifting the value lists apart between tables/Drizzle schema/application code.
**Why it happens:** Coming from a Postgres background where `CREATE TYPE` enums exist, it's easy to expect a similar shared-definition mechanism in SQLite.
**How to avoid:** Keep the literal string union as a single TypeScript `as const` array (e.g., `const ROLES = ['admin','mechanic','client'] as const`) used both to generate the Drizzle/SQL `CHECK` constraint and to type application code, so there's exactly one place the value list is edited.
**Warning signs:** A CHECK constraint rejecting a role/status value that zod's request validator already accepted (drift between the two value lists).

### Pitfall 4: `admin_action_log.action` CHECK constraint values are legacy-tainted

**What goes wrong:** The final Postgres constraint is `CHECK (action IN ('approve_mechanic', 'reject_mechanic', 'delete_mechanic'))` [VERIFIED: `admin/scripts/sql/2026-05-22_admin_operations.sql:27` for the base definition, quote: `"action TEXT NOT NULL CHECK (action IN ('approve_mechanic', 'reject_mechanic'))"`, and `admin/scripts/sql/2026-05-24_admin_bulk_delete_mechanics.sql:6-8`, quote: `"ADD CONSTRAINT admin_action_log_action_check CHECK (action IN ('approve_mechanic', 'reject_mechanic', 'delete_mechanic'));"`] — but `approve_mechanic`/`reject_mechanic` are dead values once the approval flow was removed (Pitfall 2). Phase 3's ADMIN-01 (create mechanic) has no corresponding action value in this list at all in the source system.
**Why it happens:** The action log's CHECK constraint was never revisited when the approval flow was dropped.
**How to avoid:** For Phase 1 (DATA-01), just create the table with a CHECK permissive enough not to block Phase 3 (e.g., `('create_mechanic', 'delete_mechanic')` reflecting only what Phase 3 will actually need, or a broader list if uncertain) — flag this as an open decision for Phase 3's planning, not something Phase 1 needs to resolve definitively.
**Warning signs:** Phase 3 admin-create-mechanic logging failing a CHECK constraint because `'create_mechanic'` isn't an allowed value.

### Pitfall 5: Native addon builds on Windows dev machines

**What goes wrong:** `better-sqlite3`, `argon2`, and `bcrypt` are all native (C++/Rust) addons. If prebuilt binaries aren't available for the exact Node/platform/ABI combination, `npm install` falls back to compiling from source, which requires a C++ build toolchain (Visual Studio Build Tools on Windows) that may not be present on a fresh machine.
**Why it happens:** These packages ship prebuilt binaries for common platforms via `prebuild-install`/`napi`, but an unusual Node version or architecture can miss the prebuild matrix.
**How to avoid:** Document in the setup README that `npm install` should just work on common LTS Node versions (document the exact Node version pinned in `.nvmrc`/`engines`), and note the Windows Build Tools fallback (`npm install --global windows-build-tools` or Visual Studio "Desktop development with C++" workload) as a troubleshooting step, not a required prerequisite.
**Warning signs:** `npm install` failing with `node-gyp` / `MSBUILD` errors during the setup step.

## Code Examples

### Drizzle schema definition (subset, illustrating type porting)

```typescript
// src/db/schema.ts
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const profiles = sqliteTable('profiles', {
  id: text('id').primaryKey(), // UUID as TEXT — SQLite has no native UUID type
  name: text('name').notNull(),
  email: text('email').notNull().unique(), // NOT NULL: diverges from Postgres source, see Pitfall 1
  role: text('role', { enum: ['admin', 'mechanic', 'client'] }).notNull(), // [VERIFIED: rebuild_public_app_schema_from_scratch.sql:31]
  phone: text('phone'),
  avatarUrl: text('avatar_url'),
  passwordHash: text('password_hash').notNull(), // new column: Postgres delegated this to Supabase Auth; this server owns it directly
  createdAt: text('created_at').notNull().default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
});

export const mechanics = sqliteTable('mechanics', {
  id: text('id').primaryKey().references(() => profiles.id, { onDelete: 'cascade' }),
  specialty: text('specialty').notNull(),
  credentials: text('credentials').notNull().default('PENDENTE'),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true), // default true post-removal, see Pitfall 2
});

export const notifications = sqliteTable('notifications', {
  id: text('id').primaryKey(),
  recipientId: text('recipient_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
  actorId: text('actor_id').references(() => profiles.id, { onDelete: 'set null' }),
  appointmentId: text('appointment_id'), // FK added once `appointments` exists in the same migration
  type: text('type').notNull(),
  title: text('title').notNull(),
  body: text('body').notNull(),
  data: text('data').notNull().default('{}'), // JSON stored as TEXT — see Pitfalls (type porting)
  readAt: text('read_at'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});
// Columns verbatim from client usage: [VERIFIED: mechanic/services/notification-service.ts:4-18]
// quote: "recipientId: row.recipient_id, actorId: row.actor_id, appointmentId: row.appointment_id,
//         type: row.type, title: row.title, body: row.body, data: row.data ?? {},
//         readAt: row.read_at, createdAt: row.created_at, updatedAt: row.updated_at"
```

### Migration runner at boot (INFRA-02, DATA-01)

```typescript
// src/server.ts
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { config } from './config';

const sqlite = new Database(config.DB_PATH);
sqlite.pragma('journal_mode = WAL'); // recommended for concurrent read/write on a single file
export const db = drizzle(sqlite);

migrate(db, { migrationsFolder: './src/db/migrations' }); // applies all pending .sql files, tracks state
```

## Runtime State Inventory

Not applicable — this is a greenfield phase (new repo, no existing deployed runtime to migrate off of). The porting source (sibling Supabase project) has no remaining access at all (confirmed in CONTEXT.md D-01), so there is no live state to inventory or migrate; this phase only needs to define the initial SQLite schema and boot logic.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|----------------|
| A1 | Fastify is recommended over Express for this project (framework choice is explicitly Claude's Discretion per CONTEXT.md) | Standard Stack, Architecture Patterns | Low — both are viable; if the planner/user prefers Express's larger ecosystem, swap it in without touching the DB/auth layers, which are framework-agnostic |
| A2 | Argon2id is recommended over bcrypt for password hashing (also Claude's Discretion) | Standard Stack, Pitfall/Don't Hand-Roll | Low — bcrypt (cost ≥12) remains an acceptable, simpler-to-deploy fallback; both are `[SUS]`-or-`[OK]` per the legitimacy scan, not `[SLOP]` |
| A3 | `admin_action_log.action` CHECK constraint values for Phase 3's needs (`create_mechanic`) are not present in any source SQL file and must be decided fresh | Pitfall 4 | Medium — if Phase 1 locks a CHECK constraint too narrowly, Phase 3 (ADMIN-01/02) will need a follow-up migration; recommend Phase 1 leave the constraint permissive or defer finalizing it to Phase 3's own research |
| A4 | JWT expiry duration is set to 30 days in the code example (Claude's Discretion per CONTEXT.md — "exact JWT expiry duration") | Code Examples (Pattern 2) | Low — purely a config value (`JWT_EXPIRY_SECONDS`), trivially changed without touching schema or blocklist logic |
| A5 | `notifications.appointment_id` foreign-key nullability and `notifications.id` primary key type were not present in the client-code source (which only shows column *usage*, not the `CREATE TABLE` statement) — assumed `id: TEXT PRIMARY KEY` and `appointment_id` nullable | Code Examples | Medium — DATA-02 already flags this whole table as "best-effort, unverified schema" per D-02; if wrong, only affects a table with zero production data/callers to migrate |

**Risk framing:** All five assumptions are either explicitly delegated to Claude's discretion by CONTEXT.md, or already flagged as best-effort/unverified by the locked DATA-02 decision — none require new user confirmation beyond what CONTEXT.md already anticipated. A3 is the one item worth a lightweight confirmation before Phase 3 planning locks it in.

## Open Questions

1. **Should the `admin_action_log.action` CHECK constraint include `approve_mechanic`/`reject_mechanic` at all, given the approval flow was removed from the source system?**
   - What we know: The final Postgres constraint still lists all three values, but two are dead (Pitfall 4).
   - What's unclear: Whether Phase 3 needs those legacy values for historical-data compatibility (moot here since there's no data migration, per PROJECT.md) or should start clean with only `create_mechanic`/`delete_mechanic`.
   - Recommendation: Phase 1 should define the table with a CHECK permissive enough to not block Phase 3 (e.g., include `create_mechanic` and `delete_mechanic` only, since there's no historical data to preserve) — Phase 3's own research can revisit if needed.

2. **`node:sqlite`'s stabilization timeline** — should this project revisit swapping `better-sqlite3` for the zero-dependency built-in module later?
   - What we know: `node:sqlite` is release-candidate on Node 24+ as of this research [CITED: web search].
   - What's unclear: When (or if) it will reach full stability and API parity with `better-sqlite3`.
   - Recommendation: Stick with `better-sqlite3` for Phase 1; not a blocking concern, revisit opportunistically in a later phase if desired.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|--------------|-----------|---------|----------|
| Node.js | Entire server runtime | ✓ | v24.15.0 [VERIFIED: `node --version` on dev machine] | — |
| npm | Package installation | ✓ | 8.19.4 [VERIFIED: `npm --version` on dev machine] | — |
| C++ build toolchain (for native addons) | `better-sqlite3`, `argon2`, `bcrypt` if no prebuilt binary matches | Not probed (Windows dev machine — Visual Studio Build Tools presence unknown) | — | Prebuilt binaries cover most common Node/platform combos; document the Build Tools install as a troubleshooting fallback only (Pitfall 5) |
| SQLite server process | None — SQLite is embedded, no separate service needed | N/A | — | — |

**Missing dependencies with no fallback:** none identified.

**Missing dependencies with fallback:** C++ build toolchain — only needed if native-addon prebuilds miss the target platform; document as a fallback step in the setup README, not a hard prerequisite.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | `vitest` 4.1.10 [VERIFIED: npm registry] |
| Config file | none yet — see Wave 0 |
| Quick run command | `npx vitest run --reporter=dot` |
| Full suite command | `npx vitest run` |

`vitest` is recommended over `jest` for a new TypeScript/ESM Node project in 2025-2026: no separate ts-jest/babel config needed, faster startup, and native ESM support. `supertest` (7.2.2 [VERIFIED: npm registry]) is the standard companion for exercising Fastify's HTTP layer in tests (`app.inject()` is also viable as a Fastify-native alternative to supertest and avoids an extra dependency — planner's choice).

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|--------------------|--------------|
| INFRA-01 | Server boots reading DB_PATH/PORT/JWT_SECRET from env, fails fast if missing | unit | `npx vitest run tests/config.test.ts` | ❌ Wave 0 |
| INFRA-02 | Server starts against a local SQLite file via documented command | smoke | `npm run dev` + manual `curl localhost:PORT/health` | ❌ Wave 0 (add a `/health` route) |
| DATA-01 | All 9 tables exist after migration runs | integration | `npx vitest run tests/db/schema.test.ts` | ❌ Wave 0 |
| DATA-02 | `notifications` table has the 9 inferred columns | integration | `npx vitest run tests/db/schema.test.ts` | ❌ Wave 0 (same file as DATA-01) |
| DATA-03 | Updating `profiles.name` or `mechanics.is_active` updates `public_mechanics` without a manual step | integration | `npx vitest run tests/db/public-mechanics-sync.test.ts` | ❌ Wave 0 |
| AUTH-01 | POST /auth/signup creates a `client`-role profile with hashed password | integration | `npx vitest run tests/routes/auth.test.ts` | ❌ Wave 0 |
| AUTH-02 | POST /auth/login returns a JWT; the same JWT is valid across a simulated restart (fresh process re-reading the same DB file) | integration | `npx vitest run tests/routes/auth.test.ts` | ❌ Wave 0 (same file) |
| AUTH-03 | POST /auth/logout revokes the JWT; subsequent authenticated request with that token returns 401 | integration | `npx vitest run tests/routes/auth.test.ts` | ❌ Wave 0 (same file) |

### Sampling Rate

- **Per task commit:** `npx vitest run --reporter=dot`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `vitest.config.ts` — framework install/config, using an isolated `:memory:` or temp-file SQLite DB per test run
- [ ] `tests/db/schema.test.ts` — covers DATA-01, DATA-02
- [ ] `tests/db/public-mechanics-sync.test.ts` — covers DATA-03
- [ ] `tests/routes/auth.test.ts` — covers AUTH-01, AUTH-02, AUTH-03
- [ ] `tests/config.test.ts` — covers INFRA-01
- [ ] Framework install: `npm install -D vitest supertest @types/node`
- [ ] A `/health` route for the INFRA-02 smoke check (not itself a requirement, but the simplest way to verify "server starts and responds")

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|----------------|---------|--------------------|
| V2 Authentication | yes | `argon2`/`bcrypt` for password storage; `jsonwebtoken` for session tokens; no plaintext password ever logged or stored |
| V3 Session Management | yes | Single long-lived JWT + SQLite blocklist (D-03/D-04/D-05) — the ASVS-standard "short session + refresh" pattern was consciously traded away for build simplicity; this is a locked, reasoned exception, not an oversight |
| V4 Access Control | no (Phase 2) | AUTH-04 role-based middleware is explicitly out of scope for Phase 1 |
| V5 Input Validation | yes | `zod` schemas on every request body (signup email/password shape, length limits mirroring the Postgres CHECK constraints observed, e.g. `vehicle_info` ≤120 chars pattern for future phases) |
| V6 Cryptography | yes | Never hand-roll: `argon2`/`bcrypt` for hashing, `jsonwebtoken`'s HMAC-SHA256 (HS256) for signing with a `JWT_SECRET` of ≥32 characters (enforced by the zod config schema in Pattern 1) |

### Known Threat Patterns for Node/SQLite + JWT

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|-----------------------|
| SQL injection via string-concatenated queries | Tampering | Drizzle's parameterized query builder (never raw string interpolation into SQL, including in the hand-written trigger migration file — use static SQL there, no user input reaches it) |
| JWT algorithm-confusion attack (attacker submits `alg: none` or swaps HS256/RS256) | Spoofing / Tampering | `jsonwebtoken`'s `verify()` call must explicitly pass `{ algorithms: ['HS256'] }` — never call `verify()` without pinning the expected algorithm |
| Long-lived token theft (XSS/device compromise) exploited before the owner notices | Elevation of Privilege | This is the direct cost of D-03's design tradeoff (locked, "costly to reverse" per CONTEXT.md) — the blocklist (D-04) is the only mitigation available once a token is confirmed compromised; ensure the logout/revoke path is reachable and fast |
| Password enumeration via differing error messages/timings on login | Information Disclosure | Return the same generic "invalid email or password" message and roughly constant response time whether the email doesn't exist or the password is wrong (argon2's own timing already helps here — don't short-circuit before hashing) |
| Timing attack on password comparison | Information Disclosure | Never hand-write string comparison for password hashes — `argon2.verify()`/`bcrypt.compare()` are constant-time by design |

## Sources

### Primary (HIGH confidence)
- None — Context7 MCP was unavailable in this environment (tool not registered); all library research fell back to WebSearch (LOW/MEDIUM tier) and direct `npm view`/legitimacy-scan verification (HIGH-equivalent for version/existence facts specifically, since those come from the live npm registry, not training data).
- Sibling repo source files (read directly this session, [VERIFIED] tags throughout) — the closest thing to a primary source for schema-shape claims.

### Secondary (MEDIUM confidence)
- `npm view <package> version` output for all Standard Stack entries — live registry data, HIGH confidence for version/existence, but package *suitability* claims (e.g., "Fastify has native TS support") remain WebSearch-sourced (LOW).
- `gsd_run query package-legitimacy check` signals (download counts, repo URLs, publish dates) for the audit table.

### Tertiary (LOW confidence)
- All WebSearch results on framework/library comparisons (Fastify vs Express, argon2 vs bcrypt, node:sqlite vs better-sqlite3, JWT blocklist patterns, SQLite trigger syntax, 12-factor config) — multiple 2025-2026 articles cross-referenced but none are official vendor documentation; treat these as directional guidance the planner should sanity-check against the chosen library's actual README before locking task-level detail.

## Metadata

**Confidence breakdown:**
- Standard stack: MEDIUM — versions verified live against npm registry (HIGH for that slice), but suitability/comparison claims are WebSearch-only (Context7 unavailable this session)
- Architecture (schema porting, trigger pattern, JWT blocklist): HIGH for the Postgres-source-of-truth claims (all read directly from the sibling repo files this session with verbatim quotes), MEDIUM for the SQLite-side implementation pattern (WebSearch-sourced, cross-checked against SQLite's well-known trigger syntax)
- Pitfalls: HIGH — all five are grounded in verbatim quotes from files read this session, not inferred

**Research date:** 2026-08-07
**Valid until:** 2026-09-06 (30 days — npm package versions and web-search-sourced best-practice claims move fast; re-verify versions before executing if this research is reused after that date)
