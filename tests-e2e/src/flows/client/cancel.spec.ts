import { expect, test, type Page } from '@playwright/test';

const SEEDED_CLIENT_EMAIL = 'mariana.costa@oficina.dev';
const SECOND_SEEDED_CLIENT_EMAIL = 'rafael.lima@oficina.dev';
const SEEDED_CLIENT_PASSWORD = 'SenhaDev123!';
const SEEDED_MECHANIC_ID = 'seed-mechanic-1';
const SERVER_URL = 'http://127.0.0.1:3010';
const APPOINTMENT_NOT_FOUND_MESSAGE = 'Agendamento não encontrado.';

async function loginAsSeededClient(page: Page) {
  await page.goto('/login');
  await page.getByTestId('login-email').fill(SEEDED_CLIENT_EMAIL);
  await page.getByTestId('login-password').fill(SEEDED_CLIENT_PASSWORD);
  await page.getByTestId('login-submit').click();
  await page.waitForURL('**/browse');
  await expect(page.getByTestId('browse-search')).toBeVisible();
}

async function bookAppointment(page: Page) {
  await page.goto('/browse');
  await page.getByTestId(`mechanic-card-${SEEDED_MECHANIC_ID}`).click();
  await page.waitForURL(`**/browse/${SEEDED_MECHANIC_ID}`);

  let selectedSlot = false;
  for (let dateIndex = 2; dateIndex <= 6; dateIndex += 1) {
    const availabilityResponse = page.waitForResponse((response) => {
      const url = new URL(response.url());
      return response.ok()
        && url.pathname === `/mechanics/${SEEDED_MECHANIC_ID}/timeslots`
        && url.searchParams.has('date');
    });
    await page.getByTestId(`date-chip-${dateIndex}`).click();
    await availabilityResponse;
    const slot = page.getByTestId(/^slot-button-/).first();
    if (await slot.count() > 0) {
      await slot.click();
      selectedSlot = true;
      break;
    }
  }
  expect(selectedSlot).toBe(true);
  await page.getByTestId('vehicle-model-input').fill('E2E Cancel Failure Vehicle');
  await page.getByTestId('problem-description-input').fill('E2E cancel failure problem');

  await Promise.all([
    page.waitForURL((url) => url.pathname === '/booking-success' && url.searchParams.has('id')),
    page.getByTestId('confirm-booking-button').click(),
  ]);
  const appointmentId = new URL(page.url()).searchParams.get('id');
  expect(appointmentId).toBeTruthy();
  return appointmentId!;
}

test('cancel failure shows APPOINTMENT_NOT_FOUND feedback on web', async ({ page }) => {
  await loginAsSeededClient(page);
  const appointmentId = await bookAppointment(page);
  await page.goto(`/appointment/${appointmentId}`);
  await expect(page.getByTestId('appointment-status')).toHaveText('Confirmado');

  const ownerToken = await page.evaluate(() => localStorage.getItem('auth_token'));
  expect(ownerToken).toBeTruthy();
  const secondLoginResponse = await page.request.post(`${SERVER_URL}/auth/login`, {
    data: {
      email: SECOND_SEEDED_CLIENT_EMAIL,
      password: SEEDED_CLIENT_PASSWORD,
    },
  });
  expect(secondLoginResponse.ok()).toBe(true);
  const { token: secondClientToken } = await secondLoginResponse.json() as { token: string };
  await page.evaluate((token) => localStorage.setItem('auth_token', token), secondClientToken);

  try {
    await page.getByTestId('cancel-appointment-button').click();
    const cancelResponse = page.waitForResponse((response) => (
      response.url() === `${SERVER_URL}/appointments/${appointmentId}/cancel`
      && response.request().method() === 'POST'
    ));
    await page.getByTestId('confirm-cancel-button').click();
    const response = await cancelResponse;
    expect(response.status()).toBe(404);
    await expect(response.json()).resolves.toMatchObject({ code: 'APPOINTMENT_NOT_FOUND' });
    const cancelError = page.getByTestId('cancel-error');
    await expect(cancelError.getByText(APPOINTMENT_NOT_FOUND_MESSAGE)).toHaveText(
      APPOINTMENT_NOT_FOUND_MESSAGE,
    );
    await expect(cancelError).toBeVisible();
  } finally {
    await page.request.post(`${SERVER_URL}/appointments/${appointmentId}/cancel`, {
      headers: { Authorization: `Bearer ${ownerToken}` },
    });
  }
});
