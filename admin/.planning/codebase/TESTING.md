# Testing Patterns

**Analysis Date:** 2026-08-07

## Test Framework

**Runner:**
- Playwright: v1.60.0 (E2E testing only)
- Config: `playwright.config.ts`

**Run Commands:**
```bash
npm run e2e               # Run all E2E tests in headless mode
npm run e2e:ui          # Run tests with interactive UI browser
```

**Test Environment:**
- Single browser: Chromium (Desktop Chrome devices profile)
- Server: Expo web server started on port 19008
- Headless mode: Enabled (`headless: true`)
- Trace: Captured on first retry (`trace: 'on-first-retry'`)
- Parallel execution: Disabled (`fullyParallel: false`)
- Retries: 0 (no automatic retries)

## Test File Organization

**Location:**
- All E2E tests in: `tests/e2e/`
- File naming: `*.spec.ts` (Playwright convention)

**Test Files:**
- `tests/e2e/add-mechanic.spec.ts` — Mechanic creation via admin UI
- `tests/e2e/delete-all-mechanics.spec.ts` — Bulk mechanic deletion
- `tests/e2e/finance.spec.ts` — Finance tab loading, date controls, appointments filter

## Test Structure

**Suite Organization:**
```typescript
import { expect, test } from '@playwright/test';

// Environment variables for auth
const ADMIN_IDENTIFIER = process.env.ADMIN_E2E_IDENTIFIER || '11999999999';
const ADMIN_PASSWORD = process.env.ADMIN_E2E_PASSWORD || 'admin';

// Shared helper function
async function loginAsAdmin(page: import('@playwright/test').Page) {
  // Login implementation
}

// Individual test
test('descriptive test name', async ({ page }) => {
  // Test implementation
});
```

**Key Characteristics:**
- Each test is independent — no shared state between tests
- Helper functions extracted for common operations (e.g., `loginAsAdmin`)
- Environment variables used for credentials (with fallback defaults for dev)
- Tests skip gracefully when required env vars missing: `test.skip(!ADMIN_IDENTIFIER || !ADMIN_PASSWORD, 'message')`

## Test Execution Flow

**Example from `add-mechanic.spec.ts`:**

1. **Setup**: Login as admin
   ```typescript
   async function loginAsAdmin(page: import('@playwright/test').Page) {
     await page.goto('/(auth)/login');
     await page.getByPlaceholder('11999999999').fill(ADMIN_IDENTIFIER);
     await page.getByPlaceholder('Senha').fill(ADMIN_PASSWORD);
     await page.getByPlaceholder('Senha').press('Enter');
     await page.waitForURL(/\/(admin)\/dashboard|\/dashboard/, { timeout: 20000 });
   }
   ```

2. **Navigation**: Go to target page
   ```typescript
   await page.goto('/(admin)/mechanics');
   ```

3. **Wait for Shell**: Ensure UI is ready
   ```typescript
   await expect(page.getByText('Diretório')).toBeVisible();
   ```

4. **User Interaction**: Click buttons, fill forms
   ```typescript
   const addButton = page.getByText('Adicionar mecânico');
   await expect(addButton).toBeVisible();
   await addButton.click();
   ```

5. **Fill Form Fields**: With unique test data
   ```typescript
   const uniqueId = Math.floor(100000 + Math.random() * 900000);
   await page.getByPlaceholder('Ex: João Silva').fill(`Mecânico Teste ${uniqueId}`);
   ```

6. **Wait for State Change**: Modal disappears, loading completes
   ```typescript
   await expect(modalTitle).not.toBeVisible({ timeout: 15000 });
   await expect(page.getByText('Carregando')).not.toBeVisible({ timeout: 15000 });
   ```

7. **Verification**: Assert final state
   ```typescript
   await expect(page.getByText(testName)).toBeVisible();
   await expect(page.getByText(testSpecialty)).toBeVisible();
   ```

## Selectors and Querying

**Primary Methods:**
- `page.getByPlaceholder('text')` — Find by input placeholder
- `page.getByText('text')` — Find by visible text
- `page.getByRole('button', { name: 'text' })` — Find by ARIA role and text
- `page.getByPlaceholder('YYYY-MM-DD')` — For specific input formats

**Assertion Patterns:**
```typescript
await expect(element).toBeVisible();                    // Element in viewport
await expect(element).not.toBeVisible({ timeout: 15000 });  // Wait for disappearance
await expect(element).toHaveCount(0);                   // Element count
```

