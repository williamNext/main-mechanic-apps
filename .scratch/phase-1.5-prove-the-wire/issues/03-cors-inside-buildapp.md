# 03 — An Expo web build can reach the server without CORS errors

**What to build:** A browser running the Expo web build can call the server. Today it cannot — CORS is not configured at all, so the web target is unusable regardless of what else works.

`@fastify/cors` is registered **inside `buildApp`**, not in `server.ts` (decision D-G). Placement is the point: configuration living in `server.ts` cannot be exercised by tests, so CORS could pass every test and still fail in a real browser.

Allowed origins are the Expo web default on both hostnames (`http://localhost:8081` and `http://127.0.0.1:8081`) plus the three Playwright-pinned ports — 19007 for `oficina`, 19006 for `mechanic`, 19008 for `admin`. The latter two apps are not rewired in this phase; they are listed now because the list is cheaper to write once than to revisit twice.

`credentials` is **not** enabled. The token travels in the `Authorization` header and never in a cookie.

**Blocked by:** 02 — House error envelope. Both register into `buildApp`; sequencing them avoids two changes conflicting inside the same function for no benefit. Nothing downstream is delayed, since ticket 05 needs both regardless.

**Status:** ready-for-agent

- [ ] A preflight request from each allowed origin returns the expected CORS headers
- [ ] A preflight request from an origin not on the list does not receive them
- [ ] `credentials` is not enabled
- [ ] The plugin is registered inside `buildApp`, and the tests exercise it through that same function
- [ ] `Authorization` is an allowed request header, so an authenticated cross-origin call succeeds
