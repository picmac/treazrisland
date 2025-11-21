import { expect, test } from '@playwright/test';

import { frontendBaseUrl } from '../utils/env';

test.describe('admin onboarding', () => {
  test('shows progress tracker and wizard steps', async ({ page }) => {
    await page.goto(`${frontendBaseUrl}/onboarding`);

    await expect(
      page.getByRole('heading', { name: /complete the treazr island setup flow/i }),
    ).toBeVisible();
    await expect(page.getByRole('list', { name: /admin onboarding progress/i })).toBeVisible();

    const navButtons = page.getByRole('button', { name: /\. Check API health/i });
    await expect(navButtons.first()).toBeVisible();
    await expect(page.getByRole('button', { name: /run health check/i })).toBeEnabled();
  });
});