**Wait Patterns:**
- `page.waitForURL()` — Wait for navigation
- `page.waitForNavigation()` — Implicit wait for page change
- `expect(element).not.toBeVisible({ timeout: 15000 })` — Wait for element to disappear

## Test Data

**Unique Identifier Generation:**
```typescript
const uniqueId = Math.floor(100000 + Math.random() * 900000);
const testName = `Mecânico Teste ${uniqueId}`;
const testPhone = `11977${uniqueId}`;
const testEmail = `recovery-${uniqueId}@example.com`;
```

**Purpose:** Avoid conflicts with existing data when running tests multiple times

**Constants Used:**
- Fallback credentials for local development: `'11999999999'` (phone), `'admin'` (password)
- CI/production credentials from env vars: `ADMIN_E2E_IDENTIFIER`, `ADMIN_E2E_PASSWORD`
- Delete confirmation word: `'EXCLUIR'`

## Configuration Details

**Timeouts:**
- Test timeout: `120000` ms (2 minutes)
- Assertion timeout: `15000` ms
- Server startup: `180000` ms (3 minutes)
- waitForURL: `20000` ms

**Server Configuration:**
- Command: PowerShell with `CI=1` env var to start Expo web server
- Port: 19008
- Base URL: `http://127.0.0.1:19008`
- Reuse existing server if running: `reuseExistingServer: true`

**Reporter:**
- Format: `'list'` (simple line-by-line output)

## Coverage

**Requirements:** Not enforced; no coverage measurement configured

**Test Scope (Current):**
- **Admin UI flows only** — No unit tests or integration tests
- **Mechanic management** — Add, delete, list, search
- **Finance reporting** — Tab loads, date controls work, filters visible
- **Appointments** — Filter for unfinalized appointments visible
- **Authentication** — Admin login via email or phone

**Untested Areas:**
- API/backend logic (no direct API testing)
- Error states and edge cases (some paths not tested)
- Mobile-specific behavior (runs on desktop only)
- Performance and load testing

## Environment Setup

**Required Environment Variables:**
```bash
ADMIN_E2E_IDENTIFIER   # Admin phone or email (optional, defaults to '11999999999')
ADMIN_E2E_PASSWORD     # Admin password (optional, defaults to 'admin')
CI                     # Set to 1 during test runs
```

**Local Development:**
- Tests can run with hardcoded dev credentials
- For CI/CD: Set `ADMIN_E2E_IDENTIFIER` and `ADMIN_E2E_PASSWORD` in GitHub Secrets or CI environment

## Common Patterns

**Login Pattern:**
```typescript
async function loginAsAdmin(page: import('@playwright/test').Page) {
  await page.goto('/(auth)/login');
  await page.getByPlaceholder('11999999999').fill(ADMIN_IDENTIFIER);
  await page.getByPlaceholder('Senha').fill(ADMIN_PASSWORD);
  await page.getByPlaceholder('Senha').press('Enter');
  await page.waitForURL(/\/(admin)\/dashboard|\/dashboard/, { timeout: 20000 });
}
```
Use this in every test that requires admin access. Called before any admin page navigation.

**Modal Interaction Pattern:**
```typescript
// Open modal
const button = page.getByText('Adicionar mecânico');
await button.click();

// Wait for modal title
const modalTitle = page.getByText('Adicionar Novo Mecânico');
await expect(modalTitle).toBeVisible();

// Fill fields and submit
await page.getByPlaceholder('Ex: João Silva').fill(testName);
await page.getByPlaceholder('Ex: CREA-123456').press('Enter');

// Wait for modal to close
await expect(modalTitle).not.toBeVisible({ timeout: 15000 });
```

**Form Validation Testing:**
- Fill all required fields before submission
- Use unique test data to avoid conflicts
- Verify success by checking visibility of newly created item or absence of error message
- Validate error states by checking error message visibility

**Date Handling in Tests:**
```typescript
// Current month formatted
const CURRENT_MONTH = new Intl.DateTimeFormat('pt-BR', { month: '2-digit', year: 'numeric' })
  .format(new Date());

// First day of current month
const CURRENT_MONTH_FIRST_DAY = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
  .format(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
```

## Debugging Tests

**Enable Trace:**
- Traces captured on first retry by default
- View traces: `npx playwright show-trace trace.zip`

**Run Single Test:**
```bash
npx playwright test add-mechanic.spec.ts
```

**Run with UI:**
```bash
npm run e2e:ui
```
Opens interactive browser to step through tests, inspect elements, and debug selectors.

---

*Testing analysis: 2026-08-07*
