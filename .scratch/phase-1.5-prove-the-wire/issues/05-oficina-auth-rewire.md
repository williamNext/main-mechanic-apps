# 05 — `oficina` signs users in against the local server

**What to build:** The tracer bullet. A developer starts the server and starts `oficina`, registers an account with name, email and password, is taken straight into the app without logging in a second time, force-quits, reopens, and is still signed in. They log out, land on the login screen, and log back in. On the web, a page reload does not sign them out.

This is the first time any client has ever called the new server. Everything it proves is currently unvalidated: that a plain `fetch` wrapper can replace `supabase-js`, that the JWT survives an app restart, that CORS lets a browser through, that the environment variable reaches the server, and that session bootstrap works without an auth-state event stream.

**The wire.** `services/api.ts` stops exporting a Supabase client and exports a typed `fetch` wrapper instead. It resolves the base URL from the environment, attaches `Authorization: Bearer <token>` when a token is stored, encodes and decodes JSON, applies a uniform timeout to every request, and on a non-2xx response throws an `Error` whose message is the server's `error` string **verbatim**. On a 401 it clears the stored session before throwing.

The verbatim rule is load-bearing and easy to break. Client screens match on *substrings* of server messages. Any wrapper that rewrites, wraps or prefixes the message silently breaks screens that have not been written yet. Translation into Portuguese happens in the screen, never in the wrapper.

The `AppState` auto-refresh listener in this file is deleted — the design is a single 30-day JWT with no refresh flow, so there is nothing to drive. The `withTimeout` helper currently living in `auth-service.ts` moves into the wrapper so timeout behaviour is uniform rather than per-call.

**Token storage.** `utils/secure-storage.ts` already wraps `expo-secure-store` and is currently handed to `supabase-js` as its storage adapter. It is reused directly for the token — no new file, no new dependency. Web keeps using `localStorage`; the platform split already exists and is preserved.

**Auth service.** Each function maps to exactly one endpoint: `login` and `signUp` store the returned token and return the user; `logout` calls the endpoint then clears storage, swallowing any network error so a user is never trapped in a session they asked to end; `getCurrentSessionUser` returns `null` on 401. `signUp` drops its `role` parameter entirely — the server forces `client` and strips any supplied role, so accepting the parameter would be a lie in the type signature. `getUserById` is deleted; it works around PostgREST nested-join behaviour and has no equivalent need against an API that returns the user directly.

**Phone auth goes.** `loginByPhone`, `signUpWithPhone` and `toE164BrPhone` are deleted from the service, `loginByPhone` from the auth store, and the phone fields from the login and register screens. The backend cannot do phone auth; the UI must not offer a dead end, and the dead code must not mislead the next reader.

**Session bootstrap.** `app/_layout.tsx` drops the `onAuthStateChange` subscription — there is no event stream, and login and logout update the store directly. Boot becomes: read the stored token; if absent, unauthenticated; if present, call `GET /auth/me` and either set the user or clear the session on 401. The app shows nothing rather than flashing the login screen while it checks. The `profileRequestId` ref is **kept** — it fixes a real race where a stale profile response overwrites current state, and that race does not disappear because the transport changed.

**Environment.** `config/env.ts`, `.env.example` and `scripts/check-env.js` swap the two Supabase variables for a single `EXPO_PUBLIC_API_URL`. Static dot-notation access only — Expo inlines those at build time and dynamic access silently yields `undefined`. The GitHub repo secrets are updated in the same change, or the next push to `master` fails.

**Not touched.** `mechanic-service.ts`, `timeslot-service.ts`, `appointment-service.ts` and `notification-service.ts` keep importing Supabase and keep failing — they fail today, so this is not a regression. `@supabase/supabase-js` stays in `package.json` until nothing imports it. The `mechanic` and `admin` apps are untouched.

**Blocked by:** 02 — House error envelope (the wrapper's verbatim-message contract needs one uniform shape to parse), and 03 — CORS inside `buildApp` (without it the web target cannot make the request at all).

**Status:** ready-for-agent

- [ ] Registering with name, email and password lands the user inside the app, with no second login
- [ ] Logging in with correct credentials lands the user inside the app
- [ ] A wrong password shows a readable Brazilian-Portuguese message, not raw JSON and not a stack trace
- [ ] An unknown email and a wrong password produce the same message, revealing nothing about which accounts exist
- [ ] A password that is too short, and a malformed email, each produce their own clear Portuguese message
- [ ] An already-registered email produces a message that points the user at logging in
- [ ] The submit button shows it is working and refuses a second submission
- [ ] A request that times out surfaces as a timeout message rather than an endless spinner
- [ ] A closed and reopened app is still signed in; on web, a page reload is still signed in
- [ ] On a device, the token is stored in encrypted storage
- [ ] Every boot re-reads the session from `GET /auth/me`, so a profile or role change takes effect immediately
- [ ] An invalid session returns the user to the login screen rather than a half-authenticated state
- [ ] Nothing is rendered while the session is being checked — the login screen does not flash
- [ ] Logging out returns the user to the login screen, erases the stored token, and works even when the server is unreachable
- [ ] The token is invalidated server-side on logout, so a copy cannot be replayed
- [ ] Server error messages reach the screen unmodified — no wrapping, no prefixing, no rewriting
- [ ] The phone fields, the phone service functions and the store's phone action are all gone
- [ ] `EXPO_PUBLIC_API_URL` is the only new variable; both Supabase variables are gone from `config/env.ts`, `.env.example`, `check-env.js` and the workflow
- [ ] The env check fails at build time when `EXPO_PUBLIC_API_URL` is missing
- [ ] The GitHub repo secrets are updated in the same change
- [ ] The stale-profile race guard still discards a late response
- [ ] The other `oficina` services still import Supabase and are otherwise unchanged
- [ ] The `mechanic` and `admin` apps are untouched
