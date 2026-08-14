import {
  expect,
  test,
  type APIRequestContext,
  type BrowserContext,
  type Page,
} from '@playwright/test';

const SERVER_URL = 'http://127.0.0.1:3010';
const MECHANIC_URL = 'http://127.0.0.1:19008';
const CLIENT_EMAIL = 'mariana.costa@oficina.dev';
const MECHANIC_EMAIL = 'carlos.silva@oficina.dev';
const PASSWORD = 'SenhaDev123!';
const MECHANIC_ID = 'seed-mechanic-1';
const MECHANIC_NAME = 'Carlos Silva';
const CLIENT_NAME = 'Mariana Costa';
const CLIENT_PHONE = '+5511988880001';

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

async function loginAsClient(page: Page) {
  await page.goto('/login');
  await page.getByTestId('login-email').fill(CLIENT_EMAIL);
  await page.getByTestId('login-password').fill(PASSWORD);
  await Promise.all([
    page.waitForURL('**/browse'),
    page.getByTestId('login-submit').click(),
  ]);
  await expect(page.getByTestId('browse-search')).toBeVisible();
}

async function loginAsMechanic(page: Page) {
  await page.goto('/login');
  await page.getByTestId('login-email').fill(MECHANIC_EMAIL);
  await page.getByTestId('login-password').fill(PASSWORD);
  await Promise.all([
    page.waitForURL('**/agenda'),
    page.getByTestId('login-submit-button').click(),
  ]);
}

