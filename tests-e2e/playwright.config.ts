import { defineConfig, devices } from '@playwright/test';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables from projects (e.g. Supabase keys)
dotenv.config({ path: path.resolve(__dirname, '../oficina/.env') });

export default defineConfig({
  testDir: './src/flows',
  timeout: 180000,
  expect: { timeout: 20000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: 'list',
  use: {
    trace: 'on-first-retry',
    headless: true,
  },
  webServer: [
    {
      command: 'powershell -NoProfile -Command "cd ../oficina; $env:CI=1; $env:EXPO_NO_DOCTOR=1; npx expo start --web --port 19007"',
      url: 'http://127.0.0.1:19007',
      reuseExistingServer: true,
      timeout: 240000,
    },
    {
      command: 'powershell -NoProfile -Command "cd ../mechanic; $env:CI=1; npx expo start --web --port 19006"',
      url: 'http://127.0.0.1:19006',
      reuseExistingServer: true,
      timeout: 240000,
    },
    {
      command: 'powershell -NoProfile -Command "cd ../admin; $env:CI=1; npx expo start --web --port 19008"',
      url: 'http://127.0.0.1:19008',
      reuseExistingServer: true,
      timeout: 240000,
    },
  ],
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
