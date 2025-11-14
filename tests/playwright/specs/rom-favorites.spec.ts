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

    await page.reload();
    await expect(page.getByRole('button', { name: '★ Favorited' })).toBeVisible();
  });
});
