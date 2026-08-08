---
phase: 1
slug: foundation-auth-walking-skeleton
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-07
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.1.10 [VERIFIED: npm registry] |
| **Config file** | none yet — see Wave 0 |
| **Quick run command** | `npx vitest run --reporter=dot` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~10-20 seconds (small suite, in-memory/temp-file SQLite) |

`vitest` is recommended over `jest` for a new TypeScript/ESM Node project in 2025-2026: no separate ts-jest/babel config needed, faster startup, native ESM support. `supertest` (7.2.2 [VERIFIED: npm registry]) is the standard companion for exercising Fastify's HTTP layer in tests (Fastify's native `app.inject()` is a viable dependency-free alternative — planner's choice).

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --reporter=dot`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** ~20 seconds

---

## Per-Task Verification Map

| Req ID | Behavior | Test Type | Automated Command | File Exists | Status |
|--------|----------|-----------|--------------------|-------------|--------|
| INFRA-01 | Server boots reading DB_PATH/PORT/JWT_SECRET from env, fails fast if missing | unit | `npx vitest run tests/config.test.ts` | ❌ W0 | ⬜ pending |
| INFRA-02 | Server starts against a local SQLite file via documented command | smoke | `npm run dev` + manual `curl localhost:PORT/health` | ❌ W0 (add `/health` route) | ⬜ pending |
| DATA-01 | All 9 tables exist after migration runs | integration | `npx vitest run tests/db/schema.test.ts` | ❌ W0 | ⬜ pending |
| DATA-02 | `notifications` table has the 9 inferred columns | integration | `npx vitest run tests/db/schema.test.ts` | ❌ W0 (same file as DATA-01) | ⬜ pending |
| DATA-03 | Updating `profiles.name` or `mechanics.is_active` updates `public_mechanics` without a manual step | integration | `npx vitest run tests/db/public-mechanics-sync.test.ts` | ❌ W0 | ⬜ pending |
| AUTH-01 | POST /auth/signup creates a `client`-role profile with hashed password | integration | `npx vitest run tests/routes/auth.test.ts` | ❌ W0 | ⬜ pending |
| AUTH-02 | POST /auth/login returns a JWT; the same JWT is valid across a simulated restart (fresh process re-reading the same DB file) | integration | `npx vitest run tests/routes/auth.test.ts` | ❌ W0 (same file) | ⬜ pending |
| AUTH-03 | POST /auth/logout revokes the JWT; subsequent authenticated request with that token returns 401 | integration | `npx vitest run tests/routes/auth.test.ts` | ❌ W0 (same file) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `vitest.config.ts` — framework install/config, using an isolated `:memory:` or temp-file SQLite DB per test run
- [ ] `tests/db/schema.test.ts` — covers DATA-01, DATA-02
- [ ] `tests/db/public-mechanics-sync.test.ts` — covers DATA-03
- [ ] `tests/routes/auth.test.ts` — covers AUTH-01, AUTH-02, AUTH-03
- [ ] `tests/config.test.ts` — covers INFRA-01
- [ ] Framework install: `npm install -D vitest supertest @types/node`
- [ ] A `/health` route for the INFRA-02 smoke check (not itself a requirement, but the simplest way to verify "server starts and responds")

---

## Manual-Only Verifications

*None — all phase behaviors have automated verification.*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 20s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
