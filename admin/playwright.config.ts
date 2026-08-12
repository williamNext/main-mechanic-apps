import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 120000,
  expect: { timeout: 15000 },
  fullyParallel: false,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:19008',
    trace: 'on-first-retry',
    headless: true,
  },
  webServer: {
    command: 'powershell -NoProfile -Command "$env:CI=1; npx expo start --web --port 19008"',
    url: 'http://127.0.0.1:19008',
    reuseExistingServer: true,
    timeout: 180000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
