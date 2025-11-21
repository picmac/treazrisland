import { expect, test } from '@playwright/test';

import { frontendBaseUrl } from '../utils/env';

test.describe('library browsing', () => {
  test('surfaces filter controls and library heading', async ({ page }) => {
    await page.goto(`${frontendBaseUrl}/library`);

    await expect(
      page.getByRole('heading', { name: /browse the treazr island rom catalog/i }),
    ).toBeVisible();
    await expect(page.getByRole('region', { name: /library filters/i })).toBeVisible();

    await expect(page.getByRole('combobox', { name: /platform/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /all genres/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /favorites only/i })).toBeVisible();
  });
});
