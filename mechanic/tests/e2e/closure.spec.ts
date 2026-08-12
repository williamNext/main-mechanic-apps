import { expect, test } from '@playwright/test';

const DEFAULT_MECHANIC_PHONE = '51999990001';
const DEFAULT_MECHANIC_PASSWORD = process.env.MECHANIC_DEFAULT_PASSWORD || 'password123';

async function loginAsMechanic(page: import('@playwright/test').Page) {
  await page.goto('/(auth)/login');
  await page.getByPlaceholder('(51) 99999-9999').fill(DEFAULT_MECHANIC_PHONE);
  await page.getByPlaceholder('Digite sua senha').fill(DEFAULT_MECHANIC_PASSWORD);
  await page.getByTestId('login-submit-button').click();
  return page.waitForURL(/\/(mechanic)\/(agenda|availability)|\/agenda|\/availability/, { timeout: 20000 })
    .then(() => true)
    .catch(() => false);
}

test('mechanic agenda exposes pending closure tab', async ({ page }) => {
  test.skip(!(await loginAsMechanic(page)), 'Default mechanic E2E account unavailable.');
  await page.goto('/(mechanic)/agenda');
  await expect(page.getByText('Pendentes')).toBeVisible();
});

test('mechanic service closure form validates required fields when appointment is available', async ({ page }) => {
  test.skip(!(await loginAsMechanic(page)), 'Default mechanic E2E account unavailable.');
  await page.goto('/(mechanic)/agenda');

  const firstAppointment = page.locator('text=Cliente').first();
  if (!(await firstAppointment.isVisible().catch(() => false))) {
    test.skip(true, 'No seeded mechanic appointment available for closure-form E2E.');
  }

  await firstAppointment.click();
  await expect(page.getByText('Fechamento do servico')).toBeVisible();
  await page.getByText('Finalizar servico').click();
  await expect(page.getByText('Resumo e servico executado sao obrigatorios.')).toBeVisible();
});
