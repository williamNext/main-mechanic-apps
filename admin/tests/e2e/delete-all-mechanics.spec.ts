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

test('delete all mechanics via UI', async ({ page }) => {
  await loginAsAdmin(page);
  await page.goto('/(admin)/mechanics');
  
  // Wait for the mechanics directory shell to load
  await expect(page.getByText('Diretório')).toBeVisible();

  let hasMechanics = true;
  let attempt = 0;

  while (hasMechanics && attempt < 15) {
    attempt++;
    console.log(`Deletion iteration ${attempt}...`);

    // Wait for the LoadingState to disappear
    await expect(page.getByText('Carregando')).not.toBeVisible({ timeout: 15000 });

    // Check if the "Sem mecânicos" empty state is visible
    const emptyState = page.getByText('Sem mecânicos');
    if (await emptyState.isVisible()) {
      console.log('No mechanics left (empty state visible).');
      hasMechanics = false;
      break;
    }

    // Check if the select all checkbox is visible (indicating rows exist)
    const selectAllCheckbox = page.getByTestId('select-all-mechanics');
    if (!await selectAllCheckbox.isVisible()) {
      console.log('Select all checkbox not found. No mechanics left.');
      hasMechanics = false;
      break;
    }

    // Select all visible mechanics on this page
    await selectAllCheckbox.click();

    // Locate the "Excluir selecionados" button by text
    const deleteButton = page.getByText('Excluir selecionados');
    await expect(deleteButton).toBeVisible();

    // Click "Excluir selecionados"
    await deleteButton.click();

    // Wait for the confirmation modal to be visible
    const modalTitle = page.getByText('Excluir mecânicos selecionados');
    await expect(modalTitle).toBeVisible();

    // Fill in "EXCLUIR" into the text input and press Enter
    const input = page.getByPlaceholder('EXCLUIR');
    await input.fill('EXCLUIR');
    await input.press('Enter');

    // Wait for modal to disappear
    await expect(modalTitle).not.toBeVisible();
    console.log(`Batch ${attempt} deleted.`);
  }

  // Final validation
  // Wait for loading to finish one last time
  await expect(page.getByText('Carregando')).not.toBeVisible({ timeout: 15000 });
  await expect(page.getByText('Sem mecânicos')).toBeVisible();
  console.log('All mechanics successfully deleted.');
});
