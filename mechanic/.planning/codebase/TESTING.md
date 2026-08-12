# Testing Patterns

**Analysis Date:** 2026-08-07

## Test Framework

**Runner:**
- Framework: Playwright `@playwright/test@^1.60.0`
- Config: `playwright.config.ts`
- Test directory: `tests/e2e/`

**Assertion Library:**
- Playwright built-in assertions (`expect()`)

**Run Commands:**
```bash
npm run e2e              # Run all end-to-end tests
npm run e2e:ui          # Run tests with Playwright UI (interactive mode)
```

## Test File Organization

**Location:**
- E2E tests: `tests/e2e/` — separated from source code
- Pattern: One spec file per user flow

**Naming:**
- Format: `[feature].spec.ts` — `availability.spec.ts`, `closure.spec.ts`
- Reflects user feature being tested

**File Structure:**
```
tests/
└── e2e/
    ├── availability.spec.ts
    └── closure.spec.ts
```

## Test Structure

**Suite Organization:**
- Single test file contains multiple related test cases
- Example (`tests/e2e/availability.spec.ts`):
  - `test('availability flow smoke', async ({ page }) => { ... })`
  - `test('availability deletes an available slot and keeps it deleted after refresh', async ({ page }) => { ... })`
  - `test('batch creation uses default, append, and manual start rules', async ({ page }) => { ... })`

**Patterns:**
- Setup: Helper functions for common actions (login, date navigation, form filling)
- Execution: User interactions via Playwright locators
- Assertion: Playwright `expect()` with human-readable matchers
- Teardown: Not explicitly used; Playwright manages browser state between tests

**Helper Functions:**
- `loginAsMechanic()` — Authenticate user and wait for navigation
- `openAndSetDate()` — Handle both web and mobile date picker interactions
- `fillTimeFields()` — Clear and fill time input fields
- `createBatch()` — High-level batch availability creation helper
- `slotTestId()` — Generate data-testid for slot elements

## Test Patterns

### Login/Authentication Setup

```typescript
async function loginAsMechanic(page: import('@playwright/test').Page) {
  await page.goto('/(auth)/login');
  await page.getByPlaceholder('(51) 99999-9999').fill(DEFAULT_MECHANIC_PHONE);
  await page.getByPlaceholder('Digite sua senha').fill(DEFAULT_MECHANIC_PASSWORD);
  await page.getByTestId('login-submit-button').click();
  return page.waitForURL(/\/(mechanic)\/(agenda|availability)|\/agenda|\/availability/, { timeout: 20000 })
    .then(() => true)
    .catch(() => false);
}
```

**Pattern:** 
- Separate login helper is reused across tests
- Returns boolean indicating success
- Configurable timeout (20s) for URL wait
- Uses regex for flexible URL matching (handles multiple navigation destinations)

### Conditional Test Skipping

```typescript
test('availability flow smoke', async ({ page }) => {
  test.skip(!(await loginAsMechanic(page)), 'Default mechanic E2E account unavailable.');
  // ... test body
});
```

**Pattern:**
- Skip tests if preconditions fail (e.g., seeded test data unavailable)
- Reason string provides context for skip
- Used when default test account/data is required but not present

### Assertion Patterns

**Element Visibility:**
```typescript
await expect(page.getByText('Gerenciar horarios')).toBeVisible();
await expect(page.getByTestId('availability-start-input')).toHaveValue('93:0');
```

**Polling (Async Operations):**
```typescript
await expect
  .poll(async () => page.getByText(/\d{2}:\d{2}(?::\d{2})? - \d{2}:\d{2}(?::\d{2})?/).count(), { timeout: 20000 })
  .toBeGreaterThanOrEqual(beforeBaseCount + 1);
```

**Pattern:** Use `.poll()` when verifying async operations (API calls, batch creation)

**Error Messages:**
```typescript
await expect(page.getByText('Nao pode usar data no passado.')).toBeVisible();
await expect(page.getByText('Use horario no formato HH:mm.')).toBeVisible();
```

**Pattern:** Assert error messages match expected text (Portuguese UI text)

### Locator Strategies

**By Data Attribute (Preferred):**
```typescript
await page.getByTestId('availability-date-input-web').fill(isoDate);
await page.getByTestId('login-submit-button').click();
```

**By Text Content:**
```typescript
await page.getByText('Adicionar em lote').click();
await page.getByPlaceholder('3').fill('3');
```

**By Role (Accessibility):**
```typescript
page.getByRole('button', { name: 'Submit' })
```

**By CSS Selector (Last Resort):**
```typescript
const pickerInput = page.locator('input[type="date"]');
```

## Cross-Browser Configuration

**Browsers:**
- Chromium (Desktop Chrome)
- Config: `playwright.config.ts:21-26`

