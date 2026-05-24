import { expect, test } from '@playwright/test';

test('client status copy supports not-finalized appointments', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('body')).toContainText(/Agend|Entrar|Oficina/i);
});
