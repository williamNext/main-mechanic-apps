# 06 — The same flow works on a device, and the setup is written down

**What to build:** Two things that ticket 05 cannot deliver from a browser.

First, a single documented command sequence that brings up the server and `oficina` together — including seeding, and including which environment variable to set to what. Returning to this project after a break should not require re-deriving the setup from source. A developer with a fresh clone should be able to follow only the README and reach a working login.

Second, the connectivity guidance that costs an afternoon when it is missing. An Android emulator cannot resolve `localhost` — it needs `10.0.2.2`. A physical device needs the host machine's LAN IP, not either of those. Both are written down, and both are **verified by hand** on this machine, because neither can be automated here. This manual verification is part of the phase's definition of done, not an optional extra.

The app should also fail loudly and specifically when the server is unreachable, so that "the server is down" is distinguishable from "my code is broken" — and it should be obvious from the running app which backend answered, so nobody is ever confused about whether they are talking to the local server or to the dead Supabase project.

**Blocked by:** 05 — `oficina` signs users in against the local server. There is nothing to verify on a device until the web path works.

**Status:** partially done — the documentation and the two app-behavior items are built and verified; the two hand-verification items are **not done** and cannot be done from this environment (no Android emulator or physical device available here). A root [`README.md`](../../../README.md) now carries the combined quickstart, the connectivity table, and the unreachable-server/backend-indicator behavior; `oficina/README.md` was also fixed — it still described the old Supabase env vars. The unreachable-message and backend-indicator items were verified by scripting a throwaway Playwright check against `oficina` pointed at a closed port (not by hand on a device, but exercises the real code path): the login screen showed *"Não foi possível conectar ao servidor. Verifique sua conexão e tente novamente."* and the "Servidor: http://..." line under the login form.

- [x] One documented sequence brings up the server and `oficina` together from a clean checkout
- [x] The documentation states that an Android emulator must use `10.0.2.2` rather than `localhost`
- [x] The documentation states that a physical device must use the host's LAN IP, and how to find it
- [ ] Register, restart, log out and log in are all verified by hand on an Android emulator, and the result recorded — **needs a human with an emulator**
- [ ] The same flow is verified by hand on at least one physical device, and the result recorded — **needs a human with a device**
- [x] With the server stopped, the app shows a specific unreachable-server message rather than a generic failure
- [x] It is evident from the running app which backend it is talking to
