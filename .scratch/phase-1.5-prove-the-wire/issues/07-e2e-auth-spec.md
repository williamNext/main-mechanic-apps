# 07 — One end-to-end spec guards the wire, and the four dead suites go

**What to build:** An automated run that boots the server and `oficina` together, seeds a known client, drives a browser through the whole authentication flow, and goes green only if every layer works. Right now the only guard on any of this is a manual checklist.

One spec, at the repository root. It covers: register and land in the app; log out and land on login; log in and land in the app; reload mid-session and still be authenticated; log in with a wrong password and see the Portuguese error message.

That last assertion is the entire phase in one line. It cannot pass unless the environment variable resolves, CORS permits the request, the wrapper decodes the envelope, the token persists and the screen renders the message.

**The harness is the deliverable, not the coverage.** Booting the server and the app together, seeding a known user and driving a browser is the expensive part, and it is far cheaper to build now, against one login screen, than later against five. Every subsequent phase inherits it.

**Delete the four legacy suites in the same commit** (decision D-M): `oficina/tests/e2e`, `mechanic/tests/e2e`, `admin/tests/e2e`, and the root cross-app flows. They are Supabase-bound and assert against screens being rewired, so they are repointed nowhere — they are removed. Dead tests that look alive are worse than absent ones. Salvage their harness pattern only: the PowerShell `webServer` commands and the pinned ports (19007 `oficina`, 19006 `mechanic`, 19008 `admin`). That pattern is PowerShell-only and runs on no other operating system; this phase inherits that limitation and does not fix it.

**Accepted coverage debt, recorded so it is a decision and not an oversight:** the `mechanic` availability spec was the only automated guard on the 756-line availability screen. Nothing guards it after this ticket, and nothing will until the new suite reaches Phase 2.

No vitest suite is added to `oficina`. A faked `fetch` cannot reproduce a CORS rejection, an Android DNS failure, a secure-storage permission error or a token lost across a reload — every real risk in this phase lives above that seam, so a suite that misses all of them while demanding maintenance is a net cost.

**Blocked by:** 04 — `seed:dev` (the spec seeds a known client through it), and 05 — `oficina` signs users in against the local server.

**Status:** ready-for-agent

- [ ] One command runs the suite; it boots the server and `oficina` itself and seeds a known client
- [ ] Register → the user lands in the app
- [ ] Log out → the user lands on the login screen
- [ ] Log in → the user lands in the app
- [ ] Reload mid-session → the user is still authenticated
- [ ] Wrong password → the Portuguese error message is asserted on screen
- [ ] A green run means the whole stack worked, not just the app
- [ ] `oficina/tests/e2e`, `mechanic/tests/e2e`, `admin/tests/e2e` and the root cross-app flows are deleted in the same commit that adds this spec
- [ ] No remaining test file imports the Supabase client
- [ ] No vitest suite is added to `oficina`
