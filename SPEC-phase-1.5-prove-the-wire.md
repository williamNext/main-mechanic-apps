# Spec — Phase 1.5: Prove the Wire

> **Status:** ready. Three of four opening assumptions confirmed on 2026-08-11, the fourth reversed — see [Assumption status](#assumption-status). Only the hosting target remains open, and it does not block this phase.
> **Companion docs:** [`PROJECT_CONTEXT.md`](PROJECT_CONTEXT.md) (normative — §8 rules, §10.3 decisions incl. D-J…D-M, §16 rewire plan), [`DESIGN_GUIDE.md`](DESIGN_GUIDE.md) (visual only).
> **Scope:** `server/` and `oficina/`, plus root-level CI and e2e. One repository, one commit (§3 — monorepo since 2026-08-11).

---

## Problem Statement

Nobody can run this product.

All three Expo apps talk to a Supabase project that is documented as unreachable (`PROJECT_CONTEXT.md` §14.3, §17.1). Login fails. Every screen that loads data fails. The only things that still work are `expo start --web` rendering static screens, `expo lint`, and TypeScript checking. A developer cannot visually or behaviourally verify any change to any app, and has not been able to for some time.

Meanwhile the replacement backend (`server/`) has shipped Phase 1 — signup, login, me, logout, the full schema, the `public_mechanics` triggers — and **no client has ever called it**. Not once. The plan of record (§16) says finish server Phase 2 (booking, cancellation, completion, the concurrency-critical path) and *then* rewire `oficina`.

That ordering concentrates every unproven assumption into one late, large change. The following are all currently unvalidated, and under the §16 order they would all first execute together, on top of booking endpoints that are themselves new:

- that a plain `fetch` wrapper can replace `supabase-js` in `services/api.ts`
- that the JWT survives an app restart on web, iOS and Android
- that CORS lets an Expo web build talk to Fastify at all (§17.4 — it is not configured, so today the answer is *no*)
- that `EXPO_PUBLIC_API_URL` reaches the server from an Android emulator and a physical device (§14.4)
- that swapping the env vars does not break `eas-build-check` in CI (§14.5 — it will)
- that the session bootstrap in `app/_layout.tsx` works without `onAuthStateChange` (§12.3)

If any of those is wrong, the failure surfaces weeks from now, tangled with booking bugs, with no way to tell which layer is at fault.

## Solution

Insert a small phase between the completed Phase 1 and the not-yet-started Phase 2: **rewire `oficina`'s authentication path only, against the endpoints that already exist.**

After this phase, a developer runs `npm run dev` in `server/` and `npm run start` in `oficina/`, registers an account, logs in, sees their profile, force-quits the app, reopens it and is still logged in — on web and on a phone. Every other `oficina` service still points at the dead Supabase project and still fails, exactly as it does today; nothing regresses because nothing else currently works.

The value is not the login screen. It is that §16 steps 1, 2, 5, 6 and 7 — the genuinely risky, cross-cutting, hard-to-debug parts of the rewire — get proven end to end while the blast radius is one screen and the rollback is `git revert`. Phase 2 then lands on a wire that is known to carry traffic, and every subsequent service rewire in all three apps becomes a mechanical repeat of a pattern that demonstrably works.

It also converts the project from "no app can run" to "one app runs", which restores the ability to verify *any* frontend change — a capability §14.3 says is currently blocked entirely.

## User Stories

**Running the system at all**

1. As a developer, I want to start the server and the client app on my machine and have them talk to each other, so that I can verify a change instead of guessing.
2. As a developer, I want a single documented command sequence that brings up server + `oficina` together, so that returning to this project after a break does not require re-deriving the setup.
3. As a developer, I want the app to fail loudly and specifically when the server is unreachable, so that I can tell "server is down" apart from "my code is broken".
4. As a developer, I want to know the app is talking to my local server and not to Supabase, so that I am never confused about which backend produced a result.

**Registering and signing in**

5. As a visitor, I want to create an account with my name, email and password, so that I can use the app.
6. As a visitor, I want to be taken straight into the app after registering, so that I do not have to log in a second time (UC-A1; the token now comes back from signup).
7. As a visitor, I want a clear Brazilian-Portuguese message when my password is too short, so that I know what to fix.
8. As a visitor, I want a clear message when my email is already registered, so that I know to log in instead of signing up.
9. As a visitor, I want a clear message when my email is malformed, so that I can correct it before submitting.
10. As a returning client, I want to log in with my email and password, so that I can reach my bookings.
11. As a returning client, I want the same message whether my email is unknown or my password is wrong, so that the app does not reveal which accounts exist (UC-A2).
12. As a client, I want the login button to show it is working and to refuse double submission, so that I do not create duplicate requests on a slow connection.
13. As a client, I want to be told when a request times out rather than watching a spinner forever, so that I can retry deliberately.

**Staying signed in**

14. As a client, I want to still be signed in when I reopen the app the next day, so that I am not asked for my password constantly.
15. As a client on my phone, I want my session token stored in the device's encrypted storage, so that another app or someone with my unlocked phone cannot trivially read it.
16. As a client on the web, I want my session to survive a page reload, so that refreshing does not log me out.
17. As a client, I want the app to check my session against the server on every boot, so that a change to my profile or role takes effect immediately (§12.3, `GET /auth/me`).
18. As a client, I want to be returned to the login screen if my session is no longer valid, so that I am never stuck in a half-authenticated state.
19. As a client, I want the app to show nothing rather than flash the login screen while it checks my session, so that startup does not look broken.
20. As a client who logs in on a slow connection and navigates away, I want a stale profile response to be discarded, so that I never see another state overwrite my current one (the existing `profileRequestId` guard — preserve it).

**Signing out**

21. As a client, I want to log out and be returned to the login screen, so that I can hand my phone to someone else.
22. As a client, I want logout to work even if the server is unreachable, so that I am never trapped in a session I asked to end.
23. As a client, I want my stored token erased on logout, so that reopening the app does not silently restore my session.
24. As a security-conscious user, I want my token invalidated server-side on logout, so that a copy of it cannot be replayed (UC-A4, the blocklist).

**Web specifically**

25. As a developer, I want the Expo web build to reach the server without browser CORS errors, so that the web target is usable at all.
26. As a developer, I want CORS configured in one place that the tests also exercise, so that it cannot pass in tests and fail in the browser (§10.3 D-G).
27. As a developer running the Playwright suite, I want its pinned port to be an allowed origin, so that e2e is not blocked by CORS.

**Native specifically**

28. As a developer on an Android emulator, I want documented guidance that `localhost` must be `10.0.2.2`, so that I do not lose an afternoon to a connection refused.
29. As a developer on a physical device, I want documented guidance to use the host's LAN IP, so that testing on real hardware is possible.

**Errors and contracts**

30. As a client, I want every server error to appear as a readable Portuguese message, so that I am never shown a raw JSON body or a stack trace.
31. As a developer, I want every server failure to use the same `{ error: '<lowercase message>' }` envelope, so that the client has exactly one shape to parse (§10.3 D-C).
32. As a developer, I want an unhandled server exception to return that same envelope rather than Fastify's default 500 body, so that the client's error path is uniform.
33. As a developer, I want Fastify's own 4xx responses (malformed JSON, unknown route) preserved rather than flattened to 500, so that debugging stays honest.
34. As a developer, I want the server to emit camelCase JSON, so that the client's manual `map*Row` helpers can be deleted rather than maintained (§10.3 D-A).

**Cleaning up phone auth**

35. As a developer, I want the phone login and phone signup code paths removed, so that dead code does not mislead the next reader into thinking phone auth is supported (§16 step 3).
36. As a developer, I want the phone fields removed from the login and register screens in the same change, so that the UI does not offer something the backend cannot do.
37. As a user, I want to not be shown a phone-login option that cannot work, so that I am not led into a dead end.

**Environment and CI**

38. As a developer, I want one `EXPO_PUBLIC_API_URL` variable instead of two Supabase variables, so that configuration is obvious (§12.6).
39. As a developer, I want the app's env check to fail at build time when the API URL is missing, so that I find out before runtime.
40. As a developer, I want the GitHub workflow and repo secrets updated in the same change as the env swap, so that the next push to `master` does not fail `eas-build-check` (§14.5, §16 step 7).
41. As a developer, I want `.env.example` to document the new variable, so that a fresh clone is configurable without reading source.

**Not regressing**

42. As a developer, I want the other `oficina` services left untouched and still importing Supabase, so that this change stays small and reviewable.
43. As a developer, I want `@supabase/supabase-js` kept as a dependency until nothing imports it, so that the app still builds.
44. As a developer, I want the mechanic and admin apps untouched, so that this phase is genuinely two repos and not four.

**Testing**

45. As a developer, I want a server test proving a CORS preflight from an allowed origin succeeds and from a disallowed origin does not, so that browser behaviour is pinned.
46. As a developer, I want a server test proving an unmapped exception returns the house error envelope, so that the global handler cannot silently regress.
47. As a developer, I want the existing `oficina` Playwright spec repointed at the local server, so that the wire has an automated guard and not just a manual checklist.
48. As a developer, I want the e2e suite to boot the server itself, so that a green run means the whole stack works and not just the app.
49. As a developer, I want the four dead Supabase-bound suites deleted in the same commit that adds the new one, so that nobody mistakes a broken suite for a failing feature.

**Seed data**

50. As a developer, I want a `seed:dev` script that fills an empty database with a believable workshop, so that I can click through the app instead of staring at empty lists.
51. As a developer, I want seeded accounts to have known passwords, so that I can log in as a client, a mechanic or an admin on demand.
52. As a developer, I want seeded mechanics to have Brazilian names and Portuguese specialties, so that the app looks like itself while I work on it.
53. As a developer, I want seeded timeslots spread across upcoming days, so that the booking screens have something to render once Phase 2 lands.
54. As a developer, I want `seed:dev` to refuse to run against a non-development database, so that it can never overwrite something that matters.
55. As a developer, I want re-running `seed:dev` to be safe, so that I never end up half-seeded after an interrupted run.

**CI**

56. As a developer, I want gitleaks running at the repository root, so that the monorepo does not become the thing that leaks the four `.env` files sitting beside it.
57. As a developer, I want the server test suite to gate merges, so that the only meaningful automated signal in the project is not advisory.
58. As a developer, I want CI to skip app jobs when only server files changed, so that feedback stays fast.
59. As a developer, I want the dead per-app workflows removed rather than left in place looking active, so that nobody assumes they are protected when they are not.

## Implementation Decisions

### Scope boundary

Only the authentication path is rewired. `mechanic-service.ts`, `timeslot-service.ts`, `appointment-service.ts` and `notification-service.ts` in `oficina` keep importing the Supabase client and keep failing — they fail today, so this is not a regression. The `mechanic` and `admin` apps are untouched.

This deliberately leaves `oficina` in a mixed state, with both an API client and a Supabase client alive at once. That is the cost of shrinking the change, and it is temporary: Phase 2 removes the remainder.

### Server: the API client contract is unchanged

No new endpoints. `POST /auth/signup`, `POST /auth/login`, `GET /auth/me`, `POST /auth/logout` and `GET /health` ship as specified in §10.1 and are not modified. The server work in this phase is entirely cross-cutting infrastructure that Phase 2 would otherwise have to build under pressure.

### Server: global error handling

Introduce the `HttpError` class and helpers, and register a `setErrorHandler` inside `buildApp`, per the shape given in §9.4. This does not exist today; §9.4 is explicit that without it "every endpoint author invents a different mechanism and §10.3 D-C's envelope guarantee quietly fails".

Three branches, in order: an `HttpError` returns its own status and message; a Fastify error with a `statusCode` below 500 is preserved and lowercased; anything else becomes `500 { error: 'internal error' }` with the original never reaching the client.

Building this now rather than in Phase 2 is the point — Phase 2's first endpoint is the concurrency-critical booking path, and it should inherit error handling rather than invent it.

### Server: CORS

Register `@fastify/cors` **inside `buildApp`**, not in `server.ts` (§10.3 D-G — placement in `server.ts` would leave tests unable to exercise the same configuration the server runs).

Allowed origins per §14.4: `http://localhost:8081` and `http://127.0.0.1:8081` (Expo web default), plus the three Playwright-pinned ports `19007` (`oficina`), `19006` (`mechanic`), `19008` (`admin`). The latter two are included now even though those apps are not rewired yet — the list is cheaper to write once.

`credentials: true` is **not** set. The token travels in the `Authorization` header, never in a cookie.

### Client: the API wrapper replaces the Supabase client

`oficina/services/api.ts` stops exporting a Supabase client and starts exporting a typed `fetch` wrapper. Its responsibilities, and only these:

- resolve the base URL from `env.EXPO_PUBLIC_API_URL`
- attach `Authorization: Bearer <token>` when a token is stored
- JSON encode the request body and decode the response
- on a non-2xx response, throw an `Error` whose `message` is the server's `error` string verbatim
- on 401, clear the stored session before throwing

The verbatim-message rule is load-bearing. §13.2 and §18.8 both record that client screens match on **substrings** of server error messages (`unavailable`, `expired`, `too long`). Any wrapper that rewrites, wraps or prefixes the message breaks screens that have not been written yet. Translation to Portuguese happens in the screen, never in the wrapper.

The `AppState` auto-refresh listener currently in this file is deleted (§16 step 1). There is no token refresh to drive — the design is a single 30-day JWT with no refresh flow (§9.3, §17.4).

The existing `withTimeout` helper in `auth-service.ts` moves into the wrapper and applies to every request, so timeout behaviour is uniform rather than per-call.

### Client: token storage

`oficina` already has `utils/secure-storage.ts` wrapping `expo-secure-store`, currently passed to `supabase-js` as its storage adapter. It is reused directly for the token — no new file, no new dependency.

Web uses `localStorage`. The platform split already exists in `api.ts` and is preserved.

The `mechanic` and `admin` apps have no equivalent and use unencrypted AsyncStorage; §16 step 2 recommends copying `secure-storage.ts` into both when they are rewired. That is a later phase's problem and is noted here only so it is not forgotten.

### Client: auth service

Each function maps to exactly one endpoint:

- `login(email, password)` → `POST /auth/login`, store the returned token, return the user
- `signUp(email, password, name)` → `POST /auth/signup`, store the returned token, return the user — the `role` parameter is dropped from the signature entirely, because the server forces `client` and strips any supplied role (§5, hard rule D-07). Accepting a parameter the server ignores is a lie in the type signature.
- `logout()` → `POST /auth/logout`, then clear storage, **swallowing any network error** — the existing store already clears local state first and treats logout as always locally successful (§12.5); that behaviour is preserved
- `getCurrentSessionUser()` → `GET /auth/me`, returning `null` on 401
- `getUserById()` is **deleted**. It exists to work around PostgREST's nested-join behaviour and has no equivalent need against a REST API that returns the user directly.

`loginByPhone`, `signUpWithPhone` and `toE164BrPhone` are deleted, along with `loginByPhone` from the auth store (§12.5) and the phone fields from the login and register screens (§16 step 3).

### Client: session bootstrap

`app/_layout.tsx` drops the `supabase.auth.onAuthStateChange` subscription. There is no auth-state event stream to subscribe to; login and logout update the store directly (§12.3).

The `profileRequestId` ref that invalidates stale in-flight profile loads is **kept**. §12.3 records it as the fix for a real race. The race does not disappear because the transport changed.

Boot sequence becomes: read the stored token → if absent, unauthenticated → if present, `GET /auth/me` → set the user, or clear the session on 401.

### Client: environment

`config/env.ts`, `.env.example` and `scripts/check-env.js` swap the two Supabase variables for `EXPO_PUBLIC_API_URL`. Static dot-notation access only — Expo inlines those at build time and dynamic access silently yields `undefined` (§12.6).

`.github/workflows/security-and-build.yml` and the GitHub repo secrets are updated **in the same commit**. §14.5 is explicit that omitting this fails `eas-build-check` on the next push to `master`.

### Seed data

The database starts empty and there is no production data to import (D-L). A `seed:dev` script writes a believable workshop directly to SQLite: a handful of mechanics with Brazilian names and PT-BR specialties, upcoming timeslots across the next several days, and one client account — all with **known passwords**, so any role can be logged into by hand.

This is separate from `tests/helpers/fixtures.ts` (§15.1) and neither replaces the other: fixtures make vitest work, `seed:dev` makes the app clickable. Given §14.3 records that nothing has been visually verifiable for months, the clickable half is the one that unblocks people.

`seed:dev` must be idempotent or explicitly destructive — never half-seeded — and must refuse to run against a non-development `DB_PATH`.

### Repository and CI

The four repositories were absorbed into one monorepo on 2026-08-11 (§3), pushed to `williamNext/main-mechanic-apps`. This phase is therefore **one commit**, not the two the original §16 plan implied.

The absorb silently disabled all CI: GitHub reads `.github/workflows/` only at the repository root, so the three app workflows are now inert. gitleaks is not running, on a repository that now contains all four apps and sits next to four untracked `.env` files. Restoring a root workflow is in scope for this phase and is the highest-priority item in it:

- **gitleaks across the whole repo** — the one job that cannot be allowed to stay missing
- **`server` typecheck and vitest**, path-filtered — the only meaningful automated signal the project has today, and it should gate

Per-app `npm ci` / `env:check` / lint jobs are deliberately **not** restored yet. The old `eas-build-check` injects the two Supabase secrets that this phase deletes; rebuilding it now would wire CI to credentials that are about to stop existing.

### Naming

The server emits camelCase (§10.3 D-A). The auth responses are already flat and camelCase, so `oficina/types/models.ts` needs no change and no mapper is required for this phase. Later phases delete the `map*Row` helpers as each service is rewired.

## Testing Decisions

**What makes a good test here.** Test the wire, not the wiring. A test that asserts the API wrapper called `fetch` with a particular URL asserts the implementation and will need editing every time the implementation is refactored, while catching none of the failures this phase actually risks — CORS rejection, a token that does not survive a reload, an Android emulator that cannot resolve `localhost`. Test at the highest seam where the real failure can occur.

**Seams — both already exist. No new seam is introduced.**

*Server: `buildApp(db, connection)` + `app.inject`.* Every server test builds the real app through the same function the real server uses; there is no test-only code path (§9.2, §15.1). `tests/helpers/db.ts` provides `makeTestDb()` giving a throwaway SQLite file with migrations applied. New coverage:

- CORS preflight from each allowed origin returns the expected headers; an unlisted origin does not. This is testable at this seam *only because* D-G puts the plugin inside `buildApp`.
- A route that throws an `HttpError` returns its status and message in the house envelope.
- A route that throws an unexpected exception returns `500 { error: 'internal error' }` and does not leak the original message.
- A malformed JSON body still returns Fastify's 400 rather than being flattened to 500.

Prior art: `tests/routes/auth.test.ts` already covers signup, login, me and logout end to end through this seam and is the pattern to follow. The skeleton is in §15.1.

*Client: one new Playwright spec at the monorepo root.* The four legacy suites are deleted, not repointed (D-M) — they were Supabase-bound and asserted against screens being rewired. This phase writes **one** replacement spec: `e2e/auth.spec.ts`, with a `webServer` block that boots `server/` and `oficina` together and seeds a known client via `seed:dev`.

Coverage: register → land in the app; log out → land on login; log in → land in the app; reload mid-session → still authenticated; log in with a wrong password → Portuguese error message shown.

That last assertion is the whole phase in one line. It cannot pass unless the env var resolves, CORS permits the request, the wrapper decodes the envelope, the token persists and the screen renders the message.

**The harness is the deliverable, not the coverage.** Booting server + app together, seeding a known user and driving a browser is the expensive part, and it is far cheaper to build while the surface is one login screen than later against five. The deleted suites are salvaged for their harness pattern — the PowerShell `webServer` commands and pinned ports (19007 `oficina` / 19006 `mechanic` / 19008 `admin`) — not their assertions. That pattern is PowerShell-only and runs on no other OS; this phase inherits that limitation and does not fix it.

Deleting the four dead suite folders happens in this phase, in the same commit as the new spec. Dead tests that look alive are worse than absent ones.

**Acknowledged coverage debt.** `mechanic/tests/e2e/availability.spec.ts` was the only automated guard on the 756-line availability screen (UC-M2). Nothing guards it now, and nothing will until the new suite reaches Phase 2. That is an accepted cost of D-M, recorded here so it is a decision rather than an oversight.

**Deliberately not tested.** No vitest suite is added to `oficina`. A faked `globalThis.fetch` cannot reproduce a CORS rejection, an Android DNS failure, a SecureStore permission error or a lost token across a reload — every real risk in this phase lives above that seam, and a suite that misses all of them while requiring maintenance is a net cost. If client unit tests are wanted, the moment is when there is pure logic worth isolating; there is none here.

**Manual verification is part of the definition of done**, because two of the risks cannot be automated on this machine: Android emulator connectivity via `10.0.2.2`, and physical-device connectivity via the host's LAN IP (§14.4). Both are checked by hand and the result recorded.

## Out of Scope

- **Every non-auth `oficina` service.** Mechanic browsing, timeslots, appointments and notifications keep their Supabase imports and keep failing.
- **The `mechanic` and `admin` apps.** Untouched. They are rewired after the endpoints they need exist (§16 order of operations).
- **All Phase 2 endpoints** — booking, cancellation, completion, the lazy status sync, the role guard middleware (`requireRole`). The role guard is Phase 2's first task; no route in this phase needs a role check.
- **All Phase 3 admin endpoints**, and all notification endpoints and fan-out — the latter now land inside Phases 2–3 per D-K rather than in a Phase 4 of their own.
- **Reshaping the `notifications` table** to match the built client UI (D-K). That is Phase 2 work; this phase does not touch the schema.
- **Removing `@supabase/supabase-js`** from `oficina/package.json`, and `pg` from `admin`. Both wait until nothing imports them (§16 step 8).
- **Rebuilding e2e coverage for anything but auth.** The four legacy suites are deleted in this phase (D-M), but the new suite only covers register/login/reload/logout. Availability, booking, closure and the admin flows stay uncovered until later phases reach them.
- **Password recovery (UC-A6).** Not implemented anywhere, and the requested design was phone-based while phone auth is being dropped. It needs an email-based design decision first, and needs one before any real user depends on this system.
- **Rate limiting on `/auth/login`** (§10.3 D-H, §17.4). A `TODO` is left at the route so it is not forgotten.
- **Structured logging.** `Fastify({ logger: false })` stands (§17.4).
- **HTTPS, hosting, and SQLite backups.** Deferred with the hosting decision — but see the assumption below.
- **The `profiles.role` CHECK constraint** (§17.2). A genuinely valuable small migration, but it needs a table rebuild and is independent of this phase.
- **Per-app CI jobs** (`npm ci`, `env:check`, lint). Deferred until the env var swap has settled across all three apps.
- **Extracting a shared package** for the copy-pasted `types/models.ts`, `constants/theme.ts` and `notification-service.ts`. Newly *possible* thanks to the monorepo, but not this phase.

## Further Notes

### Assumption status

All four opening assumptions were resolved on 2026-08-11 and are recorded as decisions in §10.3.

1. **Rebuild, not migration — ✅ confirmed (D-L).** Not in production, no users, no data worth keeping. No cutover, no dual-run, no rollback. The Supabase export question is closed: there is nothing to export.
2. **Hosting: dev machine — ⚠️ still open.** Deliberately deferred, and the only genuinely unresolved item left. It stops being deferrable around the end of Phase 3: a workshop LAN box makes a 30-day JWT on an unencrypted network and an unbacked-up SQLite file into real problems, and a deployed host needs CORS origins that do not exist yet. Neither is budgeted.
3. **Phase 1.5 precedes Phase 2 — ✅ confirmed.** Recorded in the §4.2 roadmap.
4. **Notifications — ❌ assumption was wrong, and the reversal matters.** The notification UI already exists in `oficina` and `mechanic` (screen, service and store, committed 2026-08-11). The original recommendation to stub `GET /notifications` as `[]` is therefore withdrawn: it would ship a real screen wired to a permanently empty list. **D-K** makes the built UI the specification for the table shape and folds fan-out into the Phase 2 transactions that cause it. Phase 4 is dissolved.

### Change log

- **2026-08-11** — Testing section rewritten: the client seam is now one new root-level spec, not a repointed `oficina/tests/e2e/` (D-M deleted all four legacy suites). Assumptions 1, 3, 4 resolved; 4 reversed. Root CI added to scope. Repo is now a monorepo (§3), so this phase is one commit rather than two.

### Terminology

The word "migration" is doing two unrelated jobs in this project: a Drizzle SQL migration file, and the Supabase-to-server move. If assumption 1 holds, the second is a **rebuild** and calling it a migration invites someone to plan a cutover that cannot exist. Worth fixing in `PROJECT_CONTEXT.md`.

### Recording the decisions

Per §10.3, decisions that affect every endpoint are recorded as `D-xx` rows in the `PROJECT_CONTEXT.md` §10.3 table so the next agent inherits them rather than re-litigating them. (They lived in `server/.planning/` until 2026-08-11; that directory is now frozen.) This phase ratifies D-A (camelCase), D-C (error envelope), D-D (no path versioning) and D-G (CORS inside `buildApp`) by being the first code to depend on them, and leaves D-H (rate limiting) explicitly deferred.

### Definition of done

A developer with a fresh clone of both repos, following only the README, can register an account, close the app, reopen it, still be logged in, log out, and log back in — on web and on at least one real device. The server test suite passes. The `oficina` Playwright suite passes against the local server. `eas-build-check` passes on the next push to `master`.
