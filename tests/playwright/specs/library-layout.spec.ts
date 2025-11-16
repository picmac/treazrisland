import { expect, test } from '@playwright/test';

const romFixtures = Array.from({ length: 8 }).map((_, index) => ({
  id: `rom-${index + 1}`,
  title: `Fixture ROM ${index + 1}`,
  description: 'A showcase ROM pulled from the seeded Treazr Island catalog.',
  platformId: index % 2 === 0 ? 'nes' : 'snes',
  releaseYear: 1990 + index,
  genres: index % 2 === 0 ? ['Platformer', 'Action'] : ['Adventure'],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
}));

const romResponse = {
  items: romFixtures,
  meta: {
    page: 1,
    pageSize: romFixtures.length,
    totalItems: romFixtures.length,
    totalPages: 1,
  },
};

test.describe('library layout', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/roms**', async (route) => {
      if (route.request().method() !== 'GET') {
        return route.continue();
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(romResponse),
      });
    });
  });

  test('desktop grid uses four columns', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/library');

    await expect(page.getByTestId('library-filter-bar')).toBeVisible();

    const firstRow = page.locator('[data-index="0"]').first();
    await expect(firstRow).toBeVisible();
    await expect(firstRow).toHaveAttribute('style', /repeat\(4, minmax/);
    await expect(firstRow.getByTestId('rom-card')).toHaveCount(4);
  });

  test('mobile view collapses grid to one column', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 740 });
    await page.goto('/library');

    await expect(page.getByRole('button', { name: /favorites/i })).toBeVisible();
    const firstRow = page.locator('[data-index="0"]').first();
    await expect(firstRow).toBeVisible();
    await expect(firstRow).toHaveAttribute('style', /repeat\(1, minmax/);
    await expect(firstRow.getByTestId('rom-card')).toHaveCount(1);
  });
});
