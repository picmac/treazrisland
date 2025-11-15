import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import { loginWithPassword } from '../utils/auth';
import { obtainAccessToken, fetchFavoriteState } from '../utils/backendApi';
import { registerTestRom } from '../utils/rom-fixtures';

const FAVORITE_BUTTON_LABEL = /favorite/i;
const FAVORITED_TEXT = '★ Favorited';
const UNFAVORITED_TEXT = '☆ Add to favorites';
const ADDED_STATUS = 'Added to favorites.';
const REMOVED_STATUS = 'Removed from favorites.';

test.describe('rom favorites', () => {
  test('favorite status persists across reloads', async ({ page, request }) => {
    const rom = await registerTestRom(request, { title: 'Playwright Favorite Regression' });

    await loginWithPassword(page);
    const apiToken = await obtainAccessToken(request);

    await page.goto(`/rom/${rom.id}`);
    const favoriteButton = page.getByRole('button', { name: FAVORITE_BUTTON_LABEL });

    await expect(favoriteButton).toBeVisible();
    await expectFavoriteButtonState(favoriteButton, false);

    await favoriteButton.click();
    await expectFavoriteStatus(page, ADDED_STATUS);
    await expectFavoriteButtonState(favoriteButton, true);
    await waitForFavoriteState(request, apiToken, rom.id, true);
    await expect(favoriteButton).toBeEnabled();

    await page.reload();
    const favoritedButton = page.getByRole('button', { name: FAVORITE_BUTTON_LABEL });
    await expect(favoritedButton).toBeVisible();
    await expectFavoriteButtonState(favoritedButton, true);
  });

  test('favorite status can be removed after toggling off', async ({ page, request }) => {
    const rom = await registerTestRom(request, { title: 'Playwright Favorite Toggle' });

    await loginWithPassword(page);
    const apiToken = await obtainAccessToken(request);

    await page.goto(`/rom/${rom.id}`);
    const favoriteButton = page.getByRole('button', { name: FAVORITE_BUTTON_LABEL });

    await expect(favoriteButton).toBeVisible();
    // Ensure the ROM is favorited before verifying the removal path
    await favoriteButton.click();
    await expectFavoriteStatus(page, ADDED_STATUS);
    await expectFavoriteButtonState(favoriteButton, true);
    await waitForFavoriteState(request, apiToken, rom.id, true);

    await page.reload();
    const favoritedButton = page.getByRole('button', { name: FAVORITE_BUTTON_LABEL });
    await expect(favoritedButton).toBeVisible();
    await expectFavoriteButtonState(favoritedButton, true);

    await favoritedButton.click();
    await expectFavoriteStatus(page, REMOVED_STATUS);
    await expectFavoriteButtonState(favoritedButton, false);
    await waitForFavoriteState(request, apiToken, rom.id, false);
    await expect(favoritedButton).toBeEnabled();

    await page.reload();
    const unfavoritedButton = page.getByRole('button', { name: FAVORITE_BUTTON_LABEL });
    await expect(unfavoritedButton).toBeVisible();
    await expectFavoriteButtonState(unfavoritedButton, false);
  });
});

async function expectFavoriteButtonState(button: Locator, isFavorited: boolean) {
  const expectedText = isFavorited ? FAVORITED_TEXT : UNFAVORITED_TEXT;
  const expectedPressed = isFavorited ? 'true' : 'false';

  await expect(button).toHaveText(expectedText);
  await expect(button).toHaveAttribute('aria-pressed', expectedPressed);
}

async function expectFavoriteStatus(page: Page, message: string) {
  const status = page.getByRole('status', { name: message });
  await expect(status).toBeVisible();
}

async function waitForFavoriteState(
  request: Parameters<typeof fetchFavoriteState>[0],
  token: string,
  romId: string,
  expected: boolean,
) {
  await expect.poll(async () => fetchFavoriteState(request, token, romId)).toBe(expected);
}
