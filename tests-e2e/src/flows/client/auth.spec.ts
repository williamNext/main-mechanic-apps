import { expect, test } from '@playwright/test';

// Matches CLIENT_SEED in server/scripts/seed-dev.ts — the known client that
// `npm run seed:dev` (run by playwright.config.ts's webServer) upserts on
// every boot of this suite.
const SEEDED_CLIENT_EMAIL = 'mariana.costa@oficina.dev';
const SEEDED_CLIENT_PASSWORD = 'SenhaDev123!';

function uniqueEmail(): string {
  return `e2e-client-${Date.now()}-${Math.floor(Math.random() * 1e6)}@oficina-e2e.dev`;
}

async function loginAsSeededClient(page: import('@playwright/test').Page) {
  await page.goto('/login');
  await page.getByTestId('login-email').fill(SEEDED_CLIENT_EMAIL);
  await page.getByTestId('login-password').fill(SEEDED_CLIENT_PASSWORD);
  await page.getByTestId('login-submit').click();
  await page.waitForURL('**/browse');
}

test('register lands the user in the app', async ({ page }) => {
  await page.goto('/register');
  await page.getByTestId('register-name').fill('E2E Test Client');
  await page.getByTestId('register-email').fill(uniqueEmail());
  await page.getByTestId('register-password').fill('SenhaDev123!');
  await page.getByTestId('register-submit').click();

  await page.waitForURL('**/browse');
  await expect(page.getByTestId('browse-search')).toBeVisible();
});

test('logout returns the user to the login screen', async ({ page }) => {
  await loginAsSeededClient(page);

  await page.getByTestId('topbar-profile').click();
  await page.waitForURL('**/profile');
  await page.getByTestId('logout-button').click();

  await page.waitForURL('**/login');
  await expect(page.getByTestId('login-submit')).toBeVisible();
});

test('login lands the user in the app', async ({ page }) => {
  await loginAsSeededClient(page);
  await expect(page.getByTestId('browse-search')).toBeVisible();
});

test('a page reload mid-session keeps the user authenticated', async ({ page }) => {
  await loginAsSeededClient(page);

  await page.reload();

  await page.waitForURL('**/browse');
  await expect(page.getByTestId('browse-search')).toBeVisible();
});

test('a wrong password shows the Portuguese invalid-credentials message', async ({ page }) => {
  await page.goto('/login');
  await page.getByTestId('login-email').fill(SEEDED_CLIENT_EMAIL);
  await page.getByTestId('login-password').fill('definitely-the-wrong-password');
  await page.getByTestId('login-submit').click();

  await expect(page.getByTestId('login-error')).toHaveText('E-mail ou senha inválidos.');
});
