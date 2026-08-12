# Workshop Monorepo

A car-workshop booking system: a self-hosted Node.js/SQLite API (`server/`) and three Expo
apps — `oficina` (client-facing), `mechanic`, and `admin`.

**As of Phase 1.5, only `oficina`'s authentication is wired to `server/`.** Everything else in
`mechanic`, `admin`, and the rest of `oficina` still points at a dead Supabase project and will
fail — that isn't a regression from this setup, it's the current state of the rewire. This README
covers what actually works: register, login, logout, and staying signed in, end to end, on
`oficina`.

## Quickstart — server + `oficina` together

From a clean checkout, in two terminals:

**Terminal 1 — the server**

```bash
cd server
cp .env.example .env
# edit .env — at minimum set JWT_SECRET to a random string 32+ characters long
npm install
npm run db:migrate
npm run seed:dev
npm run dev
```

`npm run seed:dev` gives you a ready-made login without registering by hand: every seeded account
shares the password `SenhaDev123!`. The seeded client is `mariana.costa@oficina.dev` — use it to
log in immediately. (See [`server/README.md`](server/README.md) for the full account list and for
`seed:admin`, which is the only way to create an admin account.)

The server listens on `http://localhost:3000` by default (`PORT` in `.env`).

**Terminal 2 — `oficina`**

```bash
cd oficina
cp .env.example .env
# EXPO_PUBLIC_API_URL=http://localhost:3000 is already the default — see "Connectivity" below
# if you're running on an Android emulator or a physical device instead of a web browser
npm install
npm run web        # or: npm run android / npm run ios
```

Open the app, log in with `mariana.costa@oficina.dev` / `SenhaDev123!` (or register a new
account), and you're in. Logging out returns you to the login screen; reloading the page (web) or
force-quitting and reopening the app (native) keeps you signed in.

Confirming the wire actually works end to end, automatically, without touching an emulator: see
[`tests-e2e/`](tests-e2e/) — `npm test` from that directory boots both halves itself, seeds a known
client, and drives a browser through register/login/logout/reload/wrong-password.

## Connectivity — talking to the server from something that isn't a browser on this machine

`oficina`'s `EXPO_PUBLIC_API_URL` is a plain URL the client `fetch`es directly — there's no proxy
or tunnel, so it has to resolve to wherever the server is actually reachable from:

| Running `oficina` on... | Set `EXPO_PUBLIC_API_URL` to |
|---|---|
| A web browser on the same machine as the server | `http://localhost:3000` (the `.env.example` default) |
| **An Android emulator** | `http://10.0.2.2:3000` — the emulator's virtual network maps `10.0.2.2` to the host machine's `localhost`. Using `localhost` from inside the emulator points at the emulator itself, not your host, and the request fails to connect. |
| **A physical device** (phone on the same Wi-Fi as your dev machine) | `http://<your-LAN-IP>:3000` — find your LAN IP with `ipconfig` (Windows, look for "IPv4 Address" under your active adapter) or `ifconfig`/`ip addr` (macOS/Linux, look for the `en0`/`wlan0` entry). `localhost` and `10.0.2.2` both fail here; neither refers to your dev machine from a separate physical device. |
| An iOS simulator | `http://localhost:3000` — unlike Android, the iOS simulator shares the host's network namespace, so `localhost` already resolves correctly. |

After changing `EXPO_PUBLIC_API_URL`, restart the Expo dev server — it's inlined into the
JavaScript bundle at build time (`EXPO_PUBLIC_*` vars are not read at runtime), so a running
instance won't pick up the change.

**Which backend is the app actually talking to?** The login screen prints the resolved
`EXPO_PUBLIC_API_URL` under the login form (`Servidor: http://...`) — check it any time you're
unsure whether you're hitting your local server or something stale.

**When the server is unreachable**, login and register show a distinct message —
*"Não foi possível conectar ao servidor. Verifique sua conexão e tente novamente."* — rather than
the generic invalid-credentials message, so a wrong password and a dead server never look the
same.

## Manual device verification

The automated suite in `tests-e2e/` covers the web path. Register → restart → logout → login has
not yet been re-verified by hand on an Android emulator or a physical device since the auth
rewire — do that locally with the connectivity table above before relying on this for native, and
record the result (device/OS version, what was checked, pass/fail) here or in the phase ticket.

## Repository layout

| Path | What it is |
|---|---|
| `server/` | The API — see [`server/README.md`](server/README.md) for env vars, seeding, and troubleshooting native-addon builds |
| `oficina/` | Client-facing app — the only app currently wired to `server/` |
| `mechanic/`, `admin/` | Still wired to the dead Supabase project; untouched by this phase |
| `tests-e2e/` | The one Playwright spec guarding the whole auth wire — server + `oficina` together |
