import { expect, test } from '@playwright/test';

const ADMIN_IDENTIFIER = process.env.ADMIN_E2E_IDENTIFIER;
const ADMIN_PASSWORD = process.env.ADMIN_E2E_PASSWORD;

async function loginAsAdmin(page: import('@playwright/test').Page) {
  test.skip(!ADMIN_IDENTIFIER || !ADMIN_PASSWORD, 'Set ADMIN_E2E_IDENTIFIER and ADMIN_E2E_PASSWORD for admin E2E.');
  await page.goto('/(auth)/login');
  await page.getByPlaceholder('11999999999').fill(ADMIN_IDENTIFIER!);
  await page.getByPlaceholder('Senha').fill(ADMIN_PASSWORD!);
  await page.getByText('Entrar').click();
  await page.waitForURL(/\/(admin)\/dashboard|\/dashboard/, { timeout: 20000 });
}

test('admin finance tab loads financial report shell', async ({ page }) => {
  await loginAsAdmin(page);
  await page.goto('/(admin)/finance');
  await expect(page.getByText('Financeiro')).toBeVisible();
  await expect(page.getByText('Receita total')).toBeVisible();
  await expect(page.getByText('Receita por mecanico')).toBeVisible();
  await expect(page.getByText('Receita por servico')).toBeVisible();
});

test('admin appointments exposes not-finalized filter', async ({ page }) => {
  await loginAsAdmin(page);
  await page.goto('/(admin)/appointments');
  await expect(page.getByText('Nao finalizados')).toBeVisible();
});