**Web Server:**
- Expo web server launched automatically for tests
- Command: `npx expo start --web --port 19006`
- Base URL: `http://127.0.0.1:19006`
- Server reused if already running (`reuseExistingServer: true`)

## Test Environment Configuration

**Timeouts:**
- Test timeout: 120 seconds (2 minutes)
- Expect timeout: 15 seconds
- Server startup timeout: 180 seconds (3 minutes)

**Retries:**
- Set to 0 — no automatic retries on failure (intentional, tests should be deterministic)

**Parallel Execution:**
- Disabled (`fullyParallel: false`)
- Tests run sequentially to avoid race conditions and state conflicts

**Tracing:**
- Enabled on first retry: `trace: 'on-first-retry'`
- Generates trace files for debugging failed tests

**Reporter:**
- Format: 'list' (simple line-by-line output)

## Coverage

**Requirements:** No coverage measurement enforced

**What's Tested:**
- E2E flows only — user interactions from UI through API
- Focus areas: authentication, availability slot management, appointment closure

**What's NOT Tested:**
- Unit tests for services, stores, or components
- Integration tests for individual services
- Database operations in isolation

## Mocking

**Approach:** No explicit mocking
- Tests run against real Supabase instance
- Real database seeded with test data via `npm run seed` and `npm run seed:mechanics:auth`
- Test data cleaned up between runs via database state management

**Seeding:**
- Default mechanic account: phone `51999990001`, password from `MECHANIC_DEFAULT_PASSWORD` env var (default: `password123`)
- Appointment/availability data created dynamically during test execution
- Time-based seeding to avoid conflicts: `Date.now() % 20` used as random offset

## Test Data

**Test Accounts:**
- Default mechanic: `51999990001` / `password123` (from `env` or `.env` file)
- Configured at top of test files: `const DEFAULT_MECHANIC_PHONE = '51999990001'`

**Dynamic Data Creation:**
- Tests create their own test data (availability slots, batches) during execution
- Time-based randomization to avoid conflicts: `const smokeSeed = Date.now() % 20`
- Data cleaned up by re-running tests (slot deletion tests verify cleanup)

**Date Handling:**
- ISO format dates: `isoDateDaysFromToday(15 + smokeSeed)` generates dates relative to today
- Example utility from `availability.spec.ts:6-13`:
  ```typescript
  function isoDateDaysFromToday(daysFromToday: number) {
    const date = new Date();
    date.setDate(date.getDate() + daysFromToday);
    const yyyy = date.getFullYear();
    const mm = `${date.getMonth() + 1}`.padStart(2, '0');
    const dd = `${date.getDate()}`.padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }
  ```

## Common E2E Patterns

### Navigation Between Routes

```typescript
await page.goto('/(auth)/login');
await page.goto('/(mechanic)/availability');
```

**Pattern:** Direct navigation using Expo Router paths with group syntax `(group)`

### Handling Platform Differences

```typescript
const webDateInput = page.getByTestId('availability-date-input-web');
if (await webDateInput.isVisible()) {
  await webDateInput.fill(isoDate);
  return;
}
// Fallback for mobile/native date picker
await page.getByTestId('availability-date-trigger').click();
const pickerInput = page.locator('input[type="date"]');
await expect(pickerInput).toBeVisible();
await pickerInput.fill(isoDate);
await pickerInput.dispatchEvent('change');
```

**Pattern:** Detect which UI variant is present before interacting; use different selectors for web vs. mobile

### Form Filling with Timeout

```typescript
const startInput = page.getByTestId('availability-start-input');
await startInput.fill('');
await startInput.type('0930');
```

**Pattern:** Clear field first, then type to avoid stale values

### Counting Elements to Verify Operations

```typescript
const beforeCount = await page.getByText(/\d{2}:\d{2}(?::\d{2})? - \d{2}:\d{2}(?::\d{2})?/).count();
// ... perform action ...
const afterCount = await page.getByText(/\d{2}:\d{2}(?::\d{2})? - \d{2}:\d{2}(?::\d{2})?/).count();
expect(afterCount).toBeGreaterThanOrEqual(beforeCount + 1);
```

**Pattern:** Compare element counts before/after to verify creation/deletion without exact element assertions

## Known Constraints

**Sequential Execution:**
- Tests must run one at a time; parallel execution disabled to prevent test data conflicts
- Shared database state requires careful test isolation

**Environment-Dependent:**
- Tests fail if seeded mechanic account doesn't exist
- Tests skip gracefully with meaningful messages when preconditions aren't met

**Time-Sensitive Operations:**
- Availability slot tests use dynamic future dates to avoid "past date" validation errors
- Batch creation tests seed with random offsets to avoid slot conflicts

---

*Testing analysis: 2026-08-07*
