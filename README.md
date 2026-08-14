# Workshop Monorepo

A car-workshop booking system: a self-hosted Node.js/SQLite API (`server/`) and three Expo
apps — `oficina` (client-facing), `mechanic`, and `admin`.

**As of Phase 2b, `oficina` and `mechanic` are fully off Supabase and wired to `server/`.** Client
booking and mechanic availability, agenda, cancellation, completion, notifications, profile, and
session flows use the local API. `admin` remains on the dead Supabase project until Phase 3.

## Quickstart — server + Expo apps

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

To verify the appointment flow with seeded data:

1. Log in as `mariana.costa@oficina.dev` with `SenhaDev123!`.
2. Open **Explorar**, choose a mechanic, select a day, then select an available time under
   **Horários Disponíveis**.
3. Fill **Modelo do Veículo** and **Descrição do Problema**, then press **Confirmar Agendamento**.
4. Confirm that **Agendamento Confirmado!** appears on the confirmation screen.
5. Open the **Reservas** tab, find the appointment under **Próximos**, and open it.
6. On **Detalhes**, press **Cancelar Agendamento**, then **Sim, cancelar**.
7. Return to the same mechanic and day under **Explorar**; the cancelled appointment's time must
   appear as available again.

Confirming the wire actually works end to end, automatically, without touching an emulator: see
[`tests-e2e/`](tests-e2e/) — `npm test` from that directory boots both halves itself, seeds a known
client, and drives a browser through register/login/logout/reload/wrong-password.

**Terminal 3 — `mechanic`**

```bash
cd mechanic
cp .env.example .env
# EXPO_PUBLIC_API_URL=http://localhost:3000 is already the web default
npm install
npm run web        # or: npm run android / npm run ios
```

Seeded mechanic credentials all use password `SenhaDev123!`:

| Mechanic | Email | Specialty |
|---|---|---|
| Carlos Silva | `carlos.silva@oficina.dev` | Motor e Câmbio |
| Ana Souza | `ana.souza@oficina.dev` | Freios e Suspensão |
| João Pereira | `joao.pereira@oficina.dev` | Elétrica Automotiva |

Mechanic walkthrough from a fresh `npm run seed:dev`:

1. Log in as `carlos.silva@oficina.dev` / `SenhaDev123!`.
2. In **Agenda**, open **Próximos** and select Mariana Costa's Honda Civic appointment.
3. Enter summary, work performed, and at least one priced service item; press **Finalizar serviço**.
   Reopen appointment and confirm completed report and line items remain visible.
4. Open **Disponibilidade**, choose a future date, and confirm rows distinguish **Disponível**,
   **Bloqueado**, and **Reservado**.
5. Create a slot or interval batch. Block a free slot, unblock it, then delete it; reserved slot
   must not allow availability toggle.
6. Open **Perfil**, change name or specialty, save, reload, and confirm update persists.

## Connectivity — talking to the server from something that isn't a browser on this machine

Each rewired app's `EXPO_PUBLIC_API_URL` is a plain URL the client `fetch`es directly — there's no proxy
or tunnel, so it has to resolve to wherever the server is actually reachable from:

| Running `oficina` or `mechanic` on... | Set `EXPO_PUBLIC_API_URL` to |
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
| `oficina/` | Client-facing app — fully wired to `server/` |
| `mechanic/` | Mechanic-facing app — fully wired to `server/` |
| `admin/` | Still wired to the dead Supabase project; scheduled for Phase 3 |
| `tests-e2e/` | The one Playwright spec guarding the whole auth wire — server + `oficina` together |
