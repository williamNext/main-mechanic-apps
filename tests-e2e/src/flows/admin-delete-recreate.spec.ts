import { expect, test } from '@playwright/test';
import { clearE2EData, setupE2EUsers, supabase } from '../helpers/db';

const password = 'password123';

async function loginAsAdmin(page: import('@playwright/test').Page) {
  await page.goto('http://127.0.0.1:19008/(auth)/login');
  await page.getByPlaceholder('11999999999').fill('51999999000');
  await page.getByPlaceholder('Senha').fill(password);
  await page.getByText('Entrar').click();
  await page.waitForURL(/\/(admin)\/dashboard|\/dashboard/, { timeout: 45000 });
}

async function createMechanicFromAdmin(
  page: import('@playwright/test').Page,
  params: { name: string; phone: string; email: string; specialty: string; credentials: string },
) {
  await page.goto('http://127.0.0.1:19008/(admin)/mechanics');
  await expect(page.getByText(/Diret/)).toBeVisible();
  await page.getByText(/Adicionar mec/i).click();
  await expect(page.getByText(/Adicionar Novo Mec/i)).toBeVisible();
  await page.getByPlaceholder(/Jo.o Silva/).fill(params.name);
  await page.getByPlaceholder(/99999-9999/).fill(params.phone);
  await page.getByPlaceholder(/joao@exemplo.com/).fill(params.email);
  await page.getByPlaceholder(/M.nimo 6 caracteres/).fill(password);
  await page.getByPlaceholder(/Motor/).fill(params.specialty);
  await page.getByPlaceholder(/CREA-123456/).fill(params.credentials);
  await page.getByText('Confirmar Cadastro').click();
  await expect(page.getByText(/Adicionar Novo Mec/i)).not.toBeVisible({ timeout: 20000 });
}

async function findAuthUserByEmail(email: string) {
  const { data, error } = await supabase.auth.admin.listUsers();
  if (error) throw error;
  return data.users.find((user) => user.email === email);
}

test.describe('Admin mechanic auth deletion', () => {
  test.beforeAll(async () => {
    await clearE2EData();
    await setupE2EUsers();
  });

  test('deletes mechanic auth user and recreates same credentials', async ({ page }) => {
    const email = `e2e-temp-recreate-${Date.now()}@example.com`;
    const phone = '51999999123';
    const firstName = `E2E Recreate ${Date.now()}`;
    const secondName = `${firstName} Again`;

    await loginAsAdmin(page);
    await createMechanicFromAdmin(page, {
      name: firstName,
      phone,
      email,
      specialty: 'Motor',
      credentials: 'CREA-RECREATE',
    });

    await expect.poll(() => findAuthUserByEmail(email)).toBeTruthy();

    await page.getByPlaceholder('Buscar').fill(firstName);
    await page.getByPlaceholder('Buscar').press('Enter');
    await expect(page.getByText(firstName)).toBeVisible({ timeout: 15000 });
    const row = page.getByTestId(/row-\d+/).filter({ hasText: firstName }).first();
    await row.getByRole('checkbox').click();
    await page.getByText('Excluir selecionados').click();
    await page.getByPlaceholder('EXCLUIR').fill('EXCLUIR');
    await page.getByPlaceholder('EXCLUIR').press('Enter');
    await expect(page.getByText('Excluir mecânicos selecionados')).not.toBeVisible({ timeout: 20000 });

    await expect.poll(() => findAuthUserByEmail(email)).toBeFalsy();

    await createMechanicFromAdmin(page, {
      name: secondName,
      phone,
      email,
      specialty: 'Motor',
      credentials: 'CREA-RECREATE',
    });

    await expect.poll(() => findAuthUserByEmail(email)).toBeTruthy();
    await page.getByPlaceholder('Buscar').fill(secondName);
    await page.getByPlaceholder('Buscar').press('Enter');
    await expect(page.getByText(secondName)).toBeVisible({ timeout: 15000 });
  });
});
