import {
  expect,
  test,
  type APIRequestContext,
  type BrowserContext,
  type Page,
} from '@playwright/test';

const SERVER_URL = 'http://127.0.0.1:3010';
const CLIENT_URL = 'http://127.0.0.1:19007';
const ADMIN_EMAIL = 'admin@oficina.dev';
const CLIENT_EMAIL = 'mariana.costa@oficina.dev';
const PASSWORD = 'SenhaDev123!';

type AuthResponse = { token: string };
type Mechanic = { id: string; name: string; email?: string | null };
type MechanicsResponse = { rows: Mechanic[] };

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

async function loginAsAdmin(page: Page) {
  await page.goto('/login');
  await page.getByTestId('login-email').fill(ADMIN_EMAIL);
  await page.getByTestId('login-password').fill(PASSWORD);
  await Promise.all([
    page.waitForURL('**/dashboard'),
    page.getByTestId('login-submit').click(),
  ]);
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

async function findCreatedMechanic(
  request: APIRequestContext,
  adminToken: string,
  name: string,
  email: string,
) {
  const response = await request.get(
    `${SERVER_URL}/admin/mechanics?search=${encodeURIComponent(name)}&page=1&pageSize=20`,
    { headers: authorization(adminToken) },
  );
  if (!response.ok()) return null;
  const result = await response.json() as MechanicsResponse;
  return result.rows.find((mechanic) => mechanic.name === name && mechanic.email === email) ?? null;
}

async function closeContext(context: BrowserContext | null) {
  await context?.close().catch(() => undefined);
}

test('admin creates a mechanic, exposes them to clients, and deactivates them', async ({ page, browser, request }) => {
  const runId = Date.now();
  const mechanicName = `E2E Admin Mechanic ${runId}`;
  const mechanicEmail = `e2e-admin-${runId}@oficina.dev`;
  const adminToken = await authenticate(request, ADMIN_EMAIL);
  let mechanicId: string | null = null;
  let clientContext: BrowserContext | null = null;

  console.log(`E2E admin mechanic: ${mechanicName} / ${mechanicEmail}`);

  try {
    await loginAsAdmin(page);
    await page.goto('/mechanics');
    await expect(page.getByTestId('mechanics-search')).toBeVisible();

    await page.getByTestId('add-mechanic-button').click();
    await page.getByTestId('create-mechanic-name').fill(mechanicName);
    await page.getByTestId('create-mechanic-phone').fill('11987654321');
    await page.getByTestId('create-mechanic-email').fill(mechanicEmail);
    await page.getByTestId('create-mechanic-password').fill(PASSWORD);
    await page.getByTestId('create-mechanic-specialty').fill('Diagnóstico E2E');
    await page.getByTestId('create-mechanic-credentials').fill(`E2E-${runId}`);
    const createResponsePromise = page.waitForResponse((response) => (
      response.url() === `${SERVER_URL}/admin/mechanics`
      && response.request().method() === 'POST'
    ));
    await page.getByTestId('create-mechanic-submit').click();
    const createResponse = await createResponsePromise;
    expect(createResponse.ok()).toBe(true);
    mechanicId = (await createResponse.json() as Mechanic).id;
    await expect(page.getByTestId('create-mechanic-name')).toHaveCount(0);

    await page.getByTestId('mechanics-search').fill(mechanicName);
    await expect(page.getByTestId('mechanics-search')).toHaveValue(mechanicName);
    const searchResponsePromise = page.waitForResponse((response) => {
      const url = new URL(response.url());
      return response.ok()
        && url.pathname === '/admin/mechanics'
        && url.searchParams.get('search') === mechanicName;
    });
    await page.getByTestId('mechanics-search-submit').click();
    await searchResponsePromise;
    await expect(page.getByTestId(`select-mechanic-${mechanicId}`)).toBeVisible();

    clientContext = await browser.newContext({ baseURL: CLIENT_URL });
    const clientPage = await clientContext.newPage();
    await loginAsClient(clientPage);
    await expect(clientPage.getByTestId(`mechanic-card-${mechanicId}`)).toBeVisible();

    await page.getByTestId(`select-mechanic-${mechanicId}`).click();
    await page.getByTestId('deactivate-selected-mechanics').click();
    await page.getByTestId('deactivate-confirmation-input').fill('DESATIVAR');
    const deactivateResponsePromise = page.waitForResponse((response) => (
      response.url() === `${SERVER_URL}/admin/mechanics/deactivate`
      && response.request().method() === 'POST'
    ));
    await page.getByTestId('deactivate-confirm').click();
    const deactivateResponse = await deactivateResponsePromise;
    expect(deactivateResponse.ok()).toBe(true);

    const browseResponsePromise = clientPage.waitForResponse((response) => (
      response.ok()
      && new URL(response.url()).pathname === '/mechanics'
      && response.request().method() === 'GET'
    ));
    await clientPage.reload();
    await browseResponsePromise;
    await expect(clientPage.getByTestId(`mechanic-card-${mechanicId}`)).toHaveCount(0);
  } finally {
    const createdMechanic = mechanicId
      ? { id: mechanicId }
      : await findCreatedMechanic(request, adminToken, mechanicName, mechanicEmail).catch(() => null);
    if (createdMechanic) {
      await request.post(`${SERVER_URL}/admin/mechanics/deactivate`, {
        headers: authorization(adminToken),
        data: { mechanicIds: [createdMechanic.id] },
      }).catch(() => undefined);
    }
    await closeContext(clientContext);
  }
});
