import { expect, test } from '@playwright/test';

const ADMIN_IDENTIFIER = process.env.ADMIN_E2E_IDENTIFIER;
const ADMIN_PASSWORD = process.env.ADMIN_E2E_PASSWORD;
const CURRENT_MONTH = new Intl.DateTimeFormat('pt-BR', { month: '2-digit', year: 'numeric' }).format(new Date());
const CURRENT_MONTH_FIRST_DAY = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(
  new Date(new Date().getFullYear(), new Date().getMonth(), 1),
);

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
  await expect(page.getByText('Financeiro', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('Mes').first()).toBeVisible();
  await expect(page.getByText('Ano').first()).toBeVisible();
  await expect(page.getByText('Intervalo').first()).toBeVisible();
  await expect(page.getByText('Receita total')).toBeVisible();
  await expect(page.getByText('Visao geral do mes')).toBeVisible();
  await expect(page.getByText('Receita por dia')).toBeVisible();
  await expect(page.getByText('Receita por mecanico')).toBeVisible();
  await expect(page.getByText('Receita por servico')).toHaveCount(0);
  await expect(page.getByText('Exportar CSV')).toHaveCount(0);
});

test('admin finance keeps custom date interval controls', async ({ page }) => {
  await loginAsAdmin(page);
  await page.goto('/(admin)/finance');
  await page.getByText('Intervalo').click();
  await expect(page.getByText('De')).toBeVisible();
  await expect(page.getByText('Ate')).toBeVisible();
  await expect(page.getByText(CURRENT_MONTH_FIRST_DAY, { exact: true })).toBeVisible();
  await page.getByText(CURRENT_MONTH_FIRST_DAY, { exact: true }).click();
  await expect(page.getByText('Dom')).toBeVisible();
  await expect(page.getByText('Seg')).toBeVisible();
  await page.getByRole('button', { name: '15' }).first().click();
  await expect(page.getByText(`15/${CURRENT_MONTH}`, { exact: true })).toBeVisible();
  await expect(page.getByPlaceholder('YYYY-MM-DD')).toHaveCount(0);
  await expect(page.getByPlaceholder('YYYY-MM')).toHaveCount(0);
  await expect(page.getByPlaceholder('YYYY')).toHaveCount(0);
});

test('admin finance period controls are click only', async ({ page }) => {
  await loginAsAdmin(page);
  await page.goto('/(admin)/finance');
  await expect(page.getByText(CURRENT_MONTH, { exact: true })).toBeVisible();
  await page.getByText('Ano').click();
  await expect(page.getByText(String(new Date().getFullYear()))).toBeVisible();
  await expect(page.getByPlaceholder('YYYY-MM')).toHaveCount(0);
  await expect(page.getByPlaceholder('YYYY')).toHaveCount(0);
});

test('admin appointments exposes not-finalized filter', async ({ page }) => {
  await loginAsAdmin(page);
  await page.goto('/(admin)/appointments');
  await expect(page.getByText('Nao finalizados')).toBeVisible();
});