function toMinutes(time: string) {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

function formatTime(minutes: number) {
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}

function findThirtyMinuteGap(slots: TimeSlot[]) {
  for (let start = 0; start <= 23 * 60 + 30; start += 30) {
    const end = start + 30;
    const overlaps = slots.some((slot) => start < toMinutes(slot.endTime) && end > toMinutes(slot.startTime));
    if (!overlaps) return { startTime: formatTime(start), endTime: formatTime(end) };
  }
  throw new Error('No thirty-minute gap available for cross-app appointment');
}

async function closeContext(context: BrowserContext | null) {
  await context?.close().catch(() => undefined);
}

test('client books, mechanic completes, and client reads the ordered report', async ({ browser, request }) => {
  const clientBaseURL = test.info().project.use.baseURL;
  expect(typeof clientBaseURL).toBe('string');
  const mechanicToken = await authenticate(request, MECHANIC_EMAIL);
  let clientContext: BrowserContext | null = null;
  let mechanicContext: BrowserContext | null = null;
  let disposableSlot: TimeSlot | null = null;
  let appointmentId: string | null = null;

  try {
    clientContext = await browser.newContext({ baseURL: clientBaseURL as string });
    const clientPage = await clientContext.newPage();
    await loginAsClient(clientPage);
    await clientPage.goto('/browse');
    const initialAvailabilityPromise = clientPage.waitForResponse((response) => {
      const url = new URL(response.url());
      return response.ok()
        && url.pathname === `/mechanics/${MECHANIC_ID}/timeslots`
        && url.searchParams.has('date');
    });
    await clientPage.getByTestId(`mechanic-card-${MECHANIC_ID}`).click();
    await clientPage.waitForURL(`**/browse/${MECHANIC_ID}`);
    await initialAvailabilityPromise;

    const targetAvailabilityPromise = clientPage.waitForResponse((response) => {
      const url = new URL(response.url());
      return response.ok()
        && url.pathname === `/mechanics/${MECHANIC_ID}/timeslots`
        && url.searchParams.has('date');
    });
    await clientPage.getByTestId('date-chip-5').click();
    const targetAvailability = await targetAvailabilityPromise;
    const targetDate = new URL(targetAvailability.url()).searchParams.get('date');
    if (!targetDate) throw new Error('Selected client date was absent from availability request');

    const ownerSlotsResponse = await request.get(
      `${SERVER_URL}/mechanics/${MECHANIC_ID}/timeslots?date=${targetDate}&includeUnavailable=true`,
      { headers: authorization(mechanicToken) },
    );
    expect(ownerSlotsResponse.ok()).toBe(true);
    const gap = findThirtyMinuteGap(await ownerSlotsResponse.json() as TimeSlot[]);
    const createSlotResponse = await request.post(`${SERVER_URL}/timeslots`, {
      headers: authorization(mechanicToken),
      data: { date: targetDate, ...gap },
    });
    expect(createSlotResponse.ok()).toBe(true);
    const createdSlots = await createSlotResponse.json() as TimeSlot[];
    if (!createdSlots[0]) throw new Error('Timeslot creation returned no slot');
    disposableSlot = createdSlots[0];

    const otherAvailabilityPromise = clientPage.waitForResponse((response) => {
      const url = new URL(response.url());
      return response.ok()
        && url.pathname === `/mechanics/${MECHANIC_ID}/timeslots`
        && url.searchParams.has('date');
    });
    await clientPage.getByTestId('date-chip-4').click();
    await otherAvailabilityPromise;
    const refreshedAvailabilityPromise = clientPage.waitForResponse((response) => {
      const url = new URL(response.url());
      return response.ok()
        && url.pathname === `/mechanics/${MECHANIC_ID}/timeslots`
        && url.searchParams.get('date') === targetDate;
    });
    await clientPage.getByTestId('date-chip-5').click();
    await refreshedAvailabilityPromise;
    await clientPage.getByTestId(`slot-button-${disposableSlot.id}`).click();
    await clientPage.getByTestId('vehicle-model-input').fill('E2E Cross-App Vehicle');
    await clientPage.getByTestId('problem-description-input').fill('E2E cross-app problem');
    await Promise.all([
      clientPage.waitForURL((url) => url.pathname === '/booking-success' && url.searchParams.has('id')),
      clientPage.getByTestId('confirm-booking-button').click(),
    ]);
    appointmentId = new URL(clientPage.url()).searchParams.get('id');
    expect(appointmentId).toBeTruthy();

    mechanicContext = await browser.newContext({ baseURL: MECHANIC_URL });
    const mechanicPage = await mechanicContext.newPage();
    await loginAsMechanic(mechanicPage);
    await mechanicPage.getByText('Proximos', { exact: true }).click();
    const appointmentCard = mechanicPage.getByTestId(`appointment-card-${appointmentId}`);
    await expect(appointmentCard).toContainText(CLIENT_NAME);
    await expect(appointmentCard).toContainText(CLIENT_PHONE);
    await appointmentCard.click();
    await mechanicPage.waitForURL(`**/appointment/${appointmentId}`);

    await mechanicPage.getByTestId('service-summary-input').fill('Cross-app completed service');
    await mechanicPage.getByTestId('service-diagnosis-input').fill('Cross-app confirmed diagnosis');
    await mechanicPage.getByTestId('service-work-input').fill('Cross-app work performed');
    await mechanicPage.getByTestId('service-parts-input').fill('Cross-app parts used');
    await mechanicPage.getByTestId('service-recommendations-input').fill('Cross-app recommendations');
    await mechanicPage.getByTestId('service-item-description-0').fill('Cross-app first line');
    await mechanicPage.getByTestId('service-item-amount-0').fill('125,00');
    await mechanicPage.getByTestId('service-add-item-button').click();
    await mechanicPage.getByTestId('service-item-description-1').fill('Cross-app second line');
    await mechanicPage.getByTestId('service-item-amount-1').fill('225,00');
    const finishResponsePromise = mechanicPage.waitForResponse((response) => (
      response.url() === `${SERVER_URL}/appointments/${appointmentId}/complete`
      && response.request().method() === 'POST'
    ));
    await mechanicPage.getByTestId('appointment-finish-button').click();
    expect((await finishResponsePromise).ok()).toBe(true);
    await mechanicPage.waitForURL('**/agenda');

    const clientReportPromise = clientPage.waitForResponse((response) => (
      response.ok()
      && new URL(response.url()).pathname === `/appointments/${appointmentId}`
      && response.request().method() === 'GET'
    ));
    await clientPage.goto(`/appointment/${appointmentId}`);
    await clientReportPromise;
    await expect(clientPage.getByText(MECHANIC_NAME, { exact: true })).toBeVisible();
    await expect(clientPage.getByText('Cross-app completed service', { exact: true })).toBeVisible();
    await expect(clientPage.getByText('Cross-app confirmed diagnosis', { exact: true })).toBeVisible();
    await expect(clientPage.getByText('Cross-app work performed', { exact: true })).toBeVisible();
    await expect(clientPage.getByText('Cross-app parts used', { exact: true })).toBeVisible();
    await expect(clientPage.getByText('Cross-app recommendations', { exact: true })).toBeVisible();
    const orderedItems = clientPage.getByText(/^Cross-app (first|second) line$/);
    await expect(orderedItems).toHaveCount(2);
    await expect.poll(() => orderedItems.allTextContents()).toEqual([
      'Cross-app first line',
      'Cross-app second line',
    ]);
    await expect(clientPage.getByText('R$ 350,00', { exact: true }).first()).toBeVisible();
  } finally {
    if (appointmentId) {
      await request.post(`${SERVER_URL}/appointments/${appointmentId}/cancel`, {
        headers: authorization(mechanicToken),
      }).catch(() => undefined);
    }
    if (disposableSlot) {
      await request.delete(`${SERVER_URL}/timeslots/${disposableSlot.id}`, {
        headers: authorization(mechanicToken),
      }).catch(() => undefined);
    }
    await closeContext(mechanicContext);
    await closeContext(clientContext);
  }
});
