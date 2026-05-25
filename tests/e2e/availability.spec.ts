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

function slotTestId(date: string, start: string, end: string) {
  return `availability-slot-${date}-${start.replace(':', '')}-${end.replace(':', '')}`;
}

async function tryLogin(page: import('@playwright/test').Page, phone: string, password: string) {
  await page.goto('/(auth)/login');
  await page.getByPlaceholder('(51) 99999-9999').fill(phone);
  await page.getByPlaceholder('Digite sua senha').fill(password);
  await page.getByTestId('login-submit-button').click();
}
async function loginAsMechanic(page: import('@playwright/test').Page) {
  await tryLogin(page, DEFAULT_MECHANIC_PHONE, DEFAULT_MECHANIC_PASSWORD);
  return page.waitForURL(/\/(mechanic)\/(agenda|availability)|\/agenda|\/availability/, { timeout: 20000 })
    .then(() => true)
    .catch(() => false);
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
  test.skip(!(await loginAsMechanic(page)), 'Default mechanic E2E account unavailable.');
  await page.goto('/(mechanic)/availability');
  await expect(page.getByText('Gerenciar horarios')).toBeVisible();

  const yesterday = isoDateDaysFromToday(-1);
  await openAndSetDate(page, yesterday);
  await expect(page.getByText('Nao pode usar data no passado.')).toBeVisible();

  const smokeSeed = Date.now() % 20;
  const targetDate = isoDateDaysFromToday(15 + smokeSeed);
  const baseMinute = String((Date.now() % 4) * 10).padStart(2, '0');
  const baseStart = `08:${baseMinute}`;
  const baseEnd = `08:${String(Number(baseMinute) + 5).padStart(2, '0')}`;
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

  await fillTimeFields(page, baseStart.replace(':', ''), baseEnd.replace(':', ''));
  await page.getByTestId('availability-create-slot-button').click();
  await expect(page.getByText(new RegExp(`${baseStart}(:00)? - ${baseEnd}(:00)?`))).toBeVisible();

  const afterBaseCount = await page.getByText(/\d{2}:\d{2}(?::\d{2})? - \d{2}:\d{2}(?::\d{2})?/).count();
  expect(afterBaseCount).toBeGreaterThanOrEqual(beforeBaseCount + 1);

  const beforeQuickCount = await page.getByText(/\d{2}:\d{2}(?::\d{2})? - \d{2}:\d{2}(?::\d{2})?/).count();
  await page.getByTestId('availability-quick-60').click();
  await page.getByTestId('availability-create-slot-button').click();
  await expect
    .poll(async () => page.getByText(/\d{2}:\d{2}(?::\d{2})? - \d{2}:\d{2}(?::\d{2})?/).count(), { timeout: 20000 })
    .toBeGreaterThanOrEqual(beforeQuickCount + 1);

  const beforeBatchCount = await page.getByText(/\d{2}:\d{2}(?::\d{2})? - \d{2}:\d{2}(?::\d{2})?/).count();
  await page.getByText('Adicionar em lote').click();
  await page.getByTestId('availability-duration-90').click();
  await page.getByPlaceholder('3').fill('3');
  await page.getByTestId('availability-create-batch-button').click();
  await expect
    .poll(async () => page.getByText(/\d{2}:\d{2}(?::\d{2})? - \d{2}:\d{2}(?::\d{2})?/).count(), { timeout: 30000 })
    .toBeGreaterThanOrEqual(beforeBatchCount + 3);

  const overflowDate = isoDateDaysFromToday(36 + smokeSeed);
  await openAndSetDate(page, overflowDate);
  await page.getByText('Horario individual').click();
  await fillTimeFields(page, '2200', '2330');
  await page.getByText('Adicionar em lote').click();
  await page.getByTestId('availability-duration-90').click();
  await page.getByPlaceholder('3').fill('3');
  await page.getByTestId('availability-create-batch-button').click();
  await expect(page.getByText('Parou no item 1: intervalo passou de 23:59.')).toBeVisible();
});

test('availability deletes an available slot and keeps it deleted after refresh', async ({ page }) => {
  test.skip(!(await loginAsMechanic(page)), 'Default mechanic E2E account unavailable.');
  await page.goto('/(mechanic)/availability');
  await expect(page.getByText('Gerenciar horarios')).toBeVisible();

  const seed = Date.now() % 20;
  const targetDate = isoDateDaysFromToday(45 + seed);
  const minute = String((Date.now() % 4) * 10).padStart(2, '0');
  const start = `17:${minute}`;
  const end = `17:${String(Number(minute) + 5).padStart(2, '0')}`;
  const createdSlot = page.getByTestId(slotTestId(targetDate, start, end));

  await openAndSetDate(page, targetDate);
  if (await createdSlot.isVisible().catch(() => false)) {
    await createdSlot.getByTestId('availability-delete-slot-button').click();
    await page.getByTestId('availability-delete-confirm-button').click();
    await expect(createdSlot).toHaveCount(0, { timeout: 20000 });
  }

  await fillTimeFields(page, start.replace(':', ''), end.replace(':', ''));
  await page.getByTestId('availability-create-slot-button').click();
  await expect(createdSlot).toBeVisible({ timeout: 20000 });

  await createdSlot.getByTestId('availability-delete-slot-button').click();
  await expect(page.getByText('Excluir horario?')).toBeVisible();
  await page.getByTestId('availability-delete-confirm-button').click();
  await expect(createdSlot).toHaveCount(0, { timeout: 20000 });

  await page.reload();
  await expect(page.getByText('Gerenciar horarios')).toBeVisible();
  await openAndSetDate(page, targetDate);
  await expect(createdSlot).toHaveCount(0);
});
