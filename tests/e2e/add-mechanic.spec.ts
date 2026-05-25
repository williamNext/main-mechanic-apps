import { expect, test } from '@playwright/test';

const ADMIN_IDENTIFIER = process.env.ADMIN_E2E_IDENTIFIER || '11999999999';
const ADMIN_PASSWORD = process.env.ADMIN_E2E_PASSWORD || 'admin';

async function loginAsAdmin(page: import('@playwright/test').Page) {
  await page.goto('/(auth)/login');
  await page.getByPlaceholder('11999999999').fill(ADMIN_IDENTIFIER);
  await page.getByPlaceholder('Senha').fill(ADMIN_PASSWORD);
  await page.getByPlaceholder('Senha').press('Enter');
  await page.waitForURL(/\/(admin)\/dashboard|\/dashboard/, { timeout: 20000 });
}

test('add a new mechanic via UI', async ({ page }) => {
  await loginAsAdmin(page);
  await page.goto('/(admin)/mechanics');
  
  // Wait for directory shell
  await expect(page.getByText('Diretório')).toBeVisible();

  // Click Adicionar mecânico button
  const addButton = page.getByText('Adicionar mecânico');
  await expect(addButton).toBeVisible();
  await addButton.click();

  // Wait for the modal title to appear
  const modalTitle = page.getByText('Adicionar Novo Mecânico');
  await expect(modalTitle).toBeVisible();

  // Fill in the form fields with unique values to avoid conflicts
  const uniqueId = Math.floor(100000 + Math.random() * 900000);
  const testName = `Mecânico Teste ${uniqueId}`;
  const testPhone = `11977${uniqueId}`;
  const testEmail = `recovery-${uniqueId}@example.com`;
  const testPassword = `pass-${uniqueId}`;
  const testSpecialty = `Freios e Embreagens`;
  const testCredentials = `CREA-${uniqueId}`;

  await page.getByPlaceholder('Ex: João Silva').fill(testName);
  await page.getByPlaceholder('Ex: (11) 99999-9999').fill(testPhone);
  await page.getByPlaceholder('Ex: joao@exemplo.com').fill(testEmail);
  await page.getByPlaceholder('Mínimo 6 caracteres').fill(testPassword);
  await page.getByPlaceholder('Ex: Motor, Suspensão').fill(testSpecialty);
  await page.getByPlaceholder('Ex: CREA-123456').fill(testCredentials);

  // Press Enter on the last input to confirm registration
  await page.getByPlaceholder('Ex: CREA-123456').press('Enter');

  // Wait for modal to disappear
  await expect(modalTitle).not.toBeVisible({ timeout: 15000 });

  // Search for the newly created mechanic to verify they are in the directory
  const searchInput = page.getByPlaceholder('Buscar');
  await expect(searchInput).toBeVisible();
  await searchInput.fill(testName);

  // Press Enter on search input to search
  await searchInput.press('Enter');

  // Wait for loading to finish
  await expect(page.getByText('Carregando')).not.toBeVisible({ timeout: 15000 });

  // Verify the mechanic's name and specialty are shown in the results list
  await expect(page.getByText(testName)).toBeVisible();
  await expect(page.getByText(testSpecialty)).toBeVisible();
});
