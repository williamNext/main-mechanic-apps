# Oficina — Car Workshop Booking Platform · Master Context Document

> **Audience:** AI coding agents (and humans) who will modify this codebase.
> **Purpose:** be the single source of truth for *what exists*, *how it connects*, *what it must
> do*, and *where the project is going*. If you are an agent starting a task here, read this file
> first, then read only the specific files your task touches.
> **Companion doc:** [`DESIGN_GUIDE.md`](DESIGN_GUIDE.md) — everything visual (colors, spacing,
> typography, components, how to re-skin the apps). Do not duplicate design decisions here.
>
> **Shell dialect:** every command block here assumes **bash** (Git Bash on Windows). This machine
> is PowerShell-primary — `grep`, `wc`, `cut`, `cp` and `<(...)` process substitution do not exist
> there. Translate, or run them in Git Bash.
>
> **Verification status (2026-08-10):** §4–§13 were checked line-by-line against the code and
> corrected by two independent review passes. §3, §14, §15, §16 are verified but volatile (file
> listings and scripts change). Anything marked **⚠️ UNVERIFIED** is an inference, not an
> observation. If this document and the code disagree, **the code wins** — and the section is a bug
> worth fixing.


---

## Table of Contents

1. [TL;DR for agents](#1-tldr-for-agents) · [1.1 Where to look for your task](#11-where-to-look-for-your-task)
2. [System overview](#2-system-overview)
3. [Repository map](#3-repository-map)
4. [Migration status: Supabase → local server](#4-migration-status-supabase--local-server)
5. [Actors, roles and permissions](#5-actors-roles-and-permissions)
6. [Use cases (complete catalogue)](#6-use-cases-complete-catalogue)
7. [Domain model and database schema](#7-domain-model-and-database-schema) · [7.3.1 Changing `public_mechanics`](#731-procedure-changing-public_mechanics-or-a-column-it-projects)
8. [Business rules and invariants](#8-business-rules-and-invariants)
9. [Backend server (`server/`)](#9-backend-server-server)
10. [API surface: existing + to-build](#10-api-surface-existing--to-build) · [**10.3 Open decisions — defaults**](#103-open-decisions--apply-these-defaults)
11. [Legacy Supabase surface being replaced](#11-legacy-supabase-surface-being-replaced)
12. [Frontend architecture (the three Expo apps)](#12-frontend-architecture-the-three-expo-apps)
13. [End-to-end flows (how things actually connect)](#13-end-to-end-flows-how-things-actually-connect)
14. [How to build and run everything](#14-how-to-build-and-run-everything) · [14.5 CI, git and secrets](#145-ci-git-conventions-and-secrets)
15. [Testing](#15-testing)
16. [Client rewiring plan (Supabase → server)](#16-client-rewiring-plan-supabase--server)
17. [Known gaps, risks and open questions](#17-known-gaps-risks-and-open-questions)
18. [Conventions for agents working here](#18-conventions-for-agents-working-here) · [18.1 Precedence over `.agents/AGENT_RULES.md`](#181-precedence-over-the-per-repo-agentsagent_rulesmd)
19. [Glossary (PT-BR ↔ EN)](#19-glossary-pt-br--en)

---

## 1. TL;DR for agents

- The product is a **car-workshop appointment booking system** in **Brazilian Portuguese**, split
  into **three separate Expo/React Native apps** (`oficina` = client, `mechanic`, `admin`) that
  all talk to **one shared backend**.
- The shared backend **is being migrated**: from **Supabase** (Postgres + RLS + `SECURITY DEFINER`
  RPCs + Deno edge functions) to a **self-hosted Node + SQLite server** in `server/`.
- `supabase/` and every `*/scripts/sql/*.sql` file are **the legacy system**. They are
  **deprecated**: keep them as the behavioral specification to port from, do not add features
  there.
- `server/` today implements **Phase 1 only**: config, SQLite schema (all 10 tables — one,
  `notifications`, has an inferred shape, §7.2), migrations,
  `public_mechanics` sync triggers, and email+password auth (`signup`/`login`/`me`/`logout`).
  **Booking, mechanic, admin and notification endpoints do not exist yet** — they are Phases 2–3
  (Phase 4 was dissolved by D-K).
- The three client apps **still call Supabase directly**. Nothing has been rewired yet.
- **Phone/SMS auth is being dropped** in the migration, but login/register UIs and
  `auth-service.ts` still contain phone paths. Treat phone auth as legacy.
- Everything that is *inferred* rather than *observed* is flagged in this document with
  **⚠️ UNVERIFIED**. Do not silently promote an assumption to a fact.
- **The three apps are NOT identical.** `admin/` lacks four of the six service files, uses a
  different storage backend and a different design system. Never generalize a fact found in one app
  to the other two — verify per app (§3.1).

### 1.1 Where to look for your task

| Your task | Read these sections |
|---|---|
| Implement a server endpoint | §8 (rules) · §9.4–§9.8 (transactions, role guard, conventions) · §10 (contracts + §10.3 defaults) · §15.1 (test skeleton) |
| Port a legacy RPC | §11.1 (mapping + which definition is current) · §11.3 (the duplicate-SQL trap) · §8 |
| Change the DB schema | §7 · §7.3.1 (the `public_mechanics` trigger procedure) · §9.6 (migrations) |
| Rewire an app off Supabase | §12 · §16 (per-file plan) · §14.5 (CI breaks otherwise) |
| Fix a bug in a screen | §3.1 (per-app differences) · §12.2 · §14.3 (what you can actually run today) · §15.2 |
| Anything visual | [`DESIGN_GUIDE.md`](DESIGN_GUIDE.md) only |
| Understand a business rule | **§8 — normative.** Every other section defers to it |

**Do not read this whole file for a small task.** Use the table, then read §18 (conventions) before
writing code.

---

## 2. System overview

```
┌────────────────┐   ┌────────────────┐   ┌────────────────┐
│  oficina/      │   │  mechanic/     │   │  admin/        │
│  (client app)  │   │  (mechanic app)│   │  (admin panel) │
│  Expo Router   │   │  Expo Router   │   │  Expo Router   │
│  iOS/Android/  │   │  iOS/Android/  │   │  web-first     │
│  web           │   │  web           │   │                │
└───────┬────────┘   └───────┬────────┘   └───────┬────────┘
        │  services/*.ts     │                    │
        │  (the ONLY layer that talks to backend) │
        └──────────┬─────────┴──────────┬─────────┘
                   │                    │
        ═══════════▼════════════════════▼═══════════
         TODAY (legacy)          TARGET (in progress)
        ┌───────────────────┐   ┌───────────────────────┐
        │ Supabase project  │   │ server/               │
        │ • Postgres + RLS  │   │ • Node 24 + Fastify 5 │
        │ • SECURITY        │──▶│ • better-sqlite3      │
        │   DEFINER RPCs    │   │ • Drizzle ORM         │
        │ • 2 edge funcs    │   │ • JWT (HS256) auth    │
        │ • supabase.auth   │   │ • argon2id hashing    │
        └───────────────────┘   └───────────────────────┘
                   ▲
        ┌──────────┴─────────┐
        │ tests-e2e/         │  Playwright, drives web builds + a
        │ (Playwright)       │  service-role Supabase client
        └────────────────────┘
```

**Core value:** a client books a mechanic's timeslot; the mechanic and the admin see it, manage
it, and close it out with a priced service report — **without double-booking** and **without
losing cross-app visibility**. That guarantee must survive the Supabase → SQLite migration.

**No realtime layer.** Cross-app visibility is achieved by refetching (pull-to-refresh / screen
focus). Supabase Realtime is not used anywhere (verified: zero usages) and no websocket layer is
planned.

---

## 3. Repository map

**As of 2026-08-11 this is a monorepo.** `C:\Users\Pichau\Desktop\projetos\` is a single git
repository pushed to **`https://github.com/williamNext/main-mechanic-apps`** (branch `master`).
The four formerly independent repos were absorbed with `git subtree`, so all 80 original commits
are preserved. Each subfolder still has its own `package.json`, `node_modules` and deploy config —
only version control was unified.

A cross-cutting change is now **one commit**, which is the point: `types/models.ts`,
`constants/theme.ts`, wire clients, secure-storage adapters, and error maps are copy-pasted between
apps and have drifted (§17.4).

⚠️ **Consequences of the absorb, both live:**
- **The three app CI workflows no longer run.** GitHub reads `.github/workflows/` only at the
  repository *root*; `oficina/.github/`, `mechanic/.github/` and `admin/.github/` are now inert.
  Root `.github/workflows/ci.yml` runs gitleaks plus path-filtered server and app checks.
- **The old `.git` directories were moved, not deleted**, to
  `C:\Users\Pichau\Desktop\projetos-git-archive\`. The three GitHub repos `williamNext/oficina`,
  `/mechanic` and `/admin` are fully pushed and should be archived read-only so there is no
  ambiguity about which repo is canonical. `williamNext/server` never existed — the monorepo and
  that local archive are the only copies of its history.

| Folder | What it is | Git repo | Status |
|---|---|---|---|
| `oficina/` | Client-facing app (browse mechanics, book, manage bookings) | yes | active |
| `mechanic/` | Mechanic app (agenda, availability, close service) | yes | active |
| `admin/` | Admin panel (dashboard, mechanics, appointments, finance, reports) | yes | active |
| `server/` | New Node + SQLite backend | yes | **active, the future** |
| `supabase/` | Legacy backend: 2 edge functions + docs + planning notes | no `.git` seen | **deprecated** |
| `tests-e2e/` | Playwright end-to-end suite against the *legacy* stack | no | needs repointing |
| `specs.client,md.txt` | Raw PT-BR feature wishlist (see §17) | — | backlog notes |

### 3.1 Inside a client app

**Layout shared by `oficina` and `mechanic`** (see the admin differences below — they are
substantial):

```
<app>/
  app/                 Expo Router file-based routes (screens)
    _layout.tsx        Root layout: fonts, session bootstrap, Stack
    index.tsx          Entry redirect based on auth state
    (auth)/            login.tsx, register.tsx (register: oficina only)
    (client|mechanic)/ Role-gated tab group
  components/
    ui/                Generation-1 primitives (Button, Card, Badge, …)  ← what screens use
    app/               Generation-2 primitives (AppButton, AppCard, …)   ← partial adoption
  services/            ⬅ THE BACKEND BOUNDARY. Only these files talk to a backend.
    api.ts             oficina's HTTP client; mechanic uses wire-client.ts; admin still uses Supabase
    auth-service.ts    login / signup / session / profile fetch
    mechanic-service.ts, timeslot-service.ts, appointment-service.ts, notification-service.ts
  stores/              Zustand: auth, appointment, timeslot, mechanic, notification
  hooks/               use-auth, use-theme, use-color-scheme, use-theme-color
  constants/           theme.ts (design tokens), config.ts (app constants)
  config/env.ts        EXPO_PUBLIC_* env access, single place
  types/models.ts      Domain TypeScript types
  utils/               date.ts, format.ts  (+ secure-storage.ts in oficina and mechanic)
  scripts/             check-env, export-web, seed*, setup-git-hooks, sql/ (legacy migrations)
  tests/e2e/ + playwright.config.ts   Per-app Playwright suite (see §15.2)
  dist/                Committed static web export output
  .agents/AGENT_RULES.md   Agent behavior rules for that repo (see §18.1 for precedence)
  .agents/skills/          supabase/, supabase-postgres-best-practices/ — legacy, see §18.1
  .Jules/                  palette.md, sentinel.md — recorded learnings
  .planning/codebase/      Generated codebase analysis docs
```

**`admin/` differs materially — do not assume the tree above:**

| | `oficina` / `mechanic` | `admin` |
|---|---|---|
| `services/` | 6 files | **3 only**: `api.ts`, `auth-service.ts`, `admin-service.ts`. There is **no** `appointment-service.ts`, `mechanic-service.ts`, `timeslot-service.ts` or `notification-service.ts` — every admin read goes through `admin-service.ts` |
| `stores/` | 5 stores | **2 only**: `auth-store.ts`, `admin-store.ts` |
| `components/` | full `ui/` + `app/` sets | **no generation-1 set** — only `components/admin/AdminShell.tsx` and `components/ui/AdminControls.tsx` |
| extra dirs | — | `features/admin/filter-utils.ts` — **client-side UI filter state** only (see the warning below) |
| native session storage | `oficina` and `mechanic`: `expo-secure-store` via `utils/secure-storage.ts` | `@react-native-async-storage/async-storage` |
| design tokens | consumed from `constants/theme.ts` | largely bypassed (208 literal hexes) |

⚠️ `admin/package.json` also depends on **`pg` (^8.21.0)** — a Node Postgres driver inside an Expo
app. It is unused dead weight and should be removed during the rewire.

⚠️ **Do NOT port `features/admin/filter-utils.ts` as the server's filter contract.** It is the
app's local UI state helper and it **disagrees with the legacy RPCs on three points** — the
server must follow §6.4/§8, not this file:

| | `filter-utils.ts` (client UI) | Legacy RPCs = the server contract (§6.4) |
|---|---|---|
| default `to` | **end of month** (`endOfMonth(now)`) | **today** |
| timezone | host-local (`new Date()`) | **America/Sao_Paulo** |
| inverted range | silently **clamps** (`to = from`) | **raises `invalid date range`** |

It is still worth reading for the shared param names, the `pageSize` cap of 100, and the
`search` 120-char trim.

**The single most important structural fact:** only `services/*.ts` import `services/api.ts` — plus
each app's `app/_layout.tsx`, which subscribes to `supabase.auth.onAuthStateChange` (verified:
exactly three imports of `api.ts` outside `services/`, all in `_layout.tsx`). That is what makes
the migration cheap — ~4–10 files per app.
Note the weaker layering claim in §12.2 (`screen → store → service`) *is* violated in places:
`oficina/app/(auth)/register.tsx` and `admin/app/(admin)/appointments.tsx` import from
`@/services/` directly.

### 3.2 Inside `server/`

```
server/
  src/
    server.ts          Entrypoint: createDb → runMigrations → buildApp → listen
    app.ts             buildApp(db, connection): registers route modules
    config/index.ts    Zod-validated env. ONLY module allowed to read process.env
    db/
      client.ts        better-sqlite3 connection (WAL + foreign_keys ON) + Drizzle
      schema.ts        All 10 tables, constraints, indexes (heavily commented)
      migrate.ts       Drizzle migrator; also a CLI entrypoint
      migrations/      0000…0003 + meta/ (generated by drizzle-kit + 1 handwritten)
    auth/
      hash.ts          argon2id hash/verify
      jwt.ts           sign/verify HS256, algorithm allowlist pinned
      middleware.ts    requireAuth(db) Fastify preHandler
      blocklist.ts     token revocation table access (revoke/isRevoked/prune)
    routes/
      health.ts        GET /health (live DB probe)
      auth.ts          signup, login, me, logout
  scripts/seed-admin.ts   The ONLY way an admin account is created
  tests/                  vitest: config, schema, triggers, blocklist, auth routes
  .planning/              FROZEN (2026-08-11). Phase 1 GSD build record only — see its README.md
  drizzle.config.ts, vitest.config.ts, tsconfig.json, README.md
```

---

## 4. Migration status: Supabase → local server

### 4.1 Why

Self-hosting removes the paid third-party dependency, removes the Twilio/SMS cost (phone auth is
dropped), and puts business logic in reviewable TypeScript instead of Postgres `SECURITY DEFINER`
functions spread across three repos' `scripts/sql/` folders.

### 4.2 Roadmap

| Phase | Scope | State |
|---|---|---|
| **1. Foundation & Auth Walking Skeleton** | Portable server, full schema + triggers, signup/login/me/logout, admin seed script | ✅ **Complete** (2026-08-08) |
| **1.5 Prove the Wire** | Rewire `oficina` **auth only** onto the existing Phase 1 endpoints; global error handler; CORS; `seed:dev`; root CI; first new e2e spec | ✅ **Complete** (2026-08-12) — see [`SPEC-phase-1.5-prove-the-wire.md`](SPEC-phase-1.5-prove-the-wire.md). Carries one debt: hand-verification on an Android emulator and a physical device was deferred to pre-production (ticket 06) |
| **2. Booking & Appointments — `oficina` vertical** | Role guard, `public_mechanics` reads, server-side availability, book, client-cancel, appointment list/detail, notifications + fan-out for those two writes, `profiles.role` triggers (D-R). **Ends with `@supabase/supabase-js` deleted from `oficina`** | ✅ **Complete** (2026-08-12) |
| **2b. Mechanic vertical** | Timeslot CRUD + **overlap (D-J/D-S)**, completion + service report, mechanic-cancel branch, complete fan-out, `mechanic` app rewired and fully off Supabase; shared-package extraction deferred | ✅ **Complete** (2026-08-14) |
| **3. Admin Management** | create/delete mechanic, dashboard, lists, details, financial report, `admin` app rewired, shared-package debt discharged with all three app consumers | ⬜ Not started (**current phase**) |
| ~~**4. Notifications**~~ | **Dissolved into Phases 2–3 by D-K.** The client UI already exists; fan-out belongs inside the transactions that cause it | — |

**Phases 2–3 were re-cut on 2026-08-12 (D-Q).** The roadmap previously sliced by *capability*
("Booking & Appointment Lifecycle"), which would have built the whole booking surface server-side
before any client called it. It now slices by **app vertical**: each phase builds only the
endpoints one app consumes, rewires that app, and ends with that app fully off Supabase. This
carries Phase 1.5's thesis forward — every endpoint gets a real client in the same phase it ships.
The accepted cost is that an appointment is bookable in Phase 2 but not *completable* until
Phase 2b, because completion is a mechanic action.

**Phase 1.5 was inserted on 2026-08-11.** §16's original ordering (finish Phase 2, *then* rewire) is not wrong, only riskier: it defers every unproven cross-cutting assumption — `fetch` wrapper, token storage, CORS, `EXPO_PUBLIC_API_URL`, the CI secret swap, the `_layout.tsx` bootstrap — to a single late change landing on top of brand-new booking endpoints. Phase 1.5 proves all of them against endpoints that already work, with one screen of blast radius.

Requirement IDs cited throughout this document — `AUTH-01..05`, `DATA-01..04`, `BOOK-01..05`,
`ADMIN-01..03`, `NOTIF-01..02`, `INFRA-01..07` — are defined in [`REQUIREMENTS.md`](REQUIREMENTS.md), which also
carries the per-phase traceability table. Complete: AUTH-01/02/03, DATA-01/02/03, INFRA-01/02.
Everything else is pending.

⚠️ **`server/.planning/` is frozen** (2026-08-11). The GSD workflow that produced it was abandoned;
its `ROADMAP.md` predates Phase 1.5 and still lists the dissolved Phase 4, and its `STATE.md`
reports a stale current phase. It is kept only as the build record of Phase 1 — see
[`server/.planning/README.md`](server/.planning/README.md). This section and `REQUIREMENTS.md` are
the live sources.

### 4.3 Explicit scope decisions (do not re-litigate without the user)

**In scope:** 1:1 schema port; JWT auth; API-layer role authorization replacing RLS; ports of every
RPC and both edge functions; notification fan-out; portable Node process.

**Out of scope / dropped:**

| Dropped | Reason |
|---|---|
| Phone/SMS OTP signup & login (`AUTH-05`) | Cuts Twilio cost/complexity. May return later. |
| Realtime subscriptions | Never used by any app. |
| File/object storage | Never used by any app. |
| Production data migration (`DATA-04`) | Fresh SQLite DB; no Postgres→SQLite type transform work. |
| Concrete hosting target | Deliberately deferred; server stays platform-agnostic. |
| Client app UI/screen rewrites | Out of scope **for the `server/` repo's phases**. The rewire itself is real, planned work — see §16 — it just happens in each app's own repo. |
| `tests-e2e/` repointing | Known downstream dependency, separate effort. |

### 4.4 What "deprecating supabase/" concretely means

- **Keep** `supabase/functions/*` and all `*/scripts/sql/*.sql` as *read-only specification*.
  They are the most precise statement of current behavior and are cited by line number throughout
  `server/src/db/schema.ts`.
- **Do not** add new SQL migrations to `oficina/scripts/sql/`, `mechanic/scripts/sql/`, or
  `admin/scripts/sql/`.
- **Do not** add new Supabase edge functions.
- New backend behavior goes in `server/src/` with a Drizzle migration and vitest coverage.
- Delete the Supabase dependency from an app **only** when that app's `services/*.ts` layer has
  been fully rewired and verified.

---

## 5. Actors, roles and permissions

Three roles live in one column: `profiles.role ∈ {'admin','mechanic','client'}`.

`profiles.role` has no database `CHECK` constraint: migration `0004` instead enforces the value set
with the two D-R `BEFORE INSERT` and `BEFORE UPDATE OF role` triggers using `RAISE(ABORT)`. This
avoids the destructive parent-table rebuild described in §7.2 and §17.2. TypeScript's `Role` union
remains compile-time support, not database enforcement.

| Actor | App | How the account is created | Can do |
|---|---|---|---|
| **Client** | `oficina` | Self-signup (`POST /auth/signup`, always forced to role `client`) | Browse active mechanics, view availability, book a slot, view/cancel own bookings, view own notifications, view own profile |
| **Mechanic** | `mechanic` | **Only** by an admin (legacy: `admin-create-mechanic` edge function; target: `POST /admin/mechanics`) | See own agenda, create/delete/toggle own timeslots, cancel an assigned appointment, complete an appointment with a priced service report, view own notifications, edit own profile |
| **Admin** | `admin` | **Only** by `npm run seed:admin` on the server (no signup endpoint, ever) | Everything read-only across the workshop + create/delete mechanics; dashboard, appointment list/detail, mechanic list/detail, financial reports |

**Authorization model, then vs now:**

| Concern | Legacy (Supabase) | Target (server) |
|---|---|---|
| Who am I | `auth.uid()` inside Postgres | `request.user.sub` from the verified JWT |
| Am I admin | `private.is_admin()` SQL function | role claim **re-checked against the DB row**, never trusted from the client |
| Row visibility | RLS policies per table | explicit `WHERE` clauses in route handlers + role middleware |
| Privileged writes | `SECURITY DEFINER` functions | ordinary handlers behind `requireAuth` + a role guard |
| Public/anon read | `public_mechanics` was the one anon-readable table | same table, served by an unauthenticated (or client-role) endpoint |

**Hard rule (`D-07`):** `POST /auth/signup` strips any client-supplied `role` (zod default-strip)
and always inserts `role: 'client'`. There is no privilege escalation path through signup.

---

## 6. Use cases (complete catalogue)

Format: **UC-ID · Title** — actor, trigger, flow, rules, current implementation, target
implementation.

### 6.1 Authentication & session

**UC-A1 · Client signs up**
Actor: visitor · Screen: `oficina/app/(auth)/register.tsx`
Flow: name + email + password → account created → **immediately authenticated and routed to the
app's default screen** (see `specs.client,md.txt` line 6; the legacy flow required a separate
login).
Rules: password ≥ 8 chars (server `SignupSchema`); email normalized `trim().toLowerCase()`; a
duplicate email returns **409** (`email already registered`); role forced to `client`.
Legacy: `supabase.auth.signUp()` then a separate `profiles` insert — **two operations, not atomic**.
Target: `POST /auth/signup` → `201 { token, user }` — one transaction-free single insert; the
token is returned so the client can go straight in. ✅ Implemented.

**UC-A2 · Any role logs in**
Actor: client/mechanic/admin · Screens: each app's `(auth)/login.tsx`
Rules: identical response for "unknown email" and "wrong password" (`401 invalid email or
password`), and the unknown-email path still runs an argon2 verify against a module-level dummy
hash so **timing does not leak account existence**. Role in the token comes from the stored row
only.
Target: `POST /auth/login` → `200 { token, user }`. ✅ Implemented.
Note: `admin/services/auth-service.ts` `login(identifier, …)` accepts an "identifier" (email or
phone) — after migration this must be email-only.

**UC-A3 · Session persists across app restart**
`oficina` and `mechanic` store one long-lived JWT (default **30 days**,
`JWT_EXPIRY_SECONDS=2592000`) through `expo-secure-store` on native and `localStorage` on web;
there is **no refresh-token flow**. `GET /auth/me` re-reads the profile fresh from the DB on every
boot, so a changed profile/role is reflected immediately. `admin` still uses legacy Supabase
session persistence and unencrypted AsyncStorage until Phase 3.

**UC-A4 · Logout invalidates the session**
Rules: logout writes the token's `jti` into `token_blocklist` with the token's **own `exp`**.
`requireAuth` verifies signature *first*, then checks the blocklist — a forged token never causes
a DB read. Revocation is **durable across server restarts** (that is why it is a table, not a
Map). Calling logout twice returns 401 the second time (the preHandler rejects the already-revoked
token), even though `revokeToken` itself is idempotent.
Target: `POST /auth/logout` → `204`. ✅ Implemented.

**UC-A5 · Admin bootstrap**
`npm run seed:admin -- "Name" "email" "password"` writes directly to the SQLite file. Refuses if
any admin already exists. Never an HTTP route, never triggered at boot. ✅ Implemented.

**UC-A6 · Password recovery** — ⬜ **Not implemented anywhere.** Requested in
`specs.client,md.txt` (line 9) via phone code. Since phone auth is dropped, this needs an
email-based design decision before it can be built.

### 6.2 Client (`oficina`)

**UC-C1 · Browse mechanics** — `app/(client)/browse/index.tsx`
Lists active mechanics with name, specialty, avatar.
⚠️ **Current privacy gap:** `oficina` reads **full `profiles` rows** —
`.from('profiles').select('*, mechanics!inner(*)')` — so email and phone reach the client app. It
does **not** use `public_mechanics` anywhere. The `public_mechanics` projection is read only by the
**`mechanic`** app (`mechanic/services/mechanic-service.ts`, via `mapPublicMechanicRow`).
Target: `GET /mechanics`, served from `public_mechanics`, which closes the gap. **Privacy rule
`DATA-03`: `public_mechanics` exposes exactly `id, name, specialty, avatar_url, updated_at` — do
not add columns to it.**

**UC-C2 · View a mechanic's availability** — `app/(client)/browse/[mechanicId].tsx`
Shows the next **7 days** as chips (`utils/date.ts` `getNextDays`), and available slots for the
selected date.
Rules (from `timeslot-service.getAvailableSlotsByMechanic`): only `is_available = true`; past
dates return `[]`; for *today*, only slots whose `start_time` is later than the current
**America/Sao_Paulo** wall-clock time; results ordered by `start_time`.

**UC-C3 · Book a timeslot** — same screen, `handleBook()`
Input: selected slot + optional `vehicleInfo` (vehicle model, ≤120 chars) + optional `notes`
(problem description, ≤1000 chars). On success → `booking-success` screen. Per
`specs.client,md.txt` line 7, a **confirmation popup** is expected on confirm.
Rules (see §8.1): caller must be role `client`; slot must exist, be available, and be in the
future (São Paulo); appointment created with status `confirmado`; the slot flips to
`is_available = false`. Concurrency-safe.
Error mapping already implemented client-side: `unavailable` → "Horário indisponível" + force
refetch; `expired` → "Horário expirado" + force refetch; `too long` → validation message.
Legacy: `rpc('book_client_appointment')`. Target: `POST /appointments`.

**UC-C4 · List own bookings** — `app/(client)/bookings.tsx`
Legacy calls `sync_unfinalized_appointments()` **before every list read**, then selects
appointments for `client_id` with the joined service report, then a second query to resolve
mechanic name/phone (PostgREST nested-join workaround). Ordered by `date` desc.
Target: `GET /appointments?scope=client` — the status auto-transition must happen server-side on
read (§8.3), and the mechanic name/phone should be joined in one response.

**UC-C5 · View booking detail** — `app/(client)/appointment/[id].tsx`
Shows vehicle info, notes, status, and — once closed — the service report (summary, diagnosis,
work performed, parts used, recommendations, total, line items, closedAt).

**UC-C6 · Cancel own booking**
Rules: only the owning client; only from status `confirmado` (client cancel is **stricter** than
mechanic cancel, which also allows `nao_finalizado`); already-`cancelado` is a silent no-op;
cancelling sets `status='cancelado'` **and frees the timeslot** (`is_available = true`).
Legacy: `rpc('cancel_client_appointment')`. Target: `POST /appointments/:id/cancel`.

**UC-C7 · Notifications** — `app/(client)/notifications.tsx`
List own notifications (newest first, limit 50), unread count, mark one read, mark all read.
⚠️ The `notifications` table **was never actually created in production** — see §17.1. The UI and
service layer exist; the data layer does not.

**UC-C8 · Profile** — `app/(client)/profile.tsx`
Shows the user's data and offers logout. "Meus dados" (`handleMyData`) toggles an inline panel with
an **editable name field** (`handleSaveData` → `updateProfile({ name })`, ≥2 chars, "Dados salvos"
confirmation) — so the `specs.client,md.txt` line 11 request is **partly shipped**.
⬜ Still missing: **phone** (deliberately read-only pending the phone-verification decision) and
**email** editing.

### 6.3 Mechanic (`mechanic`)

**UC-M1 · View agenda** — `app/(mechanic)/agenda.tsx`
Appointments where `mechanic_id = me`, with client name and phone, `date` desc, after the
unfinalized-sync call. Target: `GET /appointments?scope=mechanic`.

**UC-M2 · Manage availability** — `app/(mechanic)/availability.tsx` (756 lines — the most complex
screen in the project)
Create single slots, create **batches** with quick intervals (+1h, +1h30, +2h) starting from
`08:00` or from the day's last `end_time`, toggle a slot's availability, delete a slot.
Client-side validation retains `YYYY-MM-DD` and `HH:mm` formats and `end_time > start_time` as
pre-submit UX. Past-time and overlap enforcement now belongs to the server.
DB-side: `timeslots_time_order_check` (`end_time > start_time`) and a unique index on
`(mechanic_id, date, start_time, end_time)`.
~~⚠️ **Overlap is only checked client-side.** The database prevents exact duplicates, not partial
overlaps. If the server should enforce it, that is new behavior to add deliberately.~~ ✅ Resolved by
ticket 03's server-side half-open overlap enforcement in `POST /timeslots` and ratified by D-S.

**UC-M3 · Cancel an assigned appointment**
Rules: only the assigned mechanic; allowed from `confirmado` **or** `nao_finalizado`; already
`cancelado` is a no-op; frees the timeslot.
Legacy: `rpc('cancel_mechanic_appointment')`. Target: same endpoint as UC-C6, branching on role.

**UC-M4 · Complete an appointment with a service report** — `app/(mechanic)/appointment/[id].tsx`
This is the richest write in the system. Inputs: `summary` (3–240 chars, required), `diagnosis`
(≤1000, optional), `workPerformed` (3–2000, required), `partsUsed` (≤1000, optional),
`recommendations` (≤1000, optional), and `items[]` — **at least 1, at most 30** line items, each
`{ description: 2–160 chars, amountCents: integer ≥ 0 }`.
Effects, all-or-nothing: insert `appointment_service_reports` with
`total_amount_cents = Σ items.amountCents`, insert `appointment_service_items` with `sort_order`
0..n-1 preserving input order, set `appointments.status = 'acabado'`, stamp `closed_at` (UTC).
Rules: only the assigned mechanic; only from `confirmado`/`nao_finalizado`; **rejects if a report
already exists** (`appointment already has service report`) — completion is not re-runnable.
Legacy: `rpc('complete_mechanic_appointment')`. Target: `POST /appointments/:id/complete`,
wrapped in a single better-sqlite3 transaction.

**UC-M5 · Mechanic profile** — the mechanic app's `updateMechanicProfile` writes `name`,
`avatarUrl`, `phone` (on `profiles`) and **`specialty` only** (on `mechanics`).
⚠️ A `credentials` write path exists in `oficina/services/mechanic-service.ts` — but that copy is
**dead code**: no mechanic ever runs the client app. So today no shipped path lets a mechanic edit
their own `credentials`. `admin/scripts/sql/2026-05-25_remove_mechanic_approval_flow.sql` added a
guard trigger (`private.enforce_mechanic_admin_fields_guard`) around admin-owned fields — read it
before deciding who may write `credentials` / `is_active` on the new server. Recommended default:
`credentials` and `is_active` are **admin-only**.

**UC-M6 · Mechanic notifications** — identical service code to UC-C7 (files are byte-identical
between `oficina` and `mechanic`).

### 6.4 Admin (`admin`)

All admin reads are **filtered** by a shared `AdminFilters` shape: `{ from, to, status,
mechanicId, search, page, pageSize }`. Defaults when `from`/`to` are null: **from = start of the
current month, to = today**, both in America/Sao_Paulo. An inverted range raises
`invalid date range`.

**UC-AD1 · Dashboard** — `app/(admin)/dashboard.tsx` ← `admin_dashboard_summary(from, to)`
Returns `{ range, generatedAt, mechanics{total,active},
appointments{total,confirmed,unfinished,finished,canceled,today,revenueCents},
slots{upcomingAvailable,upcomingBlocked}, appointmentsByDay[] (gap-filled per day via
generate_series), topMechanics[] (top 5 by revenue, then count, then name) }`.
⚠️ Porting note: SQLite has no `generate_series` in the default build — the per-day series must be
generated in TypeScript.

**UC-AD2 · Mechanic list** — `admin_list_mechanics(search, page, pageSize)` → `PaginatedResult<AdminMechanicRow>`
(`{ rows, total, page, pageSize }`). Row includes profile fields + `specialty`, `credentials`,
`isActive`, `appointmentsTotal`, `appointmentsConfirmed`, `lastAppointmentDate`.

**UC-AD3 · Mechanic detail** — `app/(admin)/mechanics/[id].tsx` ←
`admin_get_mechanic_detail(mechanicId, from, to)` → `{ mechanic, range, appointmentStats,
slotStats, recentAppointments[] }`.

**UC-AD4 · Appointment list** — `app/(admin)/appointments.tsx` ←
`admin_list_appointments(from, to, status, mechanicId, search, page, pageSize)` →
`PaginatedResult<AdminAppointmentRow>` (rows carry client + mechanic names/phones, specialty, and
the flattened service-report fields).

**UC-AD5 · Appointment detail** — `admin_get_appointment_detail(appointmentId)` → one
`AdminAppointmentRow` including `serviceItems[]`.
⚠️ **Not ported:** no UI consumes it and `admin-service.ts` has no function for it.

**UC-AD6 · Financial report** — `app/(admin)/finance.tsx` ←
`admin_financial_report(from, to, mechanicId, search)` → `{ range, generatedAt,
summary{appointments,revenueCents,averageTicketCents}, revenueByDay[], revenueByMonth[],
byMechanic[], byService[], appointments[] }`. Revenue always comes from
`appointment_service_reports.total_amount_cents`; `byService` aggregates
`appointment_service_items` by description.

**UC-AD7 · Reports** — `app/(admin)/reports.tsx`, a second view over the same data.

**UC-AD8 · Create a mechanic** — `POST /admin/mechanics`, behind `requireAdmin(db)`, accepts
`{ name, phone, email, password, specialty, credentials }`. All six fields are required, email is
validated and normalized, and password length is 8–200; field failures return `400
VALIDATION_FAILED`. `isActive` from the request is ignored and the stored value is always `true`.
The server hashes the password with argon2id, then inserts `profiles` (role `mechanic`) before
`mechanics` inside one `BEGIN IMMEDIATE` transaction, allowing the existing triggers to publish the
row to `public_mechanics` before commit. A `profiles.email` collision returns `409 EMAIL_TAKEN`;
any second-insert failure rolls back the profile automatically. Success returns `201
AdminMechanicRow`. No notification is sent; the admin hands over the password out of band.

**UC-AD9 · Deactivate and reactivate mechanics**
`POST /admin/mechanics/deactivate`, behind `requireAdmin(db)`, accepts `{ mechanicIds: string[] }`.
Ids are non-empty opaque strings, deduplicated, then capped at 100. One `BEGIN IMMEDIATE`
transaction resolves existing mechanics, snapshots every resolved row before writing, ignores
unmatched and already-inactive ids, cancels each active target's `confirmado` and
`nao_finalizado` appointments, frees their timeslots, sends one client-only
`appointment_canceled` notification per cancellation, writes one `deactivate_mechanic` audit row
per mechanic, and sets `is_active=false`. Audit `before_state` is
`{id,name,email,phone,specialty,credentials,isActive,cancelledAppointmentIds,cancelledAppointmentCount}`;
`after_state` is `{isActive:false}`. Success returns
`{deactivatedCount,requestedCount,ignoredCount,cancelledAppointmentCount}`. Empty or over-limit
input returns `400 VALIDATION_FAILED`; no existing match returns `404 NO_MATCHING_MECHANICS`; write
contention returns `503 DATABASE_BUSY`.

`POST /admin/mechanics/:id/reactivate`, also admin-only, is single-target. It sets
`is_active=true` and writes one `reactivate_mechanic` audit row. It does not restore appointments or
timeslot blocks. An already-active mechanic succeeds without change; a missing mechanic returns
`404 MECHANIC_NOT_FOUND`. No endpoint truly deletes a mechanic.

**UC-AD10 · Settings** — `app/(admin)/settings.tsx`, minimal.

**Removed feature:** mechanic *approval* (`admin_set_mechanic_approval`, `approve_mechanic` /
`reject_mechanic` actions) was deleted by `2026-05-25_remove_mechanic_approval_flow.sql`. The new
schema reflects the post-removal state: `mechanics.is_active` **defaults to `true`** and
`ADMIN_ACTIONS` only contains `create_mechanic` / `delete_mechanic`. Do not resurrect approval
unless asked.

---

## 7. Domain model and database schema

Authoritative source: **`server/src/db/schema.ts`** (Drizzle, SQLite) — read its comments, they
record every deliberate divergence from the Postgres original with file:line citations.

### 7.1 Conventions

- IDs: `TEXT` primary keys holding `randomUUID()` values (Postgres used native `UUID`).
- Timestamps: ISO-8601 `TEXT`, default `strftime('%Y-%m-%dT%H:%M:%fZ','now')` (UTC).
  **Exception:** `token_blocklist.expires_at` / `revoked_at` are **INTEGER unix seconds**, because
  they are compared to the JWT's numeric `exp` claim.
- Booleans: `INTEGER` with Drizzle `{ mode: 'boolean' }`.
- Money: **integer cents** everywhere (`*_cents`). Never floats.
- Dates: `date` is `'YYYY-MM-DD'`; `start_time`/`end_time` are `'HH:mm'` (string comparison is
  chronological — this is relied upon by both SQL and TS code).
- Drizzle's `text(..., { enum: [...] })` is **TypeScript-only** and emits no SQL. Value sets that
  must be enforced use explicit `CHECK` constraints or triggers; `profiles.role` uses the two D-R
  triggers, not a `CHECK` (§5). Verify the emitted migration SQL, not `schema.ts`.
- `foreign_keys = ON` is set per connection in `db/client.ts`. SQLite defaults it **off** — without
  that pragma every FK in the project is inert.

### 7.2 Tables

**`profiles`** — every user, all roles.
`id` PK · `name` NOT NULL · `email` NOT NULL **UNIQUE** · `role` NOT NULL (**enforced by the two
D-R `BEFORE` triggers using `RAISE(ABORT)`, not by a `CHECK`; the database has eight triggers total**,
see §5 and §10.3) · `phone` · `avatar_url` · `password_hash` NOT NULL · `created_at`.
Divergences from Postgres: `email` is NOT NULL again (Postgres relaxed it for phone-only auth,
which this project drops); `password_hash` is **new** (Supabase Auth used to own credentials).

**`mechanics`** — 1:1 extension of a `profiles` row.
`id` PK → `profiles.id` ON DELETE CASCADE · `specialty` NOT NULL · `credentials` NOT NULL DEFAULT
`'PENDENTE'` · `is_active` NOT NULL **DEFAULT true**.
Index: `(is_active, credentials)`.

**`public_mechanics`** — denormalized, read-only projection; the only table an unauthenticated
caller may read.
`id` PK → `mechanics.id` CASCADE · `name` · `specialty` · `avatar_url` · `updated_at`.
Written **exclusively** by six triggers (migration `0002`). Never insert/update it from
application code. Never add columns (privacy rule `DATA-03`).

**`timeslots`**
`id` PK · `mechanic_id` → `mechanics.id` CASCADE · `date` · `start_time` · `end_time` ·
`is_available` DEFAULT true · `created_at`.
CHECK `end_time > start_time`. UNIQUE `(mechanic_id, date, start_time, end_time)`.
Index `(mechanic_id, date, is_available, start_time)`.

**`appointments`**
`id` PK · `client_id` → `profiles.id` CASCADE · `mechanic_id` → `mechanics.id` CASCADE ·
`timeslot_id` → `timeslots.id` **ON DELETE SET NULL** · `date` · `start_time` · `end_time` ·
`status` DEFAULT `'confirmado'` · `vehicle_info` · `notes` · `created_at`.
CHECKs: status ∈ 4 values; `end_time > start_time`; `vehicle_info` ≤ 120; `notes` ≤ 1000.
Indexes: `(client_id, date DESC)`, `(mechanic_id, date DESC)`, `(date DESC, status, mechanic_id)`.
**The anti-double-booking guard:**
```
UNIQUE INDEX appointments_one_active_per_timeslot ON (timeslot_id)
  WHERE status IN ('confirmado','nao_finalizado') AND timeslot_id IS NOT NULL
```
Partial, so a cancelled or finished booking frees the slot for rebooking. This index **is** the
database-level replacement for Postgres `SELECT … FOR UPDATE`. Never drop it.

**`appointment_service_reports`** — one per completed appointment.
`appointment_id` **PK** → `appointments.id` CASCADE (the PK is what makes double-completion
impossible) · `mechanic_id` → `mechanics.id` CASCADE · `summary` · `diagnosis` ·
`work_performed` · `parts_used` · `recommendations` · `total_amount_cents` · `closed_at` ·
`created_at` · `updated_at`.
CHECKs mirror the RPC validation exactly: `trim(summary)` 3–240; `diagnosis` ≤1000;
`trim(work_performed)` 3–2000; `parts_used` ≤1000; `recommendations` ≤1000;
`total_amount_cents ≥ 0`. Index `(mechanic_id, closed_at DESC)`.

**`appointment_service_items`** — line items.
`id` PK · `appointment_id` → `appointment_service_reports.appointment_id` CASCADE ·
`description` · `amount_cents` · `sort_order` · `created_at`.
CHECKs: `trim(description)` 2–160; `amount_cents ≥ 0`; `sort_order ≥ 0`.
Index `(appointment_id, sort_order)`.

**`admin_action_log`** — audit trail.
`id` PK · `actor_id` → `profiles.id` **SET NULL** · `target_mechanic_id` → `mechanics.id`
**SET NULL** · `action` CHECK ∈ (`create_mechanic`,`delete_mechanic`,`deactivate_mechanic`,
`reactivate_mechanic`) · `note` (≤500) ·
`before_state` TEXT DEFAULT `'{}'` · `after_state` TEXT DEFAULT `'{}'` · `created_at`.
`before_state`/`after_state` hold **JSON as text** (SQLite has no `jsonb`) — serialize/parse in
the application layer. Migration `0006` rebuilt this table to widen its `action` CHECK. This rebuild
is safe because `admin_action_log` is a child table with no incoming foreign keys, so dropping it
cannot cascade into other tables; §7.2's rebuild prohibition applies to parent tables.

**`notifications`** — shape closed at eight columns by D-P.
`id` PK · `recipient_id` → `profiles.id` CASCADE · `appointment_id` → `appointments.id` CASCADE ·
`type` · `title` · `body` · `read_at` (NULL = unread) · `created_at`.
Indexes `(recipient_id, created_at DESC)` and `(recipient_id, read_at)`.
Migration `0005` applied D-P by dropping `actor_id`, `data`, and `updated_at`; this shape is no
longer inferred or open. SQLite (3.53.x here) supports `ADD COLUMN`, `DROP COLUMN`, and `RENAME
COLUMN`, but cannot change a column's type or constraints or add a `CHECK` to an existing table.
For any parent table, a table-rebuild migration (create new → copy → drop → rename) is forbidden
without an out-of-transaction `PRAGMA foreign_keys = OFF`, which a Drizzle-migrator `.sql` file
cannot provide: `DROP TABLE` fires `ON DELETE CASCADE` on every referencing row; `PRAGMA
defer_foreign_keys` defers violation checking, not cascade actions, so it does not prevent those
deletions; and `PRAGMA foreign_key_check` afterwards reports clean precisely because the cascade
already removed the orphans it would have flagged.
TS `NotificationType` = `appointment_confirmed | appointment_canceled | appointment_completed |
system`.

**`token_blocklist`** — `jti` PK · `expires_at` INTEGER · `revoked_at` INTEGER. See UC-A4.

### 7.3 The `public_mechanics` sync triggers (migration `0002`)

Postgres had `private.refresh_public_mechanic(id)` called by 2 triggers. SQLite has no stored
functions and needs one trigger per event, so the body is **inlined into six triggers**:

| Table | Event | Watched columns |
|---|---|---|
| `profiles` | AFTER INSERT | — |
| `profiles` | AFTER UPDATE **OF `name`, `role`, `avatar_url`** | only these three |
| `profiles` | AFTER DELETE | — |
| `mechanics` | AFTER INSERT | — |
| `mechanics` | AFTER UPDATE **OF `specialty`, `is_active`** | only these two |
| `mechanics` | AFTER DELETE | — |

⚠️ The two `UPDATE OF` column lists are **narrow**. An update to any column outside them does not
resync the projection.

Every non-delete trigger body is **delete-then-filtered-insert**:

```sql
DELETE FROM public_mechanics WHERE id = NEW.id;
INSERT INTO public_mechanics (id, name, specialty, avatar_url, updated_at)
SELECT p.id, p.name, m.specialty, p.avatar_url, strftime('%Y-%m-%dT%H:%M:%fZ','now')
FROM profiles p JOIN mechanics m ON m.id = p.id
WHERE p.id = NEW.id AND p.role = 'mechanic' AND m.is_active = 1;
```

**Never replace this with an upsert.** The delete-first shape is what makes *withdrawal* work: if
the row stops qualifying (deactivated, role changed), the `INSERT … WHERE` matches nothing and the
stale public row is already gone.

#### 7.3.1 Procedure: changing `public_mechanics` or a column it projects

Every trigger body hard-codes the **five-column** `INSERT INTO public_mechanics (...) SELECT ...`.
The normal `db:generate` workflow (§9.6) will add a column and **leave all six triggers stale** —
producing either a column-count error at runtime or a silently outdated projection. If you touch
this table, follow these steps in order:

1. Edit `src/db/schema.ts`.
2. `npm run db:generate` — this produces the column change only.
3. **Handwrite a second migration** that `DROP TRIGGER`s all six and recreates them with the new
   column list. Separate statements with `--> statement-breakpoint`; copy the style of
   `0002_public_mechanics_triggers.sql`.
4. If the new field lives on `profiles`, **extend the `AFTER UPDATE OF (name, role, avatar_url)`
   column list** — otherwise edits to it never propagate. Same for `mechanics` and its
   `(specialty, is_active)` list.
5. Add a case to `tests/db/public-mechanics-sync.test.ts` covering both propagation **and**
   withdrawal.

**Mirror rule:** adding a *private* mechanic field (anything a client must not see) must **not**
touch `public_mechanics` at all — that table is the privacy boundary (`DATA-03`).

### 7.4 TypeScript domain types

`oficina/types/models.ts` and `mechanic/types/models.ts` are the client-side contract: `Role`,
`AppointmentStatus`, `NotificationType`, `User`, `Mechanic extends User`, `TimeSlot`,
`Appointment`, `ServiceItem`, `AppNotification`.

`admin/types/models.ts` is a **different, non-overlapping set** — not a superset. It defines
`Role`, `AppointmentStatus`, `User`, `AdminUser extends User`, `AdminFilters`,
`AdminDashboardSummary`, `AdminMechanicRow`, `AdminAppointmentRow`, `AdminServiceItem`,
`AdminFinancialReport`, `PaginatedResult<T>`, `AdminMechanicDetail`. It has **no**
`NotificationType`, `Mechanic`, `TimeSlot`, `Appointment`, `ServiceItem` or `AppNotification`.

**Naming boundary:** the database is `snake_case`; the apps are `camelCase`. Today each service
file maps manually (`mapSlot`, `mapAppointmentRow`, `mapNotificationRow`). **The new server should
emit `camelCase` JSON** so those mappers collapse to nothing. **Decided: camelCase (§10.3 D-A)** —
apply it consistently across all endpoints.

---

## 8. Business rules and invariants

**This section is normative.** It is the specification; the legacy SQL is merely its current
expression, and §6 (use cases), §10 (endpoints) and §13 (flows) all defer to it. Where any other
section appears to restate a rule, §8 wins — and when a rule changes, change it **here** first.

**§8 vs §10.3:** §10.3 *resolves* implementation choices that §8 deliberately leaves open (casing,
field names, error envelope). It never overrides a rule §8 states. If §8 reads as undecided on
something §10.3 decides, §10.3 wins — and the §8 sentence is a leftover worth deleting.

These are the rules the system must never violate.

### 8.1 Booking (`BOOK-01`)

1. Caller must be authenticated **and** have role `client` (verified from the DB, not the token).
2. `vehicleInfo` ≤ 120 chars; `notes` ≤ 1000 chars. Both are trimmed and empty→NULL.
3. The timeslot must exist → else `timeslot not found`.
4. The timeslot must be `is_available` → else `timeslot unavailable`.
5. The slot's `date + start_time`, interpreted in **America/Sao_Paulo**, must be in the future →
   else `timeslot expired`.
6. Insert the appointment (`status='confirmado'`, denormalizing the slot's date/times) **and** set
   `timeslots.is_available = false` **atomically**.
7. **Two concurrent bookings of the same slot must never both succeed.** Postgres used
   `SELECT … FOR UPDATE`; SQLite must use an **IMMEDIATE write transaction** plus the partial
   unique index (§7.2). The loser must receive a clear conflict response (map the SQLite
   constraint error to a 409 with a message the client's existing `unavailable` branch matches).

### 8.2 Cancellation (`BOOK-02` / `BOOK-03`)

| | Client cancel | Mechanic cancel | Admin deactivate-cancel |
|---|---|---|---|
| Who | the owning `client_id` | the assigned `mechanic_id` | an admin deactivating assigned mechanic |
| Allowed from | `confirmado` **only** | `confirmado` **or** `nao_finalizado` | `confirmado` **or** `nao_finalizado` |
| Already `cancelado` | silent no-op (success) | silent no-op (success) | ignored |
| Other statuses | error `cannot cancel appointment with status X` | same | untouched |
| Effect | `status='cancelado'` + free the timeslot (`is_available=true`) | identical | identical + client-only `appointment_canceled` notification |

The asymmetry is deliberate and observed in the legacy SQL — preserve it unless the user changes
it.

Reactivation is one-way: it restores `mechanics.is_active` and `public_mechanics` only. It never
un-cancels appointments or re-blocks timeslots.

### 8.3 Status lifecycle (`BOOK-05`)

```
            book                mechanic completes
  (none) ───────▶ confirmado ──────────────────────▶ acabado
                    │  │
     date < today   │  └──── client/mechanic cancel ──▶ cancelado
     (lazy sync)    ▼
              nao_finalizado ──── mechanic completes ─▶ acabado
                    │
                    └────────── mechanic cancel ──────▶ cancelado
```

- `confirmado → nao_finalizado` is **not** a scheduled job. It is a lazy bulk `UPDATE` executed by
  `sync_unfinalized_appointments()` **on every list read**, defined as:
  `status='confirmado' AND date < today(America/Sao_Paulo)`.
- `sync_acabado_appointments()` is just an alias that calls the same function — despite its name it
  does **not** transition anything to `acabado`. Only `complete_mechanic_appointment` sets
  `acabado`.
- Implement this as **`syncUnfinalized(db)`, called at the start of each appointment list/detail
  handler** (§10.3 D-F). Do **not** substitute a computed-on-read projection: the admin dashboard
  and financial report aggregate the *stored* `status` column, so a projection that leaves the
  column stale desyncs every admin report.

### 8.4 Completion (`BOOK-04`)

See UC-M4 for the full validation table. Invariants: exactly one report per appointment (enforced
by the PK); `total_amount_cents` is the **server-computed sum** of the items, never a
client-supplied total; `sort_order` preserves the submitted order; the whole thing is one
transaction; completing is irreversible through the API.

### 8.5 Time and timezone

- **All business-day logic is America/Sao_Paulo.** "Today", "expired", and the
  `confirmado→nao_finalizado` boundary are São Paulo dates.
- **All stored timestamps are UTC** (`closed_at`, `created_at`, …).
- `date`/`start_time`/`end_time` are naive local strings with no timezone attached.
- The clients already compute São Paulo parts via `Intl.DateTimeFormat('en-CA', { timeZone:
  'America/Sao_Paulo' })` (`timeslot-service.getSaoPauloDateTimeParts`). Reuse that exact
  technique server-side; do not rely on the host's local timezone.

### 8.6 Privacy

- Anonymous/broad reads go through `public_mechanics` only.
- Client-visible mechanic data: name, specialty, avatar, and phone **only in the context of their
  own appointment** (the legacy client resolves mechanic phone for appointments it owns).
- A mechanic sees the client's name and phone **only** for appointments assigned to them.
- Never return `password_hash`, and never echo it into a log.

---

## 9. Backend server (`server/`)

### 9.1 Stack

Node **≥24**, ESM (`"type": "module"`), TypeScript, `tsx` for dev/run, **Fastify 5**,
**better-sqlite3 13**, **Drizzle ORM 0.45** + `drizzle-kit`, **zod 4**, **jsonwebtoken 9**,
**argon2 0.45**, **dotenv** (imported at the top of `config/index.ts` — this is what loads
`server/.env` in local dev; it is a no-op when the host already set the vars), **vitest 4**.

Note: `better-sqlite3` and `argon2` are native addons. On Windows a failed `npm install` usually
means missing C++ build tools — see the Troubleshooting section of `server/README.md` (including
the ClangCL workaround).

### 9.2 Composition and boot sequence

`src/server.ts`:
```
createDb(config.DB_PATH)  →  runMigrations(db)  →  buildApp(db, connection)  →  listen(PORT, 0.0.0.0)
```
`buildApp(db, connection)` (in `src/app.ts`) registers route modules and returns the Fastify
instance. **Tests build the app through the exact same function** against their own throwaway DB —
there is no test-only code path. Add new route modules by calling them inside `buildApp`.

### 9.3 Configuration (`INFRA-01`)

`src/config/index.ts` is the **only** module permitted to read `process.env`. It parses with zod at
import time, so a bad config crashes at boot rather than at first request.

| Var | Required | Default | Notes |
|---|---|---|---|
| `DB_PATH` | yes | — | SQLite file path; parent dir auto-created. `:memory:` supported. |
| `PORT` | no | `3000` | |
| `JWT_SECRET` | yes | — | **≥ 32 chars**, else boot fails. |
| `JWT_EXPIRY_SECONDS` | no | `2592000` | 30 days. |

### 9.4 Database access

`createDb(path)` opens better-sqlite3, sets `journal_mode = WAL` and `foreign_keys = ON`, returns
`{ db, connection }`. `db` is Drizzle (query building); `connection` is the raw handle (used for
the `/health` probe and, when needed, transactions/pragmas).

better-sqlite3 is **synchronous**. Drizzle calls end in `.run()` / `.get()` / `.all()` — there is
no `await` on a query. Handlers are still declared `async` because Fastify wants a promise.

**Transactions (Phase 2 — read this before writing `POST /appointments`).**
There is currently **zero** use of `transaction` anywhere in `src/` — no precedent to copy. The
required shape:

```ts
// Drizzle exposes SQLite transaction behavior directly — no need for the raw handle:
db.transaction((tx) => {
  const slot = tx.select().from(timeslots).where(eq(timeslots.id, timeslotId)).get();
  if (!slot) throw NotFound('timeslot not found');
  if (!slot.isAvailable) throw Conflict('timeslot unavailable');
  // …expiry check against America/Sao_Paulo (§8.5)…
  tx.insert(appointments).values({ /* … */ }).run();   // partial unique index may throw here
  tx.update(timeslots).set({ isAvailable: false }).where(eq(timeslots.id, slot.id)).run();
}, { behavior: 'immediate' });   // ← acquires the write lock up front, not mid-statement
```

(`behavior` is declared in `drizzle-orm/sqlite-core/session.d.ts` and forwarded straight to
better-sqlite3's `.immediate()`. The raw `connection.transaction(fn).immediate()` form is
equivalent — use it only if you already need `connection` for something else.)

Two hard constraints:

1. **`behavior: 'immediate'` is what replaces `SELECT … FOR UPDATE`.** Omit it and SQLite starts
   the transaction deferred, upgrades to a write lock only at the first write, and two racers can
   both pass the availability read — the exact bug §8.1.7 forbids.
2. **No `await` inside a better-sqlite3 transaction.** The callback is synchronous; any async work
   (argon2 hashing, for example) must happen **before** the transaction opens.
3. **Only the outermost transaction can set `behavior`.** The nested overload
   (`BetterSQLiteTransaction.transaction<T>(fn)`) takes no config, so a nested call is always
   deferred. If a handler composes transactional helpers, the `immediate` must be requested at the
   top level.

Catch the SQLite unique-constraint error from the partial index and map it to the same 409 as the
explicit availability check, so the client's `unavailable` branch (§13.2) fires either way.

**The error classes above do not exist yet — create them with the first Phase 2 endpoint.** There
is no `src/errors.ts` and no `setErrorHandler` in `buildApp` today, so without this every endpoint
author invents a different mechanism and §10.3 D-C's envelope guarantee quietly fails:

```ts
// src/errors.ts
export class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export const NotFound = (m: string) => new HttpError(404, m);
export const Conflict = (m: string) => new HttpError(409, m);

// in buildApp — the catch-all, so an unmapped throw still returns the house envelope
app.setErrorHandler((err, _req, reply) => {
  if (err instanceof HttpError) return reply.code(err.status).send({ error: err.message });
  // Preserve Fastify's own 4xx (malformed JSON 400, 404, a future rate-limit 429) — without this
  // branch they would all be flattened to 500.
  if (err.statusCode && err.statusCode < 500) {
    return reply.code(err.statusCode).send({ error: err.message.toLowerCase() });
  }
  return reply.code(500).send({ error: 'internal error' });
});
```

Throwing **inside** the transaction is safe and intended: better-sqlite3 rolls the transaction back
on any throw. That is precisely why the skeleton can validate mid-transaction.

### 9.5 Auth internals

- **Hashing:** `argon2id` with library defaults (`auth/hash.ts`). Never hand-roll comparison.
- **Tokens:** HS256, payload `{ sub, role, jti, exp }`. `verifyAccessToken` pins
  `algorithms: ['HS256']` — always go through this wrapper, never call `jwt.verify` directly, or
  an `alg: none` token can slip in.
- **Middleware:** `requireAuth(db)` returns a Fastify `preHandler`. Order is fixed: parse
  `Authorization: Bearer …` → verify signature → check `token_blocklist` → attach
  `request.user`. Every rejection returns the **same** generic `401 { error: 'unauthorized' }`.
- **Role authorization (`AUTH-04`) — DOES NOT EXIST YET.** `requireAuth` attaches
  `request.user` straight from the token payload, which *includes* a `role` claim. Reading
  `request.user.role` is therefore the obvious implementation and **the one §5 forbids**. Phase 2
  must add a second guard to `src/auth/middleware.ts`:

  ```ts
  export function requireRole(db: Db, roles: readonly Role[]) {
    return async function authorize(request: FastifyRequest, reply: FastifyReply) {
      const row = db.select().from(profiles).where(eq(profiles.id, request.user!.sub)).get();
      if (!row || !roles.includes(row.role)) return reply.code(403).send({ error: 'forbidden' });
    };
  }
  ```

  Compose it after `requireAuth`, never instead of it:
  `{ preHandler: [authenticate, requireRole(db, ['client'])] }`. The role comes from the **DB row**,
  so a stale token cannot outlive a role change. Use `403 { error: 'forbidden' }` for
  authenticated-but-wrong-role, and keep `401 { error: 'unauthorized' }` for unauthenticated.
- **Revocation:** `auth/blocklist.ts` — `revokeToken` (idempotent via `onConflictDoNothing`),
  `isTokenRevoked`, and `pruneExpiredRevocations(db, nowSeconds)` which deletes **only** rows whose
  `expires_at` has already passed. Never make pruning age- or count-based; that would silently
  resurrect still-valid tokens. Pruning is not scheduled anywhere yet, and correctness does not
  depend on it running.

### 9.6 Migrations

`src/db/migrations/` — `0000` initial, `0001`, `0002` (handwritten: the six triggers), `0003`
(`token_blocklist`), plus `meta/` snapshots and `_journal.json`.

Workflow: edit `src/db/schema.ts` → `npm run db:generate` (drizzle-kit writes a new SQL file) →
review the SQL → `npm run db:migrate`. `runMigrations` is idempotent (Drizzle tracks applied
migrations in `__drizzle_migrations`) and also runs automatically at server boot.
Handwritten migrations (triggers, data backfills) are legitimate — separate statements with
`--> statement-breakpoint`, as `0002` does.

### 9.7 Code conventions observed in `server/`

- Route modules are plain functions wired inside `buildApp`. **The signature is not uniform:**
  `authRoutes(app, db)` takes the Drizzle handle, `healthRoutes(app, connection)` takes the raw
  handle (it needs `SELECT 1`). Follow `authRoutes(app, db)` for new routes — write transactions do
  **not** require the raw handle (§9.4), so `buildApp`'s signature does not need widening.
- Validation with zod schemas at the top of the route file; unknown keys are **stripped**, which is
  the mechanism that blocks role injection.
- Error responses are lowercase strings: `{ error: 'invalid request body' }`. Auth failures are
  deliberately indistinguishable from each other.
- **Comments are prohibited by default.** Write one only when the *why* is genuinely non-obvious
  from the code itself — a hidden constraint, a subtle invariant, a workaround for a specific bug —
  and keep it to one line. Never comment *what* the code does; well-named identifiers already say
  that. Design rationale, decision history (`D-0x`) and citations back to the legacy SQL belong in
  `PROJECT_CONTEXT.md` / `docs/`, not inline — documentation lives in docs, not in comments.

---

## 10. API surface: existing + to-build

### 10.1 Implemented today

| Method | Path | Auth | Body | Success | Errors |
|---|---|---|---|---|---|
| GET | `/health` | none | — | `200 {status:'ok',db:'ok'}` | — |
| POST | `/auth/signup` | none | `{name(1–120), email, password(8–200)}` | `201 {token, user: ProfileUser}`; role forced to `client` | 400 `VALIDATION_FAILED` · 409 `EMAIL_TAKEN` |
| POST | `/auth/login` | none | `{email, password}` | `200 {token, user: ProfileUser}` | 400 `VALIDATION_FAILED` · 401 `INVALID_CREDENTIALS` |
| GET | `/auth/me` | Bearer | — | `200 ProfileUser` | 401 `UNAUTHENTICATED` |
| POST | `/auth/logout` | Bearer | — | `204` | 401 `UNAUTHENTICATED` |
| POST | `/admin/mechanics` | admin Bearer | `{name, phone, email, password(8–200), specialty, credentials}`; `isActive` ignored and forced `true` | `201 AdminMechanicRow`; profile + mechanic commit atomically | 400 `VALIDATION_FAILED` · 401 `UNAUTHENTICATED` · 403 `FORBIDDEN` · 409 `EMAIL_TAKEN` · 503 `DATABASE_BUSY` |
| GET | `/admin/dashboard` | admin Bearer | query `from?: YYYY-MM-DD, to?: YYYY-MM-DD` | `200 AdminDashboardSummary`; defaults to current São Paulo month through today | 400 `VALIDATION_FAILED`/`INVALID_DATE_RANGE` · 401 `UNAUTHENTICATED` · 403 `FORBIDDEN` |
| GET | `/admin/mechanics` | admin Bearer | query `search?, page?, pageSize?`; page size capped at 100 | `200 PaginatedResult<AdminMechanicRow>`; ordered by name then id | 400 `VALIDATION_FAILED` · 401 `UNAUTHENTICATED` · 403 `FORBIDDEN` |
| GET | `/admin/mechanics/:id` | admin Bearer | query `from?: YYYY-MM-DD, to?: YYYY-MM-DD` | `200 AdminMechanicDetail`; defaults to current São Paulo month through today | 400 `VALIDATION_FAILED`/`INVALID_DATE_RANGE` · 401 `UNAUTHENTICATED` · 403 `FORBIDDEN` · 404 `MECHANIC_NOT_FOUND` |
| GET | `/admin/appointments` | admin Bearer | query `from?, to?, status?, mechanicId?, search?, page?, pageSize?`; page size capped at 100 | `200 PaginatedResult<AdminAppointmentRow>`; ordered by date, start time, then id descending | 400 `VALIDATION_FAILED`/`INVALID_DATE_RANGE` · 401 `UNAUTHENTICATED` · 403 `FORBIDDEN` |
| GET | `/admin/finance` | admin Bearer | query `from?, to?, mechanicId?, search?` | `200 AdminFinancialReport`; closed report revenue over requested range | 400 `VALIDATION_FAILED`/`INVALID_DATE_RANGE` · 401 `UNAUTHENTICATED` · 403 `FORBIDDEN` |
| GET | `/mechanics` | Bearer | — | `200 PublicMechanic[]` ordered by name | 401 `UNAUTHENTICATED` |
| GET | `/mechanics/:id` | Bearer | — | `200 PublicMechanic` | 401 `UNAUTHENTICATED` · 404 `MECHANIC_NOT_FOUND` |
| GET | `/mechanics/:id/timeslots` | Bearer | query `date?: YYYY-MM-DD, includeUnavailable?: 'true'` | `200 TimeSlot[]`; default is available, unbooked, active-mechanic future slots and a seven-day window without `date`; owner + `includeUnavailable=true` requires `date` and returns that whole day with `hasActiveAppointment`; parameter is ignored for non-owners | 400 `VALIDATION_FAILED` · 401 `UNAUTHENTICATED` · 404 `MECHANIC_NOT_FOUND` |
| POST | `/timeslots` | mechanic Bearer | strict slot or non-empty slot array: `{date, startTime, endTime}`; one date per batch | `201 TimeSlot[]`; atomic batch | 400 `VALIDATION_FAILED` · 401 `UNAUTHENTICATED` · 403 `FORBIDDEN` · 409 `TIMESLOT_EXPIRED`/`TIMESLOT_OVERLAP` · 503 `DATABASE_BUSY` |
| PATCH | `/timeslots/:id` | mechanic Bearer | strict `{isAvailable}` | `200 TimeSlot`; owner only | 400 `VALIDATION_FAILED` · 401 `UNAUTHENTICATED` · 404 `TIMESLOT_NOT_FOUND` · 409 `TIMESLOT_HAS_APPOINTMENT` · 503 `DATABASE_BUSY` |
| DELETE | `/timeslots/:id` | mechanic Bearer | — | `204`; owner only; finished appointments do not block deletion | 401 `UNAUTHENTICATED` · 404 `TIMESLOT_NOT_FOUND` · 409 `TIMESLOT_HAS_APPOINTMENT` · 503 `DATABASE_BUSY` |
| PATCH | `/profiles/me` | Bearer | strict `{name(1–120), specialty?(1+)}`; `specialty` mechanic-only | `200 ProfileUser` | 400 `VALIDATION_FAILED` · 401 `UNAUTHENTICATED` |
| GET | `/notifications` | Bearer | — | `200 Notification[]`; newest first, limit 50 | 401 `UNAUTHENTICATED` |
| GET | `/notifications/unread-count` | Bearer | — | `200 {count}` | 401 `UNAUTHENTICATED` |
| POST | `/notifications/:id/read` | Bearer | — | `204`; idempotent | 401 `UNAUTHENTICATED` · 404 `NOTIFICATION_NOT_FOUND` |
| POST | `/notifications/read-all` | Bearer | — | `204`; idempotent | 401 `UNAUTHENTICATED` |
| POST | `/appointments` | client Bearer | strict `{timeslotId, vehicleInfo? (≤120), notes? (≤1000)}` | `201 Appointment` | 400 `VALIDATION_FAILED` · 401 `UNAUTHENTICATED` · 403 `FORBIDDEN` · 404 `TIMESLOT_NOT_FOUND` · 409 `MECHANIC_UNAVAILABLE`/`TIMESLOT_UNAVAILABLE`/`TIMESLOT_EXPIRED` · 503 `DATABASE_BUSY` |
| GET | `/appointments` | Bearer | — | `200 Appointment[]` scoped to owning client or assigned mechanic; viewer-aware contact fields; newest appointment date/time first | 401 `UNAUTHENTICATED` · 501 `NOT_IMPLEMENTED` for admin |
| GET | `/appointments/:id` | Bearer | — | `200 Appointment` for owning client or assigned mechanic, including report and ordered `serviceItems` | 401 `UNAUTHENTICATED` · 404 `APPOINTMENT_NOT_FOUND` |
| POST | `/appointments/:id/cancel` | Bearer | — | `200 Appointment`; client or assigned-mechanic branch; idempotent when already cancelled; frees its timeslot | 401 `UNAUTHENTICATED` · 404 `APPOINTMENT_NOT_FOUND` · 409 `APPOINTMENT_NOT_CANCELLABLE` · 503 `DATABASE_BUSY` |
| POST | `/appointments/:id/complete` | mechanic Bearer | strict `{summary, diagnosis?, workPerformed, partsUsed?, recommendations?, items[1..30]}` | `200 Appointment`; assigned mechanic only; report, ordered items, status, close time, timeslot state and notification commit atomically | 400 `VALIDATION_FAILED` · 401 `UNAUTHENTICATED` · 404 `APPOINTMENT_NOT_FOUND` · 409 `APPOINTMENT_ALREADY_COMPLETED`/`APPOINTMENT_NOT_COMPLETABLE` · 503 `DATABASE_BUSY` |

`ProfileUser` = `{id, name, email, role, phone, avatarUrl, specialty}`. This is the exact seven-field shared shape returned
by signup, login, `/auth/me`, and `/profiles/me`; `createdAt` is not serialized.
`PublicMechanic` = `{id, name, specialty, avatarUrl, updatedAt}`.
`TimeSlot` = `{id, mechanicId, date, startTime, endTime, isAvailable}`.
`Notification` = `{id, recipientId, appointmentId, type, title, body, readAt, createdAt}`.
`Appointment` = `{id, clientId, mechanicId, timeslotId, date, startTime, endTime, status,
vehicleInfo, notes, createdAt, mechanicName, mechanicPhone, serviceSummary, serviceDiagnosis,
workPerformed, partsUsed, recommendations, totalAmountCents, closedAt, serviceItems}`; contact fields
are viewer-aware and completed appointments serialize line items in `sortOrder` order.

**Standard error envelope:** application failures return
`{ error: '<lowercase message>', code: '<machine-readable code>' }`; Fastify-generated 4xx errors
retain `{ error }`, unknown routes return `404 { error: 'not found' }`, and unhandled failures return
`500 { error: 'internal error', code: 'INTERNAL_ERROR' }`. Auth failures remain deliberately
indistinguishable where §9.5 requires it.

Client error messages, transcribed from `oficina/services/error-messages.ts`:

| Code | Brazilian Portuguese string |
|---|---|
| `VALIDATION_FAILED` | Verifique os dados informados e tente novamente. |
| `UNAUTHENTICATED` | Sua sessão expirou. Entre novamente. |
| `INVALID_CREDENTIALS` | E-mail ou senha inválidos. |
| `FORBIDDEN` | Você não tem permissão para esta ação. |
| `MECHANIC_NOT_FOUND` | Mecânico não encontrado. |
| `TIMESLOT_NOT_FOUND` | Horário não encontrado. |
| `APPOINTMENT_NOT_FOUND` | Agendamento não encontrado. |
| `NOTIFICATION_NOT_FOUND` | Notificação não encontrada. |
| `EMAIL_TAKEN` | Este e-mail já está cadastrado. |
| `TIMESLOT_UNAVAILABLE` | Horário indisponível. Escolha outro. |
| `TIMESLOT_EXPIRED` | Este horário já passou. Escolha outro. |
| `TIMESLOT_OVERLAP` | Este horário se sobrepõe a outro já cadastrado. |
| `TIMESLOT_HAS_APPOINTMENT` | Este horário possui um agendamento e não pode ser alterado. |
| `MECHANIC_UNAVAILABLE` | Este mecânico não está disponível no momento. |
| `APPOINTMENT_NOT_CANCELLABLE` | Este agendamento não pode mais ser cancelado. |
| `APPOINTMENT_ALREADY_COMPLETED` | Este agendamento já foi concluído. |
| `APPOINTMENT_NOT_COMPLETABLE` | Este agendamento não pode ser concluído. |
| `NOT_IMPLEMENTED` | Recurso indisponível nesta versão. |
| `DATABASE_BUSY` | Servidor ocupado. Tente novamente. |
| `INTERNAL_ERROR` | Algo deu errado. Tente novamente. |
| `NETWORK_UNAVAILABLE` | Não foi possível conectar ao servidor. Verifique sua conexão e tente novamente. |
| `REQUEST_TIMEOUT` | A solicitação demorou demais. Tente novamente. |

### 10.2 To build — proposed contracts

Phases 2 and 2b are implemented and listed in §10.1. Remaining contracts below are Phase 3
proposals; apply §10.3 defaults and record any decision rather than inventing an alternative.

**Phase 3 — admin**

`DELETE /admin/mechanics` (bulk body) · `GET /admin/dashboard` · `GET /admin/mechanics` ·
`GET /admin/mechanics/:id` · `GET /admin/appointments` ·
`GET /admin/appointments/:id` · `GET /admin/finance` — all behind `requireAuth` + an admin guard,
all accepting the `AdminFilters` query params, all returning the JSON shapes already declared in
`admin/types/models.ts` (§6.4). **Match those TypeScript interfaces exactly** — they are the
cheapest available contract test.

`GET /admin/appointments/:id` / **UC-AD5 is not ported**: no UI consumes it and
`admin-service.ts` has no function for it.

**Phase 4 — notifications**

`GET /notifications` · `GET /notifications/unread-count` · `POST /notifications/:id/read` ·
`POST /notifications/read-all`, plus fan-out writes inside the book/cancel/complete handlers.

### 10.3 Open decisions — apply these defaults

These choices affect every endpoint. They are **not yet ratified**, but an agent working without a
user available must not invent its own answer. **Apply the default below, then record it as a
`D-xx` row in the §10.3 decision table in this file, so the next agent inherits it.** Only the user
may override.

| # | Decision | Default to apply | Rationale |
|---|---|---|---|
| D-A | JSON casing | **camelCase** on the wire | Kills every `map*Row` helper in the apps (§16 step 4); matches `types/models.ts` |
| D-B | `POST /admin/mechanics` field names | **English** (`name, phone, email, password, specialty, credentials`) | Server-wide consistency; `admin-service.createMechanic` is one small edit |
| D-C | Error envelope | `{ error: '<lowercase message>' }`, already the house style | Matches §10.1; keeps the client substring matching in §13.2 working |
| D-D | Path versioning | **No `/v1`** | Single known consumer set; add versioning when there is an external client |
| D-E | Password minimum | **8** (the server's `SignupSchema`), not the edge function's 6 | Never lower an existing floor |
| D-F | Status auto-transition | A **`syncUnfinalized(db)` helper called at the top of each list/detail handler** | Mirrors legacy behavior exactly; a computed projection would desync the stored `status` that admin reports aggregate. ⚠️ This makes `GET /appointments` a **write path** — it cannot use a read-only connection, and it must run *before* any read transaction opens, not inside one |
| D-G | CORS | `@fastify/cors` registered **inside `buildApp`** | Registering in `server.ts` would leave tests unable to exercise it (§14.4) |
| D-H | Login rate limiting | Defer, but leave a `TODO` at the route | Out of Phase 2 scope; recorded so it is not forgotten (§17.4) |
| D-I | Who may write `mechanics.credentials` / `is_active` | **Admin only** | Post-approval-removal the guard trigger treated these as admin-owned (UC-M5); no shipped mechanic path writes them today |
| **D-J** | Timeslot **overlap** enforcement | **Enforced server-side** in `POST /timeslots`, inside the write transaction | ⚠️ **New behavior, not a port.** Legacy validates overlap only in the mechanic UI (§17.2); the DB's unique index catches exact duplicates but permits 09:00–10:00 alongside 09:30–10:30, which double-books a physical hour — the exact failure class the concurrency design (§8.1.7) exists to prevent. Ratified 2026-08-11 |
| **D-K** | `notifications` table shape and phasing | **The built client UI is the specification.** Read `notifications.tsx` / `notification-service.ts` / `notification-store.ts` in `oficina` and `mechanic`, reshape the table to match, and land fan-out inside the Phase 2 book/cancel/complete transactions | The notification UI **already exists** in both apps (committed 2026-08-11) — it is a more reliable statement of intent than the reverse-engineered mapper §17.1 was inferred from. Nothing is in production, so reshaping is a free `DROP`/recreate, not the table-rebuild dance §7.2 warns about. Deferring fan-out to a separate phase means reopening all three handlers later. **Phase 4 is therefore dissolved into Phases 2–3** |
| **D-L** | Framing | **This is a rebuild, not a migration** | Confirmed 2026-08-11: no production data, no live users, project not yet in production. There is no cutover, no dual-run and no rollback to Supabase. Calling it a migration invites planning a cutover that cannot exist. "Migration" in this repo means a Drizzle SQL migration file and nothing else |
| **D-M** | The four legacy Playwright suites | **Dead. Deleted, not repointed.** Replaced by one fresh spec at the monorepo root, grown per phase | Decided 2026-08-11. They are Supabase-bound and assert against screens that are being rewired. ⚠️ Consequence: `mechanic/tests/e2e/availability.spec.ts` was the only automated guard on the 756-line availability screen (UC-M2) — that screen is now unguarded until the new suite reaches it |
| **D-N** | Error envelope gains a machine-readable code | **Additive `code` field: `{ error: '<lowercase message>', code: 'TIMESLOT_UNAVAILABLE' }`.** Screens branch on `code`; the message stays verbatim for display | Ratified 2026-08-12. **Amends D-C additively — D-C's envelope and the Phase 1.5 verbatim-message rule both survive intact.** Today `browse/[mechanicId].tsx` branches by substring-matching the message (`unavailable`, `expired`, `too long`), so a copy edit, a lowercasing or a translation on the server silently breaks a client branch with no compile error and no test failure. Booking has three failure branches HTTP status cannot separate (`unavailable` and `expired` are both 409). Introduced now, while there are three branches in one screen, rather than after the pattern is copy-pasted into `mechanic` and `admin` |
| **D-O** | `syncUnfinalized` write pressure | **Guard the bulk `UPDATE` behind a cheap `SELECT EXISTS(...)`;** issue the write only when a row actually needs transitioning | Ratified 2026-08-12. **Amends D-F; observable behavior is identical.** D-F makes `GET /appointments` a write path, and SQLite has a single writer — so every appointment-list read would take a write lock that can contend with an in-flight `BEGIN IMMEDIATE` booking. The transition is a once-per-day boundary, so on nearly every read the guard keeps it a pure read. D-F's own warning stands: it must run **before** any read transaction opens, never nested inside one. Scope: `GET /appointments` and `GET /appointments/:id` only — timeslot reads have no status to sync |
| **D-P** | `notifications` table shape | **Narrowed to `id, recipientId, appointmentId, type, title, body, readAt, createdAt`.** `actorId`, `data` and `updatedAt` are dropped | Ratified 2026-08-12. **Amends D-K by applying it.** D-K made the built UI the specification; reading it shows the UI consumes only `id`, `type`, `title`, `body`, `readAt` and `createdAt` (the screen renders a relative timestamp) — so the specification points at a *narrower* table than §7.2's reverse-engineered eleven columns, not a wider one. `appointmentId` is kept as the one unused column with an obvious near-term consumer (tapping a notification to open its appointment) and because it is the FK that makes a notification meaningful. Nothing is in production (D-L), so this is a free `DROP`/recreate, not the table-rebuild dance §7.2 warns about |
| **D-R** | Enforcing the `profiles.role` value set | **Two `BEFORE INSERT`/`BEFORE UPDATE OF role` triggers using `RAISE(ABORT)` — NOT the `CHECK` constraint §17.2 proposes.** | Ratified 2026-08-12. ⚠️ **§17.2's suggestion is dangerous and must not be followed.** SQLite cannot add a `CHECK` to an existing table, so it implies a create-copy-drop-rename rebuild. That rebuild was written out and **executed against a seeded database: it deleted every mechanic, timeslot, appointment and notification row while reporting success.** `DROP TABLE profiles` performs an implicit delete which fires `ON DELETE CASCADE` on `mechanics.id` and cascades transitively; `PRAGMA defer_foreign_keys` does **not** stop it (it defers violation *checking*, not cascade *actions*); and `PRAGMA foreign_key_check` then reports clean precisely because the cascade left no orphans. `PRAGMA foreign_keys = OFF` would work but must be set **before** `BEGIN`, which a Drizzle-migrator `.sql` file cannot do. Triggers need no rebuild, no trigger teardown, no index recreation, and never expose the cascade. Two consequences worth carrying forward: `ON DELETE CASCADE` fires on `DROP TABLE`, and a check that detects only *orphans* cannot detect an operation that removed the children as well |
| **D-Q** | Phase slicing | **Slice by app vertical, not by capability.** Each phase builds only the endpoints one app consumes, rewires that app, and ends with that app fully off Supabase | Ratified 2026-08-12; §4.2 re-cut accordingly. Carries Phase 1.5's thesis forward — no endpoint ships without a real client calling it in the same phase, which is the failure mode ("no client has ever called it") 1.5 was created to break. Accepted cost: the booking lifecycle is split across phases, so an appointment is bookable in Phase 2 but not completable until Phase 2b |
| **D-S** | Timeslot overlap semantics | **Intervals are half-open; unavailable slots still block; overlap is checked on creation only; batches contain one date; expiry is datetime-granular in São Paulo time.** | Ratified 2026-08-14. **Amends D-J by closing its unstated semantics.** Touching endpoints such as 09:00–10:00 and 10:00–11:00 are accepted; any genuine overlap with a free, blocked, or booked slot is rejected; a batch is atomic and cannot mix dates; and a slot earlier today is expired even though its calendar date is today. D-J's server-side transactional enforcement remains intact |
| **D-T** | Shared `AdminFilters` parsing and ordering | **Use `{ from, to, status, mechanicId, search, page, pageSize }`; default `from` to the first day of the current São Paulo month and `to` to today via `getSaoPauloDateTimeParts()`; default `page` to 1 and `pageSize` to 20, capped at 100; validate `mechanicId` as a non-empty trimmed string, not a UUID; escape `%`, `_`, and the escape character itself for future SQL `LIKE` search; append an explicit id tiebreak to every ordering.** | Search has no accent folding (diacritic-insensitive matching): better-sqlite3 ships no ICU collation, and this project will not build one for six fields. Total ordering prevents duplicate or skipped rows across paginated reads and makes every response array deterministic. |
| **D-U** | `syncUnfinalized` scope for admin reads | **Every future `/admin/*` read calls `syncUnfinalized(db)` before it queries, widening D-F/D-O from each appointment list/detail handler to every admin read.** | Inherits both conditions verbatim: D-O's cheap `SELECT EXISTS(...)` guard keeps the common-case read a pure read, and D-F's rule that the sweep runs before any read transaction opens (never nested inside one) stands unchanged. |
| **D-V** | Mechanic removal semantics | **Deactivate instead of delete; see [ADR 0001](docs/adr/0001-deactivate-instead-of-delete-mechanics.md).** | Extends D-I's admin-only write surface to its removal/restore operations rather than reopening who may write `mechanics.is_active`. Gives up legacy delete parity and true erasure to retain client service history and finished-job revenue. |

**Cross-cutting reminder:** §13.2's status codes (403/404/409) follow from these defaults and
should be treated as the intended contract, not as competing proposals.

---

## 11. Legacy Supabase surface being replaced

### 11.1 RPC → endpoint mapping

| Legacy RPC | Defined in | Replaced by |
|---|---|---|
| `book_client_appointment` | newest: `2026-05-16_fix_book_client_appointment_rpc.sql`; also defined in `2026-05-16_appointment_slot_status_fix.sql:69` | `POST /appointments` |
| `cancel_client_appointment` | newest: `mechanic/…/2026-05-16_rebuild_public_app_schema_from_scratch.sql:448` (oficina copy `:270`); earlier: `2026-05-16_appointment_slot_status_fix.sql:153`, `2026-05-15_cancel_client_appointment.sql` | `POST /appointments/:id/cancel` |
| `cancel_mechanic_appointment` | `…/2026-05-24_appointment_closure_finance.sql:152` | same endpoint, mechanic branch |
| `complete_mechanic_appointment` | `…/2026-05-24_appointment_closure_finance.sql:200` | `POST /appointments/:id/complete` |
| `sync_unfinalized_appointments` | `…:118` | internal function called on list/detail reads |
| `sync_acabado_appointments` | `…:141` (alias) | same |
| `admin_dashboard_summary` | `admin/…/2026-05-22_admin_operations.sql:117`, superseded at `…closure_finance.sql:348` and `…remove_mechanic_approval_flow.sql:57` | `GET /admin/dashboard` |
| `admin_list_mechanics` | `admin_operations.sql:216`, superseded `remove_mechanic_approval_flow.sql:157` | `GET /admin/mechanics` |
| `admin_get_mechanic_detail` | `admin_operations.sql:425` | `GET /admin/mechanics/:id` |
| `admin_list_appointments` | `admin_operations.sql:317`, superseded `closure_finance.sql:456` | `GET /admin/appointments` |
| `admin_get_appointment_detail` | `closure_finance.sql:591` | `GET /admin/appointments/:id` |
| `admin_financial_report` | `closure_finance.sql:649`, superseded `2026-05-24_finance_month_year_overview.sql:1` | `GET /admin/finance` |
| `admin_delete_mechanics` | `2026-05-24_admin_bulk_delete_mechanics.sql:24` | `DELETE /admin/mechanics` |
| `admin_create_mechanic` | `2026-05-25_admin_create_mechanic.sql:3` | `POST /admin/mechanics` |
| `admin_set_mechanic_approval` | `admin_operations.sql:544` | **removed feature — do not port** |
| `private.is_admin()` | `admin_operations.sql:5` | admin role guard middleware |
| `private.can_view_profile()` | newest: `mechanic/…/2026-05-20_fix_profile_mechanic_rls_security.sql:26` | explicit `WHERE` clauses per handler |
| `private.refresh_public_mechanic()` + 2 triggers | newest: `2026-05-20_fix_profile_mechanic_rls_security.sql:112-178` (behaviorally identical to `rebuild…sql:200-262`, adds `DROP TRIGGER IF EXISTS` guards + a backfill) | 6 SQLite triggers, migration `0002` ✅ done |

**⚠️ Read the newest definition, and date order is NOT enough to find it.** `CREATE OR REPLACE`
means the last definition wins, but **four different files share the date `2026-05-16`** and
several redefine the same functions. You must open them and compare contents.

Files that redefine RPCs and are easy to miss:

- **`2026-05-16_appointment_slot_status_fix.sql`** — redefines `book_client_appointment` (`:69`),
  `cancel_client_appointment` (`:153`), `cancel_mechanic_appointment` (`:201`) and
  `sync_acabado_appointments` (`:249`).
- **`2026-05-16_rebuild_public_app_schema_from_scratch.sql`** — also defines
  `cancel_client_appointment` (`:448` in the mechanic copy).
- **`2026-05-20_fix_profile_mechanic_rls_security.sql`** — supersedes the RLS helpers and the
  `public_mechanics` refresh routine.
- **`admin/scripts/sql/2026-05-22_admin_policy_consolidation.sql`** — policy consolidation only.

**Procedure before porting any RPC:** `grep -rn "FUNCTION public.<name>" */scripts/sql/`, open
**every** hit, and port the one that is chronologically and textually last.

### 11.2 Edge functions → endpoints

`supabase/functions/admin-create-mechanic/index.ts` → `POST /admin/mechanics` (UC-AD8).
`supabase/functions/admin-delete-mechanics/index.ts` → `DELETE /admin/mechanics` (UC-AD9).
Both are Deno + service-role key, both re-check the caller's admin role by reading `profiles`.
Both become ordinary authenticated routes with a transaction instead of manual rollback.

### 11.3 Where the legacy SQL lives (and a trap)

`oficina/scripts/sql/` and `mechanic/scripts/sql/` are **near-duplicates but NOT identical**.
`server/.planning/PROJECT.md` claims they are byte-identical; verified today, they are not — e.g.
in `2026-05-16_rebuild_public_app_schema_from_scratch.sql` the `mechanic/` copy creates the
`private` schema, creates `public_mechanics`, defaults `credentials` to `'PENDENTE'`, defaults
`is_active` to **false**, and revokes broad grants, while the `oficina/` copy does none of that.
`mechanic/` additionally holds two files `oficina/` lacks
(`2026-05-20_fix_profile_mechanic_rls_security.sql`, `2026-05-24_appointment_closure_finance.sql`)
and `oficina/` holds one `mechanic/` lacks (`2026-05-23_allow_active_mechanic_browse.sql`).
**When porting behavior, treat `mechanic/scripts/sql/` as the fuller record and diff against
`oficina/` and `admin/` before concluding anything.**

---

## 12. Frontend architecture (the three Expo apps)

### 12.1 Shared stack

Expo SDK ~54, React 19.1, React Native 0.81, **expo-router 6** (file-based routing, typed routes,
React Compiler enabled), **zustand 5** for state, **zod 4** for validation, `react-hook-form`,
`date-fns` (+ `ptBR` locale), `@expo/vector-icons` (MaterialIcons) and `lucide-react-native`,
`react-native-reanimated`, `react-native-web` for the web target.

**Not shared — check per app:** `expo-secure-store` (**`oficina` and `mechanic`**);
`@react-native-community/datetimepicker` (**`mechanic` and `admin`**);
`@react-native-async-storage/async-storage` and `pg` (**`admin` only** — `pg` is a Node Postgres
driver in an Expo app, dead weight to remove during the rewire). `mechanic` removed
`@supabase/supabase-js`, AsyncStorage, and `react-native-url-polyfill` after its wire rewire.

Imports use the **`@/*` path alias** mapped to the app root (`tsconfig.json` `compilerOptions.paths`).
`@/services/...`, `@/components/...`, `@/constants/theme` are the normal forms — match them.

All three ship to **iOS, Android and web**; `admin` is effectively web-first (it has a desktop
sidebar layout at ≥900px). `dist/` folders hold committed static web exports; `oficina` has a
Netlify state file and a `vercel-build` script.

### 12.2 Layering

```
screen (app/**)  →  store (stores/*.ts, zustand)  →  service (services/*.ts)  →  backend
        ↑                                                    ↑
   hooks/use-auth, use-theme                    THE ONLY BACKEND BOUNDARY
```

**Hard rule (holds today):** screens never import a wire client directly; only service modules do.
**Soft convention (violated in places):** screens should go through a store rather than calling a
service directly. `oficina/app/(auth)/register.tsx` and `admin/app/(admin)/appointments.tsx` import
services directly; follow the store path in new code, but do not be surprised by the exceptions.

Stores hold `{ data, isLoading, error }` plus actions;
services do I/O and `snake_case → camelCase` mapping; screens render and show
`Alert.alert(...)` in PT-BR.

### 12.3 Session bootstrap (`app/_layout.tsx`)

`oficina` and `mechanic` load fonts, hold the splash screen until ready, read the JWT from
`expo-secure-store` on native (`localStorage` on web), call `GET /auth/me`, then set or clear the
user. Login/logout update the store directly; there is no auth-state subscription. `admin` still
uses its legacy Supabase bootstrap until Phase 3.

### 12.4 Route guards

Each role group's `_layout.tsx` renders `null` while `isBootstrappingSession` and
`<Redirect href="/(auth)/login" />` when unauthenticated. `app/index.tsx` is the entry redirect.
Detail routes are hidden from the tab bar with `options={{ href: null }}`.

Navigation: `oficina` and `mechanic` use a bottom tab bar (custom `BottomNavBar`); `admin` uses
`AdminShell` — a sidebar at ≥900px width, compact nav below that.

### 12.5 Auth store (representative of all stores)

`stores/auth-store.ts` in `oficina` and `mechanic` exposes `user, isAuthenticated, isLoading,
isBootstrappingSession, isAuthActionLoading, role, error` and `loginByEmail, logout, updateProfile,
setUser, setBootstrappingSession`. `isLoading` is derived (`bootstrapping || actionLoading`). `logout()`
**clears local state first, then calls the backend**, and swallows backend errors — logout must
always succeed locally. `hooks/use-auth.ts` wraps the store and adds `isAdmin/isMechanic/isClient`.

### 12.6 Environment

`config/env.ts` reads `process.env.EXPO_PUBLIC_*` with **static dot-notation only** — Expo inlines
those at build time, so dynamic access silently yields `undefined`. `scripts/check-env.js` runs in
the build scripts to fail early on missing values.
`oficina` and `mechanic` each require one variable: **`EXPO_PUBLIC_API_URL`**. `mechanic` no longer
declares or checks either Supabase variable. `admin` still requires
`EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` until Phase 3.

---

## 13. End-to-end flows (how things actually connect)

### 13.1 Login (target architecture)

```
login.tsx
  └─ useAuthStore.loginByEmail(email, password)
       └─ auth-service.login()  →  POST /auth/login
                                     ├─ zod parse body
                                     ├─ SELECT profiles WHERE email = lower(trim(email))
                                     ├─ argon2.verify(row?.hash ?? DUMMY, password)   ← always runs
                                     ├─ 401 identical response if row missing OR bad password
                                     └─ 200 { token, user }   (role read from the DB row)
       └─ persist token (SecureStore native / localStorage web)
       └─ store.setUser(user) → isAuthenticated → group _layout stops redirecting
```

### 13.2 Booking (the concurrency-critical path)

```
browse/[mechanicId].tsx  handleBook()
  └─ appointment-store.book({ timeSlotId, vehicleInfo, notes })
       └─ appointment-service.createAppointment()  →  POST /appointments
            BEGIN IMMEDIATE
              ├─ caller role must be 'client'                      → 403
              ├─ SELECT timeslot                                   → 404 'timeslot not found'
              ├─ is_available?                                     → 409 'timeslot unavailable'
              ├─ date+start_time > now(America/Sao_Paulo)?         → 409 'timeslot expired'
              ├─ INSERT appointments (status 'confirmado')
              │     └─ partial unique index may raise → map to 409 'timeslot unavailable'
              ├─ UPDATE timeslots SET is_available = 0
              └─ (Phase 4) INSERT notification for the mechanic
            COMMIT
  ├─ success → router.replace('/(client)/booking-success')
  └─ failure → message match ('unavailable' / 'expired' / 'too long') → PT-BR Alert + force refetch
```

Because the error branches in `browse/[mechanicId].tsx` match on **substrings of the error
message**, the server's messages must keep those substrings (`unavailable`, `expired`, `too
long`) — or the screen must be updated in the same change.

### 13.3 Completion

```
mechanic appointment/[id].tsx → appointment-store.complete(input)
  → POST /appointments/:id/complete
      BEGIN
        validate summary/workPerformed/items (§8.4)
        assert caller is the assigned mechanic
        assert status ∈ {confirmado, nao_finalizado}
        assert no existing report
        INSERT appointment_service_reports (total = Σ items)
        INSERT appointment_service_items (sort_order 0..n-1)
        UPDATE appointments SET status = 'acabado'
        (Phase 4) INSERT notification for the client
      COMMIT
  → client's bookings list and admin's finance report both pick it up on next fetch
```

### 13.4 Cross-app visibility (no realtime)

A booking made in `oficina` becomes visible in `mechanic` and `admin` on their next fetch — screen
focus, pull-to-refresh, or manual reload. There is no push. `specs.client,md.txt` line 10 asks for
mobile push notifications; that is **not designed or built** and would be new work (Expo Push).

---

## 14. How to build and run everything

### 14.1 Prerequisites

Node ≥24 (server; `.nvmrc` present), npm, and for native addon builds on Windows the Visual Studio
"Desktop development with C++" workload. Expo CLI comes via `npx`/local deps.

### 14.2 Server

```bash
cd server
cp .env.example .env
# set a real JWT_SECRET (32+ chars):
#   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
npm install
npm run db:generate     # only after changing src/db/schema.ts
npm run db:migrate
npm run seed:admin -- "Admin Name" "admin@example.com" "a-strong-password"
npm run dev             # tsx watch src/server.ts
```

Smoke test:

```bash
curl http://localhost:3000/health
```

Scripts: `dev` (watch) · `start` · `build` (`tsc --noEmit`, type-check only — there is no bundling
step) · `test` · `test:quick` · `db:generate` · `db:migrate` · `seed:admin`.

### 14.3 Client apps (same for `oficina`, `mechanic`, `admin`)

```bash
cd oficina        # or mechanic / admin
cp .env.example .env      # fill EXPO_PUBLIC_* values
npm install
npm run start             # Expo dev server; then press w / a / i
```

Other scripts: `android` · `ios` · `web` · `build:web` (`node scripts/export-web.js` → `dist/`) ·
`vercel-build` (**all three apps**, each with a `vercel.json`) · `lint` (`expo lint`) ·
`env:check` · `hooks:setup`. `mechanic` deleted its three legacy Supabase seed scripts; use
`server`'s `npm run seed:dev`. `admin` still declares `seed`, `seed:mechanics:auth`, and
`seed:mechanics:data`, but those scripts are already broken because their files do not exist.

`oficina` and `mechanic` run end-to-end against the local server. `admin` still needs the dead
Supabase project, so its data paths remain blocked until Phase 3. Native visual and behavioral
verification remains deferred — do not claim a
UI fix is verified when it could not have been.

### 14.4 Recommended local topology after migration

Run the server on `:3000`, point every app's `EXPO_PUBLIC_API_URL` at it. On Android emulator use
`http://10.0.2.2:3000`; on a physical device use the host's LAN IP.

**CORS is configured inside `buildApp` per D-G**, so tests exercise the same origin allowlist as
the running server:

| Origin | Why |
|---|---|
| `http://localhost:8081`, `http://127.0.0.1:8081` | Expo web default dev port |
| `http://127.0.0.1:19007` | oficina, pinned by its Playwright config |
| `http://127.0.0.1:19006` | mechanic |
| `http://127.0.0.1:19008` | admin |
| the deployed web origins | once hosting is chosen |

`credentials: true` is **not** needed — the token travels in the `Authorization` header, not a
cookie.

### 14.5 CI, git conventions and secrets

Root `.github/workflows/ci.yml` runs gitleaks on every pull request and push to `master`, then uses
path filters for server build/tests and `oficina`/`mechanic` typecheck + lint jobs. App jobs pin
Node 24; server jobs use `server/.nvmrc`. ⚠️ Committing a real `.env` fails CI. Keep secrets out of
tracked files; `.env.example` only. Each app also installs a `.githooks/pre-commit` via
`npm run hooks:setup`.

---

## 15. Testing

### 15.1 Server (vitest) — the only current automated coverage of new code

```
server/tests/
  config.test.ts                   env schema branches
  db/schema.test.ts                constraints and indexes
  db/public-mechanics-sync.test.ts the six triggers, including withdrawal
  auth/blocklist.test.ts           revoke / isRevoked / prune semantics
  routes/auth.test.ts              signup, login, me, logout end-to-end
  helpers/db.ts                    throwaway SQLite file per test in the OS temp dir
```
Run: `npm test` (or `npm run test:quick`). Tests **never** touch `DB_PATH`. Every test builds the
real app via `buildApp`.

`tests/helpers/db.ts` exports **`makeTestDb()` → `{ db, connection, cleanup }`** — it creates a
fresh SQLite file under the OS temp dir and runs migrations against it. Standard skeleton:

```ts
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../../src/app.js';
import { makeTestDb } from '../helpers/db.js';

describe('POST /appointments', () => {
  let testDb: ReturnType<typeof makeTestDb>;
  let app: FastifyInstance;

  beforeEach(() => {
    testDb = makeTestDb();
    app = buildApp(testDb.db, testDb.connection);
  });
  afterEach(async () => { await app.close(); testDb.cleanup(); });

  // Illustrative — `token` and `timeslotId` come from steps 1–2, declare them in real code.
  it('books an available slot', async () => {
    // 1. get a client token: app.inject POST /auth/signup → res.json().token
    // 2. insert mechanic + timeslot fixtures DIRECTLY via testDb.db (see note below)
    const res = await app.inject({
      method: 'POST', url: '/appointments',
      headers: { authorization: `Bearer ${token}` },
      body: { timeslotId },
    });
    expect(res.statusCode).toBe(201);
  });
});
```

**Getting an authenticated caller:** sign up through the real route for a `client`; for `mechanic`
and `admin` there is no creation endpoint until Phase 3, so **insert the `profiles`/`mechanics`
rows directly with Drizzle** (or call `seedAdmin` for an admin, as `tests/routes/auth.test.ts`
already does) and mint a token with `signAccessToken`. A `tests/helpers/fixtures.ts` holding
`makeMechanic()` / `makeTimeslot()` / `makeClientToken()` is worth creating with the first Phase 2
test — every later test needs the same three.

**When you add an endpoint, add a route test in the same change.** Cover: happy path, each
validation failure, each authorization failure (unauthenticated → 401, wrong role → 403), and —
for booking — a **concurrency test proving only one of two racing bookings wins**.

### 15.2 End-to-end — the four legacy suites are DEAD (D-M)

> **All four suites below were deleted on 2026-08-11.** They are Supabase-bound and assert against
> screens being rewired. They are replaced by **one fresh spec at the monorepo root**, driving the
> real app against the local server, grown one phase at a time (starting with register / login /
> reload / logout in Phase 1.5).
>
> The table is kept as a record of what existed and what was given up. Two things were genuinely
> lost and should be re-earned as the new suite grows:
> - **`mechanic/…/availability.spec.ts`** — the only automated guard on the 756-line availability
>   screen (UC-M2), and the consumer of the `availability-slot-…` testIDs.
> - **`tests-e2e/workshop-journey`** — the only test that ever exercised all three apps together.
>
> What was *salvaged* is the harness pattern: PowerShell `webServer` commands and pinned ports
> (19007 `oficina` / 19006 `mechanic` / 19008 `admin`), which the new spec reuses. Note these
> commands are PowerShell-only and run on no other OS.

| ~~Suite~~ (deleted) | Config | Specs | Port |
|---|---|---|---|
| `tests-e2e/` | `tests-e2e/playwright.config.ts` | cross-app journeys: `workshop-journey`, `cancellations`, `admin-delete-recreate`, `debug` | boots **all three** apps: 19007 / 19006 / 19008 |
| `mechanic/tests/e2e/` | `mechanic/playwright.config.ts` | **`availability`**, `closure` | 19006 |
| `admin/tests/e2e/` | `admin/playwright.config.ts` | `add-mechanic`, `delete-all-mechanics`, `finance` | 19008 |
| `oficina/tests/e2e/` | `oficina/playwright.config.ts` | `status` (one spec only) | 19007 |

⚠️ **`mechanic/tests/e2e/availability.spec.ts` is the guard on the availability screen** — the most
complex screen in the project (UC-M2) and the source of the `availability-slot-…` testID cited
below. If you touch that screen, run *this* suite, not `tests-e2e/`.

```bash
cd tests-e2e && npm install && npx playwright install chromium && npm test
```

**Prerequisites and gotchas:**

- `npx playwright install chromium` is required once — it is in no README.
- `tests-e2e/playwright.config.ts` loads env from **`../oficina/.env`**, which must contain
  `SUPABASE_SERVICE_ROLE_KEY` in addition to the public vars.
- **All four** configs use **PowerShell-only** `webServer` commands
  (`powershell -NoProfile -Command …`) with **hard-coded ports**. No suite in this repo runs on
  macOS or Linux without rewriting those commands.
- `src/helpers/db.ts` builds a **service-role** Supabase client; `clearE2EData()` truncates in FK
  order (items → reports → appointments → timeslots → e2e auth users).
- ⚠️ Tests select on **`testID`s** — e.g. `availability-slot-<date>-<start>-<end>`, produced by
  `getSlotTestId()` in `mechanic/app/(mechanic)/availability.tsx` and consumed by
  `mechanic/tests/e2e/availability.spec.ts`. Changing screen markup can break e2e even when
  behavior is correct — see `DESIGN_GUIDE.md` §13 rule 6.
- ⚠️ **All four suites are bound to Supabase and will fail the moment the apps are rewired.**
  Repointing them is known, planned and unscheduled.

### 15.3 Client apps

No unit test setup. `expo lint` only. Each app has a `.githooks/pre-commit` installed by
`npm run hooks:setup`.
Root CI now runs `admin` typecheck and lint checks when `admin/**` changes.

---

## 16. Client rewiring plan (Supabase → server)

`oficina` and `mechanic` have completed this plan. Phase 3 applies it to `admin`; descriptions
below remain the checklist for that final consumer, with the shared-package debt in §17.4 folded
into the work.

Per app, the whole job is these files:

1. **`services/api.ts`** — replace `createClient(...)` with a small typed `fetch` wrapper:
   base URL from `env.EXPO_PUBLIC_API_URL`, `Authorization: Bearer <token>` from stored token,
   JSON encode/decode, throw an `Error` whose `message` carries the server's `error` string (the
   screens match on it), handle 401 by clearing the session.
   **Also delete the `AppState` auto-refresh listener that lives in this file** (all three apps) —
   there is no token refresh to drive.
2. **Token storage** — `localStorage` on web. `oficina` and `mechanic` use
   `utils/secure-storage.ts` with `expo-secure-store` on native. `admin` still uses unencrypted
   AsyncStorage; Phase 3 must move it to the shared secure-storage boundary.
3. **`services/auth-service.ts`** — `login` → `POST /auth/login`; `signUp` → `POST /auth/signup`
   (now returns a token, so the "signup then login" dance disappears); `logout` →
   `POST /auth/logout` + clear storage; `getCurrentSessionUser` → `GET /auth/me`.
   **Delete** `loginByPhone`, `signUpWithPhone`, `toE164BrPhone` when phone auth is formally
   dropped, and remove the phone fields from the login/register screens in the same change.
4. **`services/mechanic-service.ts` / `timeslot-service.ts` / `appointment-service.ts` /
   `notification-service.ts`** — swap each `.from(...)`/`.rpc(...)` for its endpoint. If the
   server emits camelCase, the `map*Row` helpers can be deleted; otherwise keep them.
5. **`app/_layout.tsx`** — remove the `onAuthStateChange` subscription (the `AppState` block is in
   `services/api.ts`, step 1); bootstrap the session with `GET /auth/me` (§12.3). Keep the
   `profileRequestId` stale-request guard.
6. **`config/env.ts` + `.env.example` + `scripts/check-env.js`** — swap the two Supabase vars for
   `EXPO_PUBLIC_API_URL`.
7. **`.github/workflows/ci.yml`** — add an `admin` path filter and an `admin-checks` job mirroring
   existing app jobs: Node 24, `npm ci`, typecheck and lint (§14.5).
8. **`package.json`** — drop `@supabase/supabase-js` once nothing imports it (and `pg` in `admin`).
   Rewrite or delete the `seed*` scripts (they use the service-role key).
9. **`admin/services/admin-service.ts`** — the RPC calls become `GET /admin/*`; keep the response
   TypeScript interfaces unchanged so the screens don't move.

**Order of operations:** server Phase 2 → `oficina` → server Phase 2b → `mechanic` are complete.
Next: Phase 3 server/admin work and shared-package extraction, then remaining end-to-end coverage.
Do not rewire an app before the endpoints it needs exist and are tested.

---

## 17. Known gaps, risks and open questions

### 17.1 Data

- **`notifications` shape is closed at eight columns by D-P (§10.3): `id, recipientId,
  appointmentId, type, title, body, readAt, createdAt`.** Migration `0005` dropped `actorId`, `data`,
  and `updatedAt`; the built UI was the specification under D-K, and this is no longer an open
  shape question. Any future constraint or type change that requires a table rebuild inherits the
  §7.2 prohibition for parent tables: without an out-of-transaction `PRAGMA foreign_keys = OFF`,
  which a Drizzle-migrator `.sql` file cannot provide, `DROP TABLE` fires `ON DELETE CASCADE` on
  every referencing row; `PRAGMA defer_foreign_keys` defers violation checking rather than cascade
  actions and does not prevent deletion; and `PRAGMA foreign_key_check` afterwards reports clean
  because the cascade already removed the orphans it would have flagged.
- **No production data migration.** The new DB starts empty. `server`'s idempotent `seed:dev`
  supplies three active mechanics, two clients, one admin, timeslots, appointments, and a completed
  service report for local development; `seed:admin` remains the production-style admin bootstrap.
- **Cascade deletes are wide.** Deleting a `profiles` row removes the mechanic, their timeslots,
  and every appointment (and, transitively, reports and items). Only the `admin_action_log`
  `before_state` snapshot survives.

### 17.2 Behavior parity

- `sync_acabado_appointments` is a misleading alias — it does not produce `acabado`. Do not "fix"
  it into something else without asking.
- Client cancel and mechanic cancel have **different** allowed source statuses (§8.2).
- ~~Timeslot **overlap** is validated only in the mechanic UI, never in the database.~~ ✅ Resolved
  by ticket 03's transactional server-side overlap enforcement and D-S's closed semantics.
- The `mechanics.credentials` write permission is ambiguous post-approval-removal (UC-M5).
- Password minimum length disagrees between the edge function (6) and the server (8) — **resolved
  by §10.3 D-E: use 8.**
- Legacy `admin_delete_mechanics` granted `DELETE` on `profiles`/`mechanics` to all authenticated
  users and relied on the function's own admin check — a pattern that must **not** be reproduced;
  the new server should gate deletion in the handler alone.
- **`profiles.role` is enforced by the two D-R `BEFORE INSERT` and `BEFORE UPDATE OF role` triggers
  using `RAISE(ABORT)`, not by a `CHECK` (§5, §7.2, §10.3).** A `CHECK` would require a
  create-copy-drop-rename rebuild of parent table `profiles`; that path is forbidden because the
  tested rebuild deleted every mechanic, timeslot, appointment, and notification row while
  reporting success. `DROP TABLE profiles` fires `ON DELETE CASCADE`; `PRAGMA defer_foreign_keys`
  does not defer cascade actions; `PRAGMA foreign_key_check` then sees no orphans because the child
  rows are already gone; and the required `PRAGMA foreign_keys = OFF` must run before `BEGIN`, which
  a Drizzle-migrator `.sql` file cannot provide.
- ~~`oficina` reads full `profiles` rows when browsing mechanics, exposing email/phone to the client
  app (UC-C1). The `public_mechanics` projection exists precisely to prevent this and is currently
  used only by the `mechanic` app.~~ ✅ Resolved by ticket 03's `PublicMechanic` projection and
  ticket 09's browse-screen rewire (`57c81f3`, `5bb8126`).
- `admin/package.json`'s `seed`, `seed:mechanics:auth` and `seed:mechanics:data` scripts point at
  files that do not exist in `admin/scripts/` — they are already broken.

### 17.3 Product backlog (`specs.client,md.txt`, PT-BR, all ⬜ unbuilt)

Phone confirmation via WhatsApp; WhatsApp/SMS verification codes (the file asks whether to
self-host such a service — note this conflicts with the decision to drop phone auth); go straight
into the app after signup (UC-A1, already the server's behavior); confirmation popup on booking;
cancellation frees the slot (already true); password recovery by phone code; **mobile push
notifications**; editable client profile; notifications page on web and mobile; deciding which
notification types matter to clients; WhatsApp booking confirmations.
There is also `supabase/docs/specs/easy-first-notifications.md` — read it before designing Phase 4.

### 17.4 Operational

- **No CORS configuration** on the Fastify server — the web builds are blocked until it is added.
  **Resolved by §10.3 D-G**; origins and placement in §14.4.
- **No rate limiting** on `/auth/login`.
- **No refresh tokens**: a 30-day JWT plus a revocation table. Acceptable per `D-03`/`D-04`, but a
  stolen token is valid until it is explicitly revoked or expires.
- **No logging**: `Fastify({ logger: false })`. Add structured logging deliberately, never logging
  password hashes or full tokens.
- **Hosting undecided** — keep the server free of platform-specific code.
- ~~Three separate git repos~~ **Resolved 2026-08-11 by the monorepo (§3)** — a cross-cutting change
  is now one commit. There is still no shared package, so types, wire clients, secure-storage
  adapters, error maps, theme constants, and notification services remain copy-pasted and have
  drifted. **Phase 3 must discharge this deferred debt with three consumers — `oficina`,
  `mechanic`, and `admin` — rather than the two consumers present when extraction was first
  deferred.**
- Each app repo carries `.agents/AGENT_RULES.md` (terse-response style rules, security rules,
  "confirm before touching >3 files"), `.Jules/` learning notes, and `.planning/codebase/`
  analysis docs. Those `codebase/` docs are still useful reference. `server/.planning/` is
  different: it is frozen GSD workflow state, deprecated 2026-08-11 (§4.2).

---

## 18. Conventions for agents working here

1. **Locate the boundary first.** Backend behavior → `server/src/`. App behavior → the specific
   app's `services/` (data) or `app/` (UI). Never make a screen call the network directly.
2. **The legacy SQL is the spec, not the target.** Read it to learn behavior; write the behavior in
   TypeScript under `server/src/`. Do not add SQL to `*/scripts/sql/`.
3. **Read the newest definition.** `CREATE OR REPLACE` means later files silently supersede earlier
   ones (§11.1).
4. **Preserve invariants** in §8 unless the user explicitly changes them. Especially: the partial
   unique index, the delete-then-insert trigger shape, server-computed money totals, and the
   verify-signature-before-DB-lookup order in `requireAuth`.
5. **Validate at the edge with zod**, strip unknown keys, and never trust a client-supplied `role`.
6. **Money in integer cents. Times as `'HH:mm'`. Dates as `'YYYY-MM-DD'`. Business day =
   America/Sao_Paulo. Storage = UTC.**
7. **Ship a test with every endpoint** (§15.1).
8. **Keep error message substrings stable** — client screens match on them (§13.2).
9. **User-facing strings are Brazilian Portuguese.** Code, comments, commits and identifiers are
   English.
10. **No comments unless the *why* is genuinely non-obvious** (§9.7) — never *what*, never
    documentation. Record decisions, rationale and `file:line` history in `PROJECT_CONTEXT.md` /
    `docs/`, not inline. That is the project's institutional memory, not the source files.
11. **Flag assumptions.** If something is inferred, say so here in the plan/decision docs — do not
    let it silently become fact.
12. **Cross-app changes are now one commit** (§3, monorepo). Still state up front which apps a
    change touches — the blast-radius rule in §18.1 applies to *files*, not repos.
13. **Design changes go through [`DESIGN_GUIDE.md`](DESIGN_GUIDE.md)** — change tokens, not
    hard-coded hexes.
14. **Screen markup changes can break e2e.** The Playwright suites select on `testID`s (§15.2).
    Preserve them, or update the specs in the same change.

### 18.1 Precedence over the per-repo `.agents/AGENT_RULES.md`

Each app repo carries `.agents/AGENT_RULES.md` with its own rules. Two of them conflict with this
document; resolve as follows:

| Rule in `AGENT_RULES.md` | Resolution |
|---|---|
| Two separate rules: "For any Supabase **task**: mandatory read all files under `.agents/skills/supabase/` recursively" and "For any request to **alter** Supabase resources: attempt execution via Supabase API first" | **Both superseded by §4.4.** Supabase is deprecated and the project is unreachable. Do not attempt Supabase API calls. Read the legacy SQL as specification only. |
| "**Blast Radius Control:** confirm before changing more than 3 files simultaneously" | The multi-file workflows *documented here* — §16's per-app rewire and `DESIGN_GUIDE.md` §13.2's three-repo token edit — are **pre-approved in shape**, because they are indivisible: a partial rewire leaves the app broken. Still announce the file list before starting. Anything **not** described in these two documents keeps the 3-file confirmation rule. |
| Terse "smart caveman" response style; security warnings exempt | Style preference for that repo's chat output. It does not apply to code, commits, PRs, or to these documents. |

`server/.claude/CLAUDE.md` **used to** require that changes inside `server/` start through a GSD
command. That requirement was removed on 2026-08-11 when GSD was deprecated — there is no workflow
gate on `server/` any more. If you find that instruction quoted anywhere else, it is stale.

---

## 19. Glossary (PT-BR ↔ EN)

| PT-BR | EN | Where it appears |
|---|---|---|
| oficina | workshop / garage | app name, brand |
| mecânico | mechanic | role, table |
| agendamento | **appointment** (noun) / **book** (verb) — see the rule below | `appointments` |
| horário | timeslot | `timeslots` |
| confirmado | confirmed | `AppointmentStatus` |
| nao_finalizado | not finalized (past date, not closed out) | `AppointmentStatus` |
| acabado | finished / closed | `AppointmentStatus` |
| cancelado | cancelled | `AppointmentStatus` |
| bloqueado | blocked — mechanic withheld the hour | `timeslots.is_available = false`; unavailable is the union of blocked + booked |
| reservado | booked — an appointment holds the hour | `timeslots.is_available = false`; unavailable is the union of blocked + booked |
| especialidade | specialty | `mechanics.specialty` |
| credenciais | credentials | `mechanics.credentials` (default `PENDENTE`) |
| PENDENTE | pending | default credentials value |
| Deactivated | a mechanic an admin has removed from service; not bookable, not in `public_mechanics`, all history retained, reversible | `mechanics.is_active = false` |
| celular | mobile phone | edge function payload |
| senha | password | edge function payload |
| nome | name | edge function payload |
| painel | dashboard | admin nav |
| relatórios | reports | admin nav |
| financeiro | finance | admin nav |
| reservas | bookings | client tab |
| explorar | browse | client tab |
| perfil | profile | tab |
| notificações | notifications | tab |
| disponibilidade | availability | mechanic screen |
| agenda | schedule / agenda | mechanic screen |

**⚠️ "appointment" vs "booking" — one concept, one noun.** *Agendamento* was previously glossed as
both, and the code uses both: an `appointments` table and `appointment-service.ts`, but
`appointment-store.book()` and a *reservas* tab labelled "bookings". The rule, ratified 2026-08-12:

- **"appointment" is the noun** — the record, the table, the type, the endpoint (`POST /appointments`).
- **"booking" is only the verb-form of creating one** — `book()`, "the booking flow", "booked".
- **Never use "booking" as a noun in new code.** No `Booking` type, no `bookings` array, no
  `getBookings()`. Rename existing occurrences opportunistically when the file is already being
  touched; do not open a file solely to rename.

This glossary is the project's **only** vocabulary source. Do not create a root `CONTEXT.md` — it
would split the language across two files and invite exactly the drift this rule exists to fix.

---

*Maintenance: update this document whenever a phase completes, an endpoint ships, a schema
migration lands, or a scope decision changes. If a section here contradicts the code, the code
wins — and the section is a bug worth fixing.*
