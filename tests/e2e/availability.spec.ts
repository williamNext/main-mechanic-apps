import { expect, test } from '@playwright/test';

const DEFAULT_MECHANIC_PHONE = '51999990001';
const DEFAULT_MECHANIC_PASSWORD = process.env.MECHANIC_DEFAULT_PASSWORD || 'password123';

function isoDateDaysFromToday(daysFromToday: number) {
  const date = new Date();
  date.setDate(date.getDate() + daysFromToday);
  const yyyy = date.getFullYear();
  const mm = `${date.getMonth() + 1}`.padStart(2, '0');
  const dd = `${date.getDate()}`.padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

async function tryLogin(page: import('@playwright/test').Page, phone: string, password: string) {
  await page.goto('/(auth)/login');
  await page.getByPlaceholder('(51) 99999-9999').fill(phone);
  await page.getByPlaceholder('Digite sua senha').fill(password);
  await page.getByTestId('login-submit-button').click();
}

async function registerMechanic(page: import('@playwright/test').Page, phone: string, password: string) {
  await page.goto('/(auth)/register');
  await page.getByTestId('register-name-input').fill(`E2E Mechanic ${Date.now()}`);
  await page.getByTestId('register-phone-input').fill(phone);
  await page.getByTestId('register-password-input').fill(password);
  await page.getByTestId('register-submit-button').click();
  await expect(page.getByText(/Perfil de mecanico criado|already registered|ja cadastrado/i)).toBeVisible();
}

async function loginAsMechanic(page: import('@playwright/test').Page) {
  await tryLogin(page, DEFAULT_MECHANIC_PHONE, DEFAULT_MECHANIC_PASSWORD);
  try {
    await page.waitForURL(/\/(mechanic)\/(agenda|availability)|\/agenda|\/availability/, { timeout: 6000 });
    return;
  } catch {
    const randomPhone = `519${Math.floor(10000000 + Math.random() * 89999999)}`;
    const randomPassword = `Pw!${Date.now()}`;
    await registerMechanic(page, randomPhone, randomPassword);
    await tryLogin(page, randomPhone, randomPassword);
  }
  await page.waitForURL(/\/(mechanic)\/(agenda|availability)|\/agenda|\/availability/);
}

async function openAndSetDate(page: import('@playwright/test').Page, isoDate: string) {
  const webDateInput = page.getByTestId('availability-date-input-web');
  if (await webDateInput.isVisible()) {
    await webDateInput.fill(isoDate);
    return;
  }
  await page.getByTestId('availability-date-trigger').click();
  const pickerInput = page.locator('input[type="date"]');
  await expect(pickerInput).toBeVisible();
  await pickerInput.fill(isoDate);
  await pickerInput.dispatchEvent('change');
}

async function fillTimeFields(page: import('@playwright/test').Page, start: string, end: string) {
  const startInput = page.getByTestId('availability-start-input');
  const endInput = page.getByTestId('availability-end-input');
  await startInput.fill('');
  await endInput.fill('');
  await startInput.type(start);
  await endInput.type(end);
}

test('availability flow smoke', async ({ page }) => {
  await loginAsMechanic(page);
  await page.goto('/(mechanic)/availability');
  await expect(page.getByText('Gerenciar horarios')).toBeVisible();

  const yesterday = isoDateDaysFromToday(-1);
  await openAndSetDate(page, yesterday);
  await expect(page.getByText('Nao pode usar data no passado.')).toBeVisible();

  const targetDate = isoDateDaysFromToday(10);
  await openAndSetDate(page, targetDate);

  const startInput = page.getByTestId('availability-start-input');
  await startInput.fill('');
  await startInput.type('930');
  await expect(startInput).toHaveValue('93:0');

  await page.getByTestId('availability-create-slot-button').click();
  await expect(page.getByText('Use horario no formato HH:mm.')).toBeVisible();

  await fillTimeFields(page, '1000', '0900');
  await page.getByTestId('availability-create-slot-button').click();
  await expect(page.getByText('Horario final deve ser maior que o inicial.')).toBeVisible();

  const rangesBeforeBase = page.getByText(/\d{2}:\d{2}(?::\d{2})? - \d{2}:\d{2}(?::\d{2})?/);
  const beforeBaseCount = await rangesBeforeBase.count();

  await fillTimeFields(page, '0800', '0900');
  await page.getByTestId('availability-create-slot-button').click();
  await expect(page.getByText(/08:00(:00)? - 09:00(:00)?/)).toBeVisible();

  const afterBaseCount = await page.getByText(/\d{2}:\d{2}(?::\d{2})? - \d{2}:\d{2}(?::\d{2})?/).count();
  expect(afterBaseCount).toBeGreaterThanOrEqual(beforeBaseCount + 1);

  const beforeQuickCount = await page.getByText(/\d{2}:\d{2}(?::\d{2})? - \d{2}:\d{2}(?::\d{2})?/).count();
  await page.getByTestId('availability-quick-60').click();
  await expect
    .poll(async () => page.getByText(/\d{2}:\d{2}(?::\d{2})? - \d{2}:\d{2}(?::\d{2})?/).count(), { timeout: 20000 })
    .toBeGreaterThanOrEqual(beforeQuickCount + 1);

  const beforeBatchCount = await page.getByText(/\d{2}:\d{2}(?::\d{2})? - \d{2}:\d{2}(?::\d{2})?/).count();
  await page.getByTestId('availability-duration-90').click();
  await page.getByPlaceholder('3').fill('3');
  await page.getByTestId('availability-create-batch-button').click();
  await expect
    .poll(async () => page.getByText(/\d{2}:\d{2}(?::\d{2})? - \d{2}:\d{2}(?::\d{2})?/).count(), { timeout: 30000 })
    .toBeGreaterThanOrEqual(beforeBatchCount + 3);

  const overflowDate = isoDateDaysFromToday(11);
  await openAndSetDate(page, overflowDate);
  await fillTimeFields(page, '2200', '2330');
  await page.getByTestId('availability-duration-90').click();
  await page.getByPlaceholder('3').fill('3');
  await page.getByTestId('availability-create-batch-button').click();
  await expect(page.getByText('Parou no item 1: intervalo passou de 23:59.')).toBeVisible();
});
