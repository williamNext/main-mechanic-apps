# Workshop Backend Server

A self-hosted Node.js API server backed by SQLite, replacing the shared Supabase project
used by the `admin`, `mechanic`, and `oficina` client apps.

## Setup

```bash
cp .env.example .env
# edit .env — at minimum, set a real JWT_SECRET (32+ characters)
npm install
npm run db:generate
npm run db:migrate
```

## Run

```bash
npm run dev
```

The server starts and listens on the configured `PORT` (default `3000`). Once running:

- `GET /health` returns `{ "status": "ok", "db": "ok" }`
- `POST /auth/signup` with `{ "name": "...", "email": "...", "password": "..." }` creates a
  `client`-role account and returns `{ "token": "...", "user": { ... } }`
- `POST /auth/login` with `{ "email": "...", "password": "..." }` returns the same
  `{ "token": "...", "user": { ... } }` shape for any existing account, regardless of role
- `GET /auth/me` with `Authorization: Bearer <token>` returns the caller's current profile
- `POST /auth/logout` with `Authorization: Bearer <token>` ends that session; the same token is
  rejected by every authenticated route afterwards, including after a server restart

## Admin Bootstrap

There is no admin signup endpoint — `POST /auth/signup` always creates a `client`-role account
(D-07). The **only** way an admin account comes into existence is the standalone seed script:

```bash
npm run seed:admin -- "Admin Name" "admin@example.com" "a-strong-password"
```

This writes directly to the SQLite file at `DB_PATH` using the same schema and password hashing
as the rest of the server — it is not an HTTP endpoint and is never triggered automatically at
boot. It refuses to run (exits non-zero) if any admin-role profile already exists, so re-running
it can never quietly create a second superuser. Run it once, right after the first
`npm run db:migrate`, to create the account you'll use to sign in as an admin.

## Seed Dev Data

`npm run seed:dev` populates an empty development database with a believable, clickable workshop:
3 mechanics (Carlos Silva — Motor e Câmbio, Ana Souza — Freios e Suspensão, João Pereira — Elétrica
Automotiva), 2 clients (Mariana Costa and Rafael Lima), 1 admin (Admin Dev), and 66 timeslots.
Every seeded account shares one documented password:

```
SenhaDev123!
```

Example login emails: `carlos.silva@oficina.dev` (mechanic), `mariana.costa@oficina.dev` (client),
`admin@oficina.dev` (admin). Second seeded client: `rafael.lima@oficina.dev`, password `SenhaDev123!`.

The script uses fixed IDs and upserts, so running it twice leaves the database in the same state
as running it once, and all writes happen inside a single transaction so an interrupted run never
leaves a half-seeded database. As a safety rail against ever running this against something that
matters, it refuses to run unless `DB_PATH`'s filename starts with `dev` (e.g. `dev.db`,
`dev-workshop.sqlite`) — it exits non-zero and touches nothing otherwise.

```bash
DB_PATH=./dev.db npm run seed:dev
```

## Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `DB_PATH` | yes | — | Path to the SQLite database file. Parent directory is created automatically if missing. |
| `PORT` | no | `3000` | Port the HTTP server listens on. |
| `JWT_SECRET` | yes | — | Secret used to sign/verify access tokens. Must be at least 32 characters. The process refuses to boot without one. |
| `JWT_EXPIRY_SECONDS` | no | `2592000` (30 days) | Access token lifetime in seconds. |

All configuration is read from the environment exactly once, at boot, through
`src/config/index.ts`. There is no hosting-platform-specific code path anywhere in this
server — it runs the same way on any machine that has Node installed.

## Tests

```bash
npm test          # full suite
npm run test:quick  # dot reporter, same suite
```

Tests never touch the `DB_PATH` file — every test spins up its own throwaway SQLite file
under the OS temp directory (see `tests/helpers/db.ts`).

## Troubleshooting

### Native addon build failures on Windows (`better-sqlite3`, `argon2`)

`better-sqlite3` and `argon2` are native (C++) addons. If `npm install` fails with a
`node-gyp` / `MSBuild` error, a C++ build toolchain is required:

1. Install [Visual Studio Build Tools](https://visualstudio.microsoft.com/downloads/) with
   the **"Desktop development with C++"** workload.
2. Re-run `npm install`.

This is a fallback step, not a prerequisite — most common Node/platform combinations use a
prebuilt binary and never hit this path.

If the build still fails with an error naming the **ClangCL** toolset specifically (rather
than a generic MSBuild error), your Node.js binary was built with `clang-cl` and node-gyp is
trying to match that toolchain for ABI compatibility, but the "C++ Clang tools for Windows"
component isn't installed. Either add that component via the Visual Studio Installer, or
force the standard MSVC toolset instead (safe for N-API addons like `better-sqlite3`, which
use a compiler-independent ABI) by running, inside the affected package's `node_modules`
folder:

```bash
npx node-gyp configure --clang=0
npx node-gyp build
```
