import { expect, test, type APIRequestContext, type Page } from '@playwright/test';

const SERVER_URL = 'http://127.0.0.1:3010';
const MECHANIC_EMAIL = 'carlos.silva@oficina.dev';
const CLIENT_EMAIL = 'mariana.costa@oficina.dev';
const PASSWORD = 'SenhaDev123!';
const MECHANIC_ID = 'seed-mechanic-1';
const CLIENT_NAME = 'Mariana Costa';
const CLIENT_PHONE = '+5511988880001';
const JOURNEY_DATE = '2099-12-15';

type AuthResponse = { token: string };
type TimeSlot = {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
};

function authorization(token: string) {
  return { Authorization: `Bearer ${token}` };
}

async function authenticate(request: APIRequestContext, email: string) {
  const response = await request.post(`${SERVER_URL}/auth/login`, {
    data: { email, password: PASSWORD },
  });
  expect(response.ok()).toBe(true);
  return (await response.json() as AuthResponse).token;
}

async function loginAsMechanic(page: Page) {
  await page.goto('/login');
  await page.getByTestId('login-email').fill(MECHANIC_EMAIL);
  await page.getByTestId('login-password').fill(PASSWORD);
  await Promise.all([
    page.waitForURL('**/agenda'),
    page.getByTestId('login-submit-button').click(),
  ]);
  await expect(page.getByText('Agenda', { exact: true }).first()).toBeVisible();
}

