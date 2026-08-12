# Spec — Phase 1.5: Prove the Wire

> **Status:** draft, awaiting confirmation of the four assumptions in [Unconfirmed Assumptions](#unconfirmed-assumptions).
> **Companion docs:** [`PROJECT_CONTEXT.md`](PROJECT_CONTEXT.md) (normative — §8 rules, §10.3 decisions, §16 rewire plan), [`DESIGN_GUIDE.md`](DESIGN_GUIDE.md) (visual only).
> **Repos touched:** `server/`, `oficina/`. Two separate git repos, two coordinated commits (§18.12).

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

*Client: `oficina/tests/e2e/` Playwright.* Currently one spec (`status`), bound to Supabase, pinned to port 19007. Repointed at the local server: the `webServer` block boots `server/` alongside the app, and `src/helpers/db.ts`'s service-role Supabase client is replaced by direct SQLite access or a server-side reset endpoint for test data. Coverage: register → land in the app; log out → land on login; log in → land in the app; reload mid-session → still authenticated; log in with a wrong password → Portuguese error message shown.

That last one is the whole phase in a single assertion. It cannot pass unless the env var resolves, CORS permits the request, the wrapper decodes the envelope, the token persists and the screen renders the message.

Note the existing Playwright `webServer` commands are PowerShell-only with hard-coded ports (§15.2) — this repointing inherits that constraint and does not fix it.

**Deliberately not tested.** No vitest suite is added to `oficina`. A faked `globalThis.fetch` cannot reproduce a CORS rejection, an Android DNS failure, a SecureStore permission error or a lost token across a reload — every real risk in this phase lives above that seam, and a suite that misses all of them while requiring maintenance is a net cost. If client unit tests are wanted, the moment is when there is pure logic worth isolating; there is none here.

**Manual verification is part of the definition of done**, because two of the risks cannot be automated on this machine: Android emulator connectivity via `10.0.2.2`, and physical-device connectivity via the host's LAN IP (§14.4). Both are checked by hand and the result recorded.

## Out of Scope

- **Every non-auth `oficina` service.** Mechanic browsing, timeslots, appointments and notifications keep their Supabase imports and keep failing.
- **The `mechanic` and `admin` apps.** Untouched. They are rewired after the endpoints they need exist (§16 order of operations).
- **All Phase 2 endpoints** — booking, cancellation, completion, the lazy status sync, the role guard middleware (`requireRole`). The role guard is Phase 2's first task; no route in this phase needs a role check.
- **All Phase 3 admin endpoints** and all Phase 4 notification endpoints.
- **Removing `@supabase/supabase-js`** from `oficina/package.json`, and `pg` from `admin`. Both wait until nothing imports them (§16 step 8).
- **The three other Playwright suites** — `tests-e2e/`, `mechanic/tests/e2e/`, `admin/tests/e2e/`. All remain Supabase-bound and broken (§15.2).
- **Password recovery (UC-A6).** Not implemented anywhere, and the requested design was phone-based while phone auth is being dropped. It needs an email-based design decision first, and needs one before any real user depends on this system.
- **Rate limiting on `/auth/login`** (§10.3 D-H, §17.4). A `TODO` is left at the route so it is not forgotten.
- **Structured logging.** `Fastify({ logger: false })` stands (§17.4).
- **HTTPS, hosting, and SQLite backups.** Deferred with the hosting decision — but see the assumption below.
- **The `profiles.role` CHECK constraint** (§17.2). A genuinely valuable small migration, but it needs a table rebuild and is independent of this phase.
- **Server-side seed data beyond `seed:admin`.** Mechanics and timeslots cannot be created through any UI until Phase 2 and 3 exist, so there is nothing to seed that this phase can exercise.

## Further Notes

### Unconfirmed assumptions

This spec was written from a grilling session whose first round was not answered. Four assumptions are load-bearing; if any is wrong, re-scope before starting.

1. **This is a rebuild, not a migration.** No production data, no live users, no cutover, no rollback to Supabase. §4.3 and §17.1 support this. If real data exists and the Supabase project is revivable rather than dead, export it read-only *before* anything else — that option expires quietly.
2. **Hosting is a dev machine for now.** If the destination is a workshop LAN box, then a 30-day JWT crossing an unencrypted network and a single unbacked-up SQLite file both become real problems, and both are currently unbudgeted. If it is a deployed host, CORS needs origins that do not exist yet. §4.3 defers this; deferring it past Phase 3 is where it starts to hurt.
3. **This phase precedes Phase 2**, against the §16 order. §16's ordering is not wrong, only riskier — it defers the same work to a point where failures are harder to attribute.
4. **Notifications are not in v1.** §17.1 says the `notifications` table shape was reverse-engineered from a mapper function for a feature that appears never to have shipped, and the Supabase project cannot confirm it. Phase 4 is therefore new feature design wearing a port's clothing, and should be re-scoped as such rather than estimated as a migration.

### Terminology

The word "migration" is doing two unrelated jobs in this project: a Drizzle SQL migration file, and the Supabase-to-server move. If assumption 1 holds, the second is a **rebuild** and calling it a migration invites someone to plan a cutover that cannot exist. Worth fixing in `PROJECT_CONTEXT.md`.

### Recording the decisions

Per §10.3, decisions that affect every endpoint are recorded as `D-xx` notes in `server/.planning/` so the next agent inherits them rather than re-litigating. This phase ratifies D-A (camelCase), D-C (error envelope), D-D (no path versioning) and D-G (CORS inside `buildApp`) by being the first code to depend on them, and leaves D-H (rate limiting) explicitly deferred.

### Definition of done

A developer with a fresh clone of both repos, following only the README, can register an account, close the app, reopen it, still be logged in, log out, and log back in — on web and on at least one real device. The server test suite passes. The `oficina` Playwright suite passes against the local server. `eas-build-check` passes on the next push to `master`.
