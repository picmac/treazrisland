import { expect, test } from '@playwright/test';

import { frontendBaseUrl } from '../utils/env';

test.describe('UI shell', () => {
  test('home hero surfaces primary actions and status', async ({ page }) => {
    await page.goto(`${frontendBaseUrl}/`);

    const banner = page.getByRole('banner');
    await expect(banner).toBeVisible();
    await expect(banner.getByRole('link', { name: /library/i })).toBeVisible();
    await expect(banner.getByRole('link', { name: /onboarding/i })).toBeVisible();

    const hero = page.getByRole('region', { name: /treazr island mission control/i });
    await expect(
      hero.getByRole('heading', { name: /treazr island mission control/i }),
    ).toBeVisible();
    await expect(page.getByRole('link', { name: /browse library/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /complete onboarding/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /resume session/i })).toBeVisible();

    await expect(hero.getByText(/^Health checks:/i)).toBeVisible();
    await expect(hero.getByText(/^First-play goal:/i)).toBeVisible();
  });
});
