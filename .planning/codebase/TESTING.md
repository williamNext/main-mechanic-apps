# Testing Patterns

**Analysis Date:** 2026-08-07

## Test Framework

**Runner:**
- Playwright v1.60.0 for end-to-end testing
- Config: `playwright.config.ts`

**Assertion Library:**
- Playwright's built-in expect assertions

**Run Commands:**
```bash
npm run e2e          # Run all Playwright tests
npm run e2e:ui       # Run tests with Playwright UI (interactive mode)
```

## Test File Organization

**Location:**
- E2E tests: `tests/e2e/` directory
- Naming: `*.spec.ts` suffix for Playwright tests

**Current State:**
- Only one test file exists: `tests/e2e/status.spec.ts`
- No unit tests or integration tests configured
- No Jest, Vitest, or similar unit testing framework in use

**Directory Structure:**
```
tests/
└── e2e/
    └── status.spec.ts
```

## Test Structure

**Test Suite Organization:**
```typescript
import { expect, test } from '@playwright/test';

test('client status copy supports not-finalized appointments', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('body')).toContainText(/Agend|Entrar|Oficina/i);
});
```

**Patterns:**
- Single test file with minimal test coverage
- Direct page navigation using `page.goto()`
- Text content assertions using `toContainText()` with regex patterns
- Async/await for all operations

## Playwright Configuration

**File:** `playwright.config.ts`

**Key Settings:**
- Test directory: `./tests/e2e`
- Test timeout: 120 seconds
- Expect timeout: 15 seconds
- Not parallel: `fullyParallel: false`
- No retries: `retries: 0`
- Reporter: List format
- Headless browser: `headless: true`

**Web Server:**
- Command: Expo dev server on port 19007
  ```bash
  powershell -NoProfile -Command "$env:CI=1; $env:EXPO_NO_DOCTOR=1; npx expo start --web --port 19007"
  ```
- Base URL: `http://127.0.0.1:19007`
- Server reuse: `reuseExistingServer: true` (faster iterative testing)
- Server startup timeout: 180 seconds

**Projects:**
- Chromium browser only (not Firefox, WebKit)
- Uses Desktop Chrome device configuration

**Tracing:**
- Enabled on first retry: `trace: 'on-first-retry'`
- Generates trace files for debugging failed tests

## Mocking

**Framework:** None found in configuration

**Current State:**
- No mock framework configured
- No fixtures or test data setup utilities
- All tests interact with live Expo web server

**What to Mock (when framework is added):**
- Supabase API calls
- External HTTP requests
- Authentication flows (use test accounts instead)

**What NOT to Mock:**
- UI component rendering
- Navigation between screens
- Local state management (Zustand stores)

## Fixtures and Test Data

**Test Data:**
Not currently used. When adding tests:

```typescript
// Example pattern to follow:
const testUser = {
  phone: '(11) 99999-9999',
  password: 'test-password-123'
};

test('login with valid credentials', async ({ page }) => {
  await page.goto('/');
  // use testUser for login
});
```

**Location (when implemented):**
- Create `tests/e2e/fixtures/` directory
- Or use Playwright's built-in fixtures: `defineConfig` fixture options

**Database Seeding:**
- Seeding scripts exist: `npm run seed`, `npm run seed:mechanics:auth`, `npm run seed:mechanics:data`
- Use these scripts to prepare test data before running e2e tests

## Coverage

**Requirements:** Not enforced

**Current State:**
- No coverage target defined
- Minimal test coverage (1 basic smoke test)
- No coverage reporting configured

**Recommended Future Addition:**
```bash
# When Playwright coverage reporting is needed:
npx playwright test --reporter=html
# Opens test report in HTML viewer showing coverage
```

## Test Types

**Unit Tests:**
- Not implemented
- No Jest/Vitest configuration
- When adding: Test services, utilities, and store logic in isolation
- Suggested location: Co-locate with source files (e.g., `auth-service.test.ts` next to `auth-service.ts`)

**Integration Tests:**
- Not implemented
- E2E tests serve this purpose currently
- Could add intermediate integration tests between units and e2e

**E2E Tests:**
- Framework: Playwright
- Browser: Chromium (Desktop)
- Current scope: Basic smoke test verifying page loads and contains expected text
- Test location: `tests/e2e/status.spec.ts`

## E2E Test Patterns

**Page Navigation:**
```typescript
await page.goto('/');  // Navigate to home
await page.goto('/path/to/page');  // Navigate to specific route
```

**Locators:**
```typescript
page.locator('body')                    // Find by tag
page.locator('[data-testid="button"]')  // Find by test ID (not currently used)
```

**Assertions:**
```typescript
await expect(page.locator('body')).toContainText(/pattern/i);
await expect(page).toHaveTitle('Title');
await expect(locator).toBeVisible();
```

**Waiting:**
- Playwright automatically waits for elements and navigation
- Default timeouts: 30s for actions, 15s for assertions
- For custom waits:
  ```typescript
  await page.waitForSelector('selector');
  await page.waitForFunction(() => condition);
  ```

## Adding New Tests

**Step 1: Create test file**
```typescript
// tests/e2e/feature.spec.ts
import { expect, test } from '@playwright/test';
```

**Step 2: Structure test**
```typescript
test('descriptive test name', async ({ page }) => {
  // Arrange: navigate to page
  await page.goto('/');
  
  // Act: interact with UI
  await page.click('button');
  
  // Assert: verify result
  await expect(page.locator('result')).toBeVisible();
});
```

**Step 3: Run test**
```bash
npm run e2e
```

**Step 4: Debug if needed**
```bash
npm run e2e:ui  # Visual debugging mode
```

## Common Patterns

**Async Testing:**
```typescript
// Playwright tests are async by default
test('async test', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('h1')).toContainText('Hello');
});
```

**Text Matching:**
```typescript
// Case-insensitive regex patterns
await expect(page.locator('body')).toContainText(/Agend|Entrar|Oficina/i);

// Exact string match
await expect(page.locator('h1')).toContainText('Exact Title');
```

**Form Filling:**
```typescript
// Pattern to use when adding login tests:
await page.fill('[data-testid="phone-input"]', '(11) 99999-9999');
await page.fill('[data-testid="password-input"]', 'password');
await page.click('[data-testid="login-button"]');
```

## Testing Gaps

**Missing Coverage:**
- No unit tests for services, utilities, or stores
- No integration tests for API calls
- E2E tests only cover basic smoke test
- No tests for error scenarios
- No accessibility testing (a11y)
- No visual regression testing

**Priority Areas for Testing:**
1. Authentication flows (login/register/logout)
2. Appointment booking workflow
3. Mechanic profile viewing
4. Error handling and edge cases
5. Date/time manipulation (timeslot management)

---

*Testing analysis: 2026-08-07*
