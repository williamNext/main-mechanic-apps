import { defineConfig, devices } from '@playwright/test';

// Dedicated to this suite so it never collides with a developer's own dev
// server or dev database. seed-dev.ts refuses to run against a DB_PATH
// whose filename doesn't start with "dev", so this stays "dev-e2e.sqlite".
const SERVER_PORT = 3010;
const SERVER_URL = `http://127.0.0.1:${SERVER_PORT}`;
const OFICINA_PORT = 19007;
const MECHANIC_PORT = 19008;

const SERVER_ENV = [
  `$env:DB_PATH='./data/dev-e2e.sqlite'`,
  `$env:JWT_SECRET='e2e-test-jwt-secret-must-be-at-least-32-characters-long'`,
  `$env:PORT='${SERVER_PORT}'`,
].join('; ');

export default defineConfig({
  testDir: './src/flows',
  timeout: 180000,
  expect: { timeout: 20000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: `http://127.0.0.1:${OFICINA_PORT}`,
    trace: 'on-first-retry',
    headless: true,
  },
  webServer: [
    {
      // Runs the server against its own throwaway sqlite file, migrates it,
      // seeds the known dev client (mariana.costa@oficina.dev), then starts
      // listening — one command boots a server this suite can trust the
      // contents of.
      command: `powershell -NoProfile -Command "cd ../server; ${SERVER_ENV}; npm run db:migrate; npm run seed:dev; npm start"`,
      url: `${SERVER_URL}/health`,
      // If a prior run's server on this port is still alive (a crashed
      // Ctrl+C, an interrupted run), it's reused as-is — db:migrate/seed:dev
      // do NOT rerun. seed:dev upserts, so a leftover server from a run
      // against the same schema is harmless; a leftover server from a run
      // against a stale schema is not. Kill anything on SERVER_PORT first if
      // login for the seeded client starts failing for no obvious reason.
      reuseExistingServer: true,
      timeout: 120000,
    },
    {
      command: `powershell -NoProfile -Command "cd ../oficina; $env:CI=1; $env:EXPO_NO_DOCTOR=1; $env:EXPO_PUBLIC_API_URL='${SERVER_URL}'; npx expo start --web --port ${OFICINA_PORT}"`,
      url: `http://127.0.0.1:${OFICINA_PORT}`,
      reuseExistingServer: true,
      timeout: 240000,
    },
    {
      command: `powershell -NoProfile -Command "cd ../mechanic; $env:CI=1; $env:EXPO_NO_DOCTOR=1; $env:EXPO_PUBLIC_API_URL='${SERVER_URL}'; npx expo start --web --port ${MECHANIC_PORT}"`,
      url: `http://127.0.0.1:${MECHANIC_PORT}`,
      reuseExistingServer: true,
      timeout: 240000,
    },
  ],
  projects: [
    {
      name: 'client-chromium',
      testDir: './src/flows/client',
      use: {
        ...devices['Desktop Chrome'],
        baseURL: `http://127.0.0.1:${OFICINA_PORT}`,
      },
    },
    {
      name: 'mechanic-chromium',
      testDir: './src/flows/mechanic',
      use: {
        ...devices['Desktop Chrome'],
        baseURL: `http://127.0.0.1:${MECHANIC_PORT}`,
      },
    },
  ],
});