function toMinutes(time: string) {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

function formatTime(minutes: number) {
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}

function findThreeHourGap(slots: TimeSlot[]) {
  for (let start = 0; start <= 21 * 60; start += 60) {
    const end = start + 3 * 60;
    const overlaps = slots.some((slot) => start < toMinutes(slot.endTime) && end > toMinutes(slot.startTime));
    if (!overlaps) return formatTime(start);
  }
  throw new Error(`No three-hour gap available on ${JOURNEY_DATE}`);
}

function slotTestId(slot: TimeSlot) {
  return `availability-slot-${slot.date}-${slot.startTime.replace(':', '')}-${slot.endTime.replace(':', '')}`;
}

async function cleanJourneyData(
  request: APIRequestContext,
  mechanicToken: string,
  appointmentId: string | null,
  slots: TimeSlot[],
) {
  if (appointmentId) {
    await request.post(`${SERVER_URL}/appointments/${appointmentId}/cancel`, {
      headers: authorization(mechanicToken),
    }).catch(() => undefined);
  }
  for (const slot of slots) {
    await request.delete(`${SERVER_URL}/timeslots/${slot.id}`, {
      headers: authorization(mechanicToken),
    }).catch(() => undefined);
  }
}

test('mechanic publishes availability, sees every slot state, and completes an appointment', async ({ page, request }) => {
  const mechanicToken = await authenticate(request, MECHANIC_EMAIL);
  const clientToken = await authenticate(request, CLIENT_EMAIL);
  const existingResponse = await request.get(
    `${SERVER_URL}/mechanics/${MECHANIC_ID}/timeslots?date=${JOURNEY_DATE}&includeUnavailable=true`,
    { headers: authorization(mechanicToken) },
  );
  expect(existingResponse.ok()).toBe(true);
  const batchStart = findThreeHourGap(await existingResponse.json() as TimeSlot[]);
  let createdSlots: TimeSlot[] = [];
  let appointmentId: string | null = null;

  try {
    await loginAsMechanic(page);
    await page.goto('/availability');
    const dateResponse = page.waitForResponse((response) => {
      const url = new URL(response.url());
      return response.ok()
        && url.pathname === `/mechanics/${MECHANIC_ID}/timeslots`
        && url.searchParams.get('date') === JOURNEY_DATE;
    });
    await page.getByTestId('availability-date-input-web').fill(JOURNEY_DATE);
    await dateResponse;

    await page.getByText('Adicionar em lote', { exact: true }).click();
    await page.getByTestId('availability-batch-start-input').fill(batchStart);
    await page.getByTestId('availability-batch-count-input').fill('3');
    await page.getByTestId('availability-duration-60').click();
    const createResponsePromise = page.waitForResponse((response) => (
      response.url() === `${SERVER_URL}/timeslots`
      && response.request().method() === 'POST'
    ));
    await page.getByTestId('availability-create-batch-button').click();
    const createResponse = await createResponsePromise;
    expect(createResponse.ok()).toBe(true);
    createdSlots = await createResponse.json() as TimeSlot[];
    expect(createdSlots).toHaveLength(3);

    for (const slot of createdSlots) {
      await expect(page.getByTestId(slotTestId(slot))).toContainText('Disponível');
    }

    const blockedSlot = createdSlots[1];
    const toggleResponse = await request.patch(`${SERVER_URL}/timeslots/${blockedSlot.id}`, {
      headers: authorization(mechanicToken),
      data: { isAvailable: false },
    });
    expect(toggleResponse.ok()).toBe(true);

    const bookedSlot = createdSlots[2];
    const bookingResponse = await request.post(`${SERVER_URL}/appointments`, {
      headers: authorization(clientToken),
      data: {
        timeSlotId: bookedSlot.id,
        vehicleInfo: 'E2E Mechanic Journey Vehicle',
        notes: 'E2E mechanic journey booking',
      },
    });
    expect(bookingResponse.ok()).toBe(true);
    appointmentId = (await bookingResponse.json() as { id: string }).id;

    await page.reload();
    const refreshResponse = page.waitForResponse((response) => {
      const url = new URL(response.url());
      return response.ok()
        && url.pathname === `/mechanics/${MECHANIC_ID}/timeslots`
        && url.searchParams.get('date') === JOURNEY_DATE;
    });
    await page.getByTestId('availability-date-input-web').fill(JOURNEY_DATE);
    await refreshResponse;
    await expect(page.getByTestId(slotTestId(createdSlots[0]))).toContainText('Disponível');
    await expect(page.getByTestId(slotTestId(blockedSlot))).toContainText('Bloqueado');
    await expect(page.getByTestId(slotTestId(bookedSlot))).toContainText('Reservado');

    const agendaResponse = page.waitForResponse((response) => (
      response.ok()
      && new URL(response.url()).pathname === '/appointments'
      && response.request().method() === 'GET'
    ));
    await page.goto('/agenda');
    await agendaResponse;
    await page.getByText('Proximos', { exact: true }).click();
    const appointmentCard = page.getByTestId(`appointment-card-${appointmentId}`);
    await expect(appointmentCard).toContainText(CLIENT_NAME);
    await expect(appointmentCard).toContainText(CLIENT_PHONE);
    await appointmentCard.click();
    await page.waitForURL(`**/appointment/${appointmentId}`);
    await expect(page.getByTestId('appointment-client-name')).toHaveText(CLIENT_NAME);
    await expect(page.getByTestId('appointment-client-phone')).toHaveText(CLIENT_PHONE);

    await page.getByTestId('service-summary-input').fill('E2E journey service complete');
    await page.getByTestId('service-diagnosis-input').fill('E2E journey diagnosis');
    await page.getByTestId('service-work-input').fill('E2E journey work performed');
    await page.getByTestId('service-parts-input').fill('E2E journey parts used');
    await page.getByTestId('service-recommendations-input').fill('E2E journey recommendations');
    await page.getByTestId('service-item-description-0').fill('E2E journey priced item');
    await page.getByTestId('service-item-amount-0').fill('175,50');
    const finishResponsePromise = page.waitForResponse((response) => (
      response.url() === `${SERVER_URL}/appointments/${appointmentId}/complete`
      && response.request().method() === 'POST'
    ));
    await page.getByTestId('appointment-finish-button').click();
    expect((await finishResponsePromise).ok()).toBe(true);
    await page.waitForURL('**/agenda');

    const reportResponse = page.waitForResponse((response) => (
      response.ok()
      && new URL(response.url()).pathname === `/appointments/${appointmentId}`
      && response.request().method() === 'GET'
    ));
    await page.goto(`/appointment/${appointmentId}`);
    await reportResponse;
    await expect(page.getByText('E2E journey service complete', { exact: true })).toBeVisible();
    await expect(page.getByText('E2E journey work performed', { exact: true })).toBeVisible();
    await expect(page.getByText('E2E journey priced item', { exact: true })).toBeVisible();
  } finally {
    await cleanJourneyData(request, mechanicToken, appointmentId, createdSlots);
  }
});
