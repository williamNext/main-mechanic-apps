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

test.describe('Mechanical Workshop Continuous Journey', () => {
  const password = 'password123';
  const mechanicPhone = '51999999001';
  const mechanicName = `E2E Mech ${Date.now()}`;
  const mechanicEmail = `e2e-mech-${Date.now()}@example.com`;
  const targetDate = isoDateDaysFromToday(5); // 5 days from today
  const targetDayNumber = targetDate.split('-')[2];

  test.beforeAll(async () => {
    // 1. Clean test tables
    await clearE2EData();
    // 2. Insert E2E Admin and E2E Client accounts
    await setupE2EUsers();
  });

  test('walks through entire workshop flow', async ({ context }) => {
    // Open separate page contexts for different actors
    const mechanicPage = await context.newPage();
    const adminPage = await context.newPage();
    const clientPage = await context.newPage();

    adminPage.on('console', msg => {
      console.log(`[ADMIN BROWSER CONSOLE] [${msg.type()}] ${msg.text()}`);
    });

    // Setup dialog handlers (React Native Web Alert.alert uses window.alert/confirm)
    mechanicPage.on('dialog', async (dialog) => {
      console.log(`Mechanic page dialog: ${dialog.message()}`);
      await dialog.accept();
    });
    clientPage.on('dialog', async (dialog) => {
      console.log(`Client page dialog: ${dialog.message()}`);
      await dialog.accept();
    });

    // ----------------------------------------------------
    // STEP 1: Admin Creates Mechanic
    // ----------------------------------------------------
    console.log('Step 1: Admin creating mechanic...');
    await loginAsAdmin(adminPage, password);
    await createMechanicFromAdmin(adminPage, {
      name: mechanicName,
      phone: mechanicPhone,
      email: mechanicEmail,
      password,
      specialty: 'Motor',
      credentials: 'CREA-E2E-001',
    });

    // ----------------------------------------------------
    // STEP 2: Mechanic Creates Availability Slots
    // ----------------------------------------------------
    console.log('Step 3: Mechanic logging in and setting availability...');
    await mechanicPage.goto('http://127.0.0.1:19006/(auth)/login');
    await mechanicPage.getByPlaceholder('(51) 99999-9999').fill(mechanicPhone);
    await mechanicPage.getByPlaceholder('Digite sua senha').fill(password);
    await mechanicPage.getByTestId('login-submit-button').click();

    await mechanicPage.waitForURL(/agenda|availability/, { timeout: 20000 });
    await mechanicPage.goto('http://127.0.0.1:19006/(mechanic)/availability');

    // Select target date in future
    await openAndSetDate(mechanicPage, targetDate);

    // Set time inputs
    const startInput = mechanicPage.getByTestId('availability-start-input');
    const endInput = mechanicPage.getByTestId('availability-end-input');
    await startInput.fill('');
    await startInput.type('0900');
    await endInput.fill('');
    await endInput.type('1000');

    // Click to add
    await mechanicPage.getByTestId('availability-create-slot-button').click();

    // Expect slot block to appear
    await expect(mechanicPage.getByText(/09:00 - 10:00/)).toBeVisible({ timeout: 15000 });

    // ----------------------------------------------------
    // STEP 4: Client Books Appointment
    // ----------------------------------------------------
    console.log('Step 4: Client logging in and booking appointment...');
    await clientPage.goto('http://127.0.0.1:19007/(auth)/login');
    await clientPage.getByPlaceholder('(51) 99999-9999').fill('51988880000');
    await clientPage.getByPlaceholder('Digite sua senha').fill(password);
    await clientPage.getByText('Entrar', { exact: true }).last().click();

    await clientPage.waitForURL(/browse/, { timeout: 20000 });

    // Search and click mechanic card
    await clientPage.getByPlaceholder('Buscar por nome ou especialidade...').fill(mechanicName);
    const mechCard = clientPage.getByText(mechanicName).first();
    await expect(mechCard).toBeVisible({ timeout: 15000 });
    await mechCard.click();

    // Wait for transition
    await clientPage.waitForTimeout(1000);

    // On booking screen: select date chip
    const dateChip = clientPage.getByText(targetDayNumber, { exact: true }).first();
    await expect(dateChip).toBeVisible({ timeout: 15000 });
    await dateChip.click();

    // Wait for slot loading
    await clientPage.waitForTimeout(1000);

    // Select time slot
    const timeSlotBtn = clientPage.getByText('09:00', { exact: true }).first();
    await expect(timeSlotBtn).toBeVisible({ timeout: 15000 });
    await timeSlotBtn.click();

    // Fill vehicle & description
    await clientPage.getByPlaceholder('Ex: Toyota Corolla 2020').fill('Toyota Corolla E2E');
    await clientPage.getByPlaceholder('Descreva o problema').fill('Revisao geral de motor');

    // Click submit
    await clientPage.getByText('Confirmar Agendamento', { exact: true }).click();

    // Verify success redirect
    await expect(clientPage.getByText('Agendamento Confirmado!')).toBeVisible({ timeout: 20000 });

    // ----------------------------------------------------
    // STEP 5: Mechanic Executes & Finalizes Service
    // ----------------------------------------------------
    console.log('Step 5: Mechanic finalizes the appointment...');
    await mechanicPage.goto('http://127.0.0.1:19006/(mechanic)/agenda');
    await mechanicPage.getByText('Proximos', { exact: true }).click();

    // Look for booked appointment in agenda
    const appointmentCard = mechanicPage.getByText('Toyota Corolla E2E').first();
    await expect(appointmentCard).toBeVisible({ timeout: 20000 });
    await appointmentCard.click();

    // Fill service closure report details
    await mechanicPage.getByTestId('service-summary-input').fill('E2E Review Finalized');
    await mechanicPage.getByTestId('service-diagnosis-input').fill('Normal wear on filters and plugs');
    await mechanicPage.getByTestId('service-work-input').fill('Engine diagnostic and filter change');
    await mechanicPage.getByTestId('service-parts-input').fill('Air filter, Spark plugs');
    await mechanicPage.getByTestId('service-recommendations-input').fill('Review brakes in 5000km');

    // Add service item
    await mechanicPage.getByTestId('service-item-description-0').fill('Diagnostics and replacement labor');
    await mechanicPage.getByTestId('service-item-amount-0').fill('250,00');

    // Submit closure form
    await mechanicPage.getByText('Finalizar servico', { exact: true }).click();

    // Verify redirection to agenda list
    await expect(mechanicPage).toHaveURL(/\/agenda/, { timeout: 20000 });

    // ----------------------------------------------------
    // STEP 6: Client Checks Status Updates
    // ----------------------------------------------------
    console.log('Step 6: Client verifying status has changed to acabado...');
    await clientPage.goto('http://127.0.0.1:19007/(client)/bookings');
    await clientPage.getByText('Histórico', { exact: true }).click();
    await clientPage.waitForTimeout(1000);

    // Click our booking item to see details
    const bookingListItem = clientPage.getByText('Toyota Corolla E2E').first();
    await expect(bookingListItem).toBeVisible({ timeout: 15000 });
    await bookingListItem.click();

    // Expect status finished (acabado) and summary visible
    await expect(clientPage.getByText('acabado', { exact: false }).first()).toBeVisible({ timeout: 15000 });
    await expect(clientPage.getByText('E2E Review Finalized')).toBeVisible({ timeout: 15000 });
    await expect(clientPage.getByText('R$ 250,00').first()).toBeVisible({ timeout: 15000 });

    // ----------------------------------------------------
    // STEP 7: Admin Dashboard and Finance Monitoring
    // ----------------------------------------------------
    console.log('Step 7: Admin verifying revenue is logged...');
    await adminPage.goto('http://127.0.0.1:19008/(admin)/dashboard');
    // Check total finished count and active mechanics count
    await expect(adminPage.getByText('Financeiro')).toBeVisible({ timeout: 15000 });

    await adminPage.goto('http://127.0.0.1:19008/(admin)/finance');
    // Expect revenue of 250 BRL to show
    await expect(adminPage.getByText('R$ 250,00').first()).toBeVisible({ timeout: 15000 });
    await expect(adminPage.getByText('Diagnostics and replacement labor').first()).toBeVisible({ timeout: 15000 });
  });
});
