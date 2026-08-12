import { expect, test } from '@playwright/test';
import { clearE2EData, setupE2EUsers } from '../helpers/db';

function isoDateDaysFromToday(daysFromToday: number) {
  const date = new Date();
  date.setDate(date.getDate() + daysFromToday);
  const yyyy = date.getFullYear();
  const mm = `${date.getMonth() + 1}`.padStart(2, '0');
  const dd = `${date.getDate()}`.padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

async function openAndSetDate(page: import('@playwright/test').Page, isoDate: string) {
  const webDateInput = page.getByTestId('availability-date-input-web');
  try {
    await webDateInput.waitFor({ state: 'visible', timeout: 5000 });
    await webDateInput.fill(isoDate);
  } catch {
    await page.getByTestId('availability-date-trigger').click();
    const pickerInput = page.locator('input[type="date"]');
    await expect(pickerInput).toBeVisible();
    await pickerInput.fill(isoDate);
    await pickerInput.dispatchEvent('change');
  }
}

async function loginAsAdmin(page: import('@playwright/test').Page, password: string) {
  await page.goto('http://127.0.0.1:19008/(auth)/login');
  await page.getByPlaceholder('11999999999').fill('51999999000');
  await page.getByPlaceholder('Senha').fill(password);
  await page.getByText('Entrar').click();
  await page.waitForURL(/\/(admin)\/dashboard|\/dashboard/, { timeout: 45000 });
}

async function createMechanicFromAdmin(
  page: import('@playwright/test').Page,
  params: { name: string; phone: string; email: string; password: string; specialty: string; credentials: string },
) {
  await page.goto('http://127.0.0.1:19008/(admin)/mechanics');
  await expect(page.getByText(/Diret/)).toBeVisible();
  await page.getByText(/Adicionar mec/i).click();
  await expect(page.getByText(/Adicionar Novo Mec/i)).toBeVisible();
  await page.getByPlaceholder(/Jo.o Silva/).fill(params.name);
  await page.getByPlaceholder(/99999-9999/).fill(params.phone);
  await page.getByPlaceholder(/joao@exemplo.com/).fill(params.email);
  await page.getByPlaceholder(/M.nimo 6 caracteres/).fill(params.password);
  await page.getByPlaceholder(/Motor/).fill(params.specialty);
  await page.getByPlaceholder(/CREA-123456/).fill(params.credentials);
  await page.getByText('Confirmar Cadastro').click();
  await expect(page.getByText(/Adicionar Novo Mec/i)).not.toBeVisible({ timeout: 20000 });
}

test.describe('Mechanical Workshop Cancellations and Validations', () => {
  const password = 'password123';
  const mechanicPhone = '51999999002'; // use a different E2E phone number for this test file
  const mechanicName = `E2E Validation Mech ${Date.now()}`;
  const mechanicEmail = `e2e-validation-mech-${Date.now()}@example.com`;
  const targetDate = isoDateDaysFromToday(6);
  const targetDayNumber = targetDate.split('-')[2];

  test.beforeAll(async () => {
    await clearE2EData();
    await setupE2EUsers();
  });

  test('validates availability constraints and processes cancellation flow', async ({ context }) => {
    const mechanicPage = await context.newPage();
    const clientPage = await context.newPage();
    const adminPage = await context.newPage();

    mechanicPage.on('dialog', async (dialog) => {
      await dialog.accept();
    });

    // ----------------------------------------------------
    // SETUP: Admin Creates Mechanic
    // ----------------------------------------------------
    await loginAsAdmin(adminPage, password);
    await createMechanicFromAdmin(adminPage, {
      name: mechanicName,
      phone: mechanicPhone,
      email: mechanicEmail,
      password,
      specialty: 'Freios',
      credentials: 'CREA-E2E-002',
    });

    // ----------------------------------------------------
    // TEST: Past Date & Invalid Time Validations
    // ----------------------------------------------------
    await mechanicPage.goto('http://127.0.0.1:19006/(auth)/login');
    await mechanicPage.getByPlaceholder('(51) 99999-9999').fill(mechanicPhone);
    await mechanicPage.getByPlaceholder('Digite sua senha').fill(password);
    await mechanicPage.getByTestId('login-submit-button').click();

    await mechanicPage.waitForURL(/agenda|availability/, { timeout: 20000 });
    await mechanicPage.goto('http://127.0.0.1:19006/(mechanic)/availability');

    // Past Date Validation
    const yesterday = isoDateDaysFromToday(-1);
    await openAndSetDate(mechanicPage, yesterday);
    await expect(mechanicPage.getByText('Nao pode usar data no passado.')).toBeVisible({ timeout: 15000 });

    // End Time before Start Time Validation
    await openAndSetDate(mechanicPage, targetDate);
    const startInput = mechanicPage.getByTestId('availability-start-input');
    const endInput = mechanicPage.getByTestId('availability-end-input');
    await startInput.fill('');
    await startInput.type('1000');
    await endInput.fill('');
    await endInput.type('0900');
    await mechanicPage.getByTestId('availability-create-slot-button').click();
    await expect(mechanicPage.getByText('Horario final deve ser maior que o inicial.')).toBeVisible({ timeout: 15000 });

    // Correct the timeslots & create
    await startInput.fill('');
    await startInput.type('1400');
    await endInput.fill('');
    await endInput.type('1500');
    await mechanicPage.getByTestId('availability-create-slot-button').click();
    await expect(mechanicPage.getByText(/14:00 - 15:00/)).toBeVisible({ timeout: 15000 });

    // ----------------------------------------------------
    // TEST: Client Booking and Cancellation Flow
    // ----------------------------------------------------
    await clientPage.goto('http://127.0.0.1:19007/(auth)/login');
    await clientPage.getByPlaceholder('(51) 99999-9999').fill('51988880000');
    await clientPage.getByPlaceholder('Digite sua senha').fill(password);
    await clientPage.getByText('Entrar', { exact: true }).last().click();
    await clientPage.waitForURL(/browse/, { timeout: 20000 });

    // Browse and click mechanic
    await clientPage.getByPlaceholder('Buscar por nome ou especialidade...').fill(mechanicName);
    const mechCard = clientPage.getByText(mechanicName).first();
    await mechCard.click();

    // Wait for transition
    await clientPage.waitForTimeout(1000);

    // Select date & time
    const dateChip = clientPage.getByText(targetDayNumber, { exact: true }).first();
    await dateChip.click();

    // Wait for slot loading
    await clientPage.waitForTimeout(1000);

    const timeSlotBtn = clientPage.getByText('14:00', { exact: true }).first();
    await timeSlotBtn.click();

    // Fill booking
    await clientPage.getByPlaceholder('Ex: Toyota Corolla 2020').fill('Ford Fiesta E2E');
    await clientPage.getByPlaceholder('Descreva o problema').fill('Pastilha rangendo');
    await clientPage.getByText('Confirmar Agendamento', { exact: true }).click();
    await expect(clientPage.getByText('Agendamento Confirmado!')).toBeVisible({ timeout: 20000 });

    // Navigate to bookings list and click the Ford Fiesta booking
    await clientPage.goto('http://127.0.0.1:19007/(client)/bookings');
    const bookingItem = clientPage.getByText('Ford Fiesta E2E').first();
    await expect(bookingItem).toBeVisible({ timeout: 15000 });
    await bookingItem.click();

    // Click Cancel
    await clientPage.getByText('Cancelar Agendamento', { exact: true }).click();
    // Confirm Cancel in Modal
    await clientPage.getByText('Sim, cancelar', { exact: true }).click();

    // Wait for modal animation to completely finish and overlay to disappear
    await expect(clientPage.getByText('Sim, cancelar')).toBeHidden({ timeout: 10000 });

    // Verify redirected to bookings and status is updated
    await expect(clientPage).toHaveURL(/bookings/, { timeout: 20000 });
    
    // Since appointment is cancelled, click 'Histórico' segment to see it
    await clientPage.getByText('Histórico', { exact: true }).click();
    await clientPage.waitForTimeout(1000);

    // Go to booking details again and verify status is 'cancelado'
    await clientPage.getByText('Ford Fiesta E2E').first().click();
    await expect(clientPage.getByText('cancelado', { exact: false }).first()).toBeVisible({ timeout: 15000 });
  });
});
