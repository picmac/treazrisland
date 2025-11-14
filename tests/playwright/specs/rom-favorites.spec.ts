import { expect, test } from '@playwright/test';
import { loginWithPassword } from '../utils/auth';
import { obtainAccessToken, fetchFavoriteState } from '../utils/backendApi';
import { registerTestRom } from '../utils/rom-fixtures';

const FAVORITE_BUTTON_LABEL = /favorite/i;

test.describe('rom favorites', () => {
  test('favorite status persists across reloads', async ({ page, request }) => {
    const rom = await registerTestRom(request, { title: 'Playwright Favorite Regression' });

    await loginWithPassword(page);
    const apiToken = await obtainAccessToken(request);

    await page.goto(`/rom/${rom.id}`);
    const favoriteButton = page.getByRole('button', { name: FAVORITE_BUTTON_LABEL });

    await expect(favoriteButton).toHaveText('☆ Add to favorites');

    await favoriteButton.click();
    await expect(favoriteButton).toHaveText('★ Favorited');
    await expect(page.getByRole('status', { name: 'Added to favorites.' })).toBeVisible();
    await waitForFavoriteState(request, apiToken, rom.id, true);
    await expect(favoriteButton).toBeEnabled();

    await page.reload();
    const favoritedButton = page.getByRole('button', { name: FAVORITE_BUTTON_LABEL });
    await expect(favoritedButton).toHaveText('★ Favorited');
    await expect(favoritedButton).toHaveAttribute('aria-pressed', 'true');
  });

  test('favorite status can be removed after toggling off', async ({ page, request }) => {
    const rom = await registerTestRom(request, { title: 'Playwright Favorite Toggle' });

    await loginWithPassword(page);
    const apiToken = await obtainAccessToken(request);

    await page.goto(`/rom/${rom.id}`);
    const favoriteButton = page.getByRole('button', { name: FAVORITE_BUTTON_LABEL });

    // Ensure the ROM is favorited before verifying the removal path
    await favoriteButton.click();
    await expect(favoriteButton).toHaveText('★ Favorited');
    await waitForFavoriteState(request, apiToken, rom.id, true);

    await page.reload();
    const favoritedButton = page.getByRole('button', { name: FAVORITE_BUTTON_LABEL });
    await expect(favoritedButton).toHaveText('★ Favorited');
    await expect(favoritedButton).toHaveAttribute('aria-pressed', 'true');

    await favoritedButton.click();
    await expect(favoritedButton).toHaveText('☆ Add to favorites');
    await expect(page.getByRole('status', { name: 'Removed from favorites.' })).toBeVisible();
    await waitForFavoriteState(request, apiToken, rom.id, false);
    await expect(favoritedButton).toBeEnabled();

    await page.reload();
    const unfavoritedButton = page.getByRole('button', { name: FAVORITE_BUTTON_LABEL });
    await expect(unfavoritedButton).toHaveText('☆ Add to favorites');
    await expect(unfavoritedButton).toHaveAttribute('aria-pressed', 'false');
  });
});

async function waitForFavoriteState(
  request: Parameters<typeof fetchFavoriteState>[0],
  token: string,
  romId: string,
  expected: boolean,
) {
  await expect.poll(async () => fetchFavoriteState(request, token, romId)).toBe(expected);
}
