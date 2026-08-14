import { expect, test, type BrowserContext, type Page } from '@playwright/test';

const SEEDED_CLIENT_EMAIL = 'mariana.costa@oficina.dev';
const SECOND_SEEDED_CLIENT_EMAIL = 'rafael.lima@oficina.dev';
const SEEDED_CLIENT_PASSWORD = 'SenhaDev123!';
const SEEDED_MECHANIC_ID = 'seed-mechanic-1';
const SEEDED_MECHANIC_NAME = 'Carlos Silva';
const TIMESLOT_UNAVAILABLE_MESSAGE = 'Horário indisponível. Escolha outro.';

async function loginAsSeededClient(page: Page, email = SEEDED_CLIENT_EMAIL) {
  await page.goto('/login');
  await page.getByTestId('login-email').fill(email);
  await page.getByTestId('login-password').fill(SEEDED_CLIENT_PASSWORD);
  await page.getByTestId('login-submit').click();
  await page.waitForURL('**/browse');
  await expect(page.getByTestId('browse-search')).toBeVisible();
}

async function openSecondDateAvailability(page: Page) {
  await page.goto('/browse');
  const mechanicCard = page.getByTestId(`mechanic-card-${SEEDED_MECHANIC_ID}`);
  await expect(mechanicCard).toContainText(SEEDED_MECHANIC_NAME);
  await mechanicCard.click();
  await page.waitForURL(`**/browse/${SEEDED_MECHANIC_ID}`);

  const availabilityResponse = page.waitForResponse((response) => {
    const url = new URL(response.url());
    return response.ok()
      && url.pathname === `/mechanics/${SEEDED_MECHANIC_ID}/timeslots`
      && url.searchParams.has('date');
  });
  await page.getByTestId('date-chip-2').click();
  await availabilityResponse;
  await expect(page.getByTestId(/^slot-button-/).first()).toBeVisible();
}

async function selectFirstAvailableSlot(page: Page) {
  const slot = page.getByTestId(/^slot-button-/).first();
  const slotTestId = await slot.getAttribute('data-testid');
  expect(slotTestId).toMatch(/^slot-button-/);
  await slot.click();
  return slotTestId!;
}

async function fillBookingForm(page: Page, vehicle: string, problem: string) {
  await page.getByTestId('vehicle-model-input').fill(vehicle);
  await page.getByTestId('problem-description-input').fill(problem);
}

async function submitBooking(page: Page) {
  await Promise.all([
    page.waitForURL((url) => url.pathname === '/booking-success' && url.searchParams.has('id')),
    page.getByTestId('confirm-booking-button').click(),
  ]);
  await expect(page.getByTestId('booking-success-title')).toHaveText('Agendamento Confirmado!');
  const appointmentId = new URL(page.url()).searchParams.get('id');
  expect(appointmentId).toBeTruthy();
  return appointmentId!;
}

async function cancelAppointmentIfConfirmed(page: Page, appointmentId: string) {
  await page.goto(`/appointment/${appointmentId}`);
  const cancelButton = page.getByTestId('cancel-appointment-button');
  if (await cancelButton.isVisible().catch(() => false)) {
    await cancelButton.click();
    await page.getByTestId('confirm-cancel-button').click();
    await page.waitForURL('**/bookings');
  }
}

async function closeContext(context: BrowserContext) {
  await context.close().catch(() => undefined);
}

test('client books, finds, opens, cancels, and sees the freed slot again', async ({ page }) => {
  await loginAsSeededClient(page);
  await openSecondDateAvailability(page);
  const slotTestId = await selectFirstAvailableSlot(page);
  await fillBookingForm(page, 'E2E Happy Path Vehicle', 'E2E happy path problem');
  const appointmentId = await submitBooking(page);

  await page.goto('/bookings');
  const appointmentCard = page.getByTestId(`appointment-card-${appointmentId}`);
  await expect(appointmentCard).toBeVisible();
  await expect(appointmentCard).toContainText(SEEDED_MECHANIC_NAME);
  await appointmentCard.click();
  await page.waitForURL(`**/appointment/${appointmentId}`);
  await expect(page.getByTestId('appointment-status')).toHaveText('Confirmado');

  await page.getByTestId('cancel-appointment-button').click();
  await page.getByTestId('confirm-cancel-button').click();
  await page.waitForURL('**/bookings');
  await page.goto(`/appointment/${appointmentId}`);
  await expect(page.getByTestId('appointment-status')).toHaveText('Cancelado');

  await openSecondDateAvailability(page);
  await expect(page.getByTestId(slotTestId)).toBeVisible();
  await expect(page.getByTestId(slotTestId)).toBeEnabled();
});

test('stale availability loses a deterministic two-client booking race', async ({ browser }) => {
  const baseURL = test.info().project.use.baseURL;
  expect(typeof baseURL).toBe('string');
  const contextA = await browser.newContext({ baseURL: baseURL as string });
  const contextB = await browser.newContext({ baseURL: baseURL as string });
  const pageA = await contextA.newPage();
  const pageB = await contextB.newPage();
  let appointmentIdB: string | null = null;

  try {
    await loginAsSeededClient(pageA);
    await loginAsSeededClient(pageB, SECOND_SEEDED_CLIENT_EMAIL);
    await openSecondDateAvailability(pageA);
    await openSecondDateAvailability(pageB);

    const slotTestId = await selectFirstAvailableSlot(pageA);
    await expect(pageB.getByTestId(slotTestId)).toBeVisible();
    await pageB.getByTestId(slotTestId).click();
    await fillBookingForm(pageA, 'E2E Race Vehicle A', 'E2E race attempt A');
    await fillBookingForm(pageB, 'E2E Race Vehicle B', 'E2E race winner B');
    appointmentIdB = await submitBooking(pageB);

    await pageA.getByTestId('confirm-booking-button').click();
    await expect(pageA.getByTestId('booking-error')).toHaveText(TIMESLOT_UNAVAILABLE_MESSAGE);
    await expect(pageA.getByTestId(slotTestId)).toHaveCount(0);

    await pageB.goto('/bookings');
    const winningCard = pageB.getByTestId(`appointment-card-${appointmentIdB}`);
    await expect(winningCard).toHaveCount(1);
    await expect(winningCard).toContainText(SEEDED_MECHANIC_NAME);
    await expect(winningCard).toContainText('E2E Race Vehicle B');

    await pageA.goto('/bookings');
    await expect(pageA.getByTestId(`appointment-card-${appointmentIdB}`)).toHaveCount(0);
    await expect(
      pageA.getByTestId(/^appointment-card-/).filter({ hasText: 'E2E Race Vehicle A' }),
    ).toHaveCount(0);
  } finally {
    if (appointmentIdB) {
      await cancelAppointmentIfConfirmed(pageB, appointmentIdB).catch(() => undefined);
    }
    await closeContext(contextA);
    await closeContext(contextB);
  }
});
