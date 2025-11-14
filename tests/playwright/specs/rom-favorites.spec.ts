import { expect, test } from '@playwright/test';
import { loginWithPassword } from '../utils/auth';
import { registerTestRom } from '../utils/rom-fixtures';

const FAVORITE_BUTTON_LABEL = /favorites/i;

test.describe('rom favorites', () => {
  test('favorite status persists across reloads', async ({ page, request }) => {
    const rom = await registerTestRom(request, { title: 'Playwright Favorite Regression' });

    await loginWithPassword(page);

    await page.goto(`/rom/${rom.id}`);
    const favoriteButton = page.getByRole('button', { name: FAVORITE_BUTTON_LABEL });

    await expect(favoriteButton).toHaveText('☆ Add to favorites');

    await favoriteButton.click();
    await expect(favoriteButton).toHaveText('★ Favorited');
    await expect(page.getByRole('status', { name: 'Added to favorites.' })).toBeVisible();

    await page.reload();
    await expect(page.getByRole('button', { name: '★ Favorited' })).toBeVisible();
  });

  test('favorite status can be removed after toggling off', async ({ page, request }) => {
    const rom = await registerTestRom(request, { title: 'Playwright Favorite Toggle' });

    await loginWithPassword(page);

    await page.goto(`/rom/${rom.id}`);
    const favoriteButton = page.getByRole('button', { name: FAVORITE_BUTTON_LABEL });

    // Ensure the ROM is favorited before verifying the removal path
    await favoriteButton.click();
    await expect(favoriteButton).toHaveText('★ Favorited');

    await page.reload();
    const favoritedButton = page.getByRole('button', { name: FAVORITE_BUTTON_LABEL });
    await expect(favoritedButton).toHaveText('★ Favorited');

    await favoritedButton.click();
    await expect(favoritedButton).toHaveText('☆ Add to favorites');
    await expect(page.getByRole('status', { name: 'Removed from favorites.' })).toBeVisible();

    await page.reload();
    await expect(page.getByRole('button', { name: FAVORITE_BUTTON_LABEL })).toHaveText(
      '☆ Add to favorites',
    );
  });
});
