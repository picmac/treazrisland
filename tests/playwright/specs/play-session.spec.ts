import { expect, test } from '@playwright/test';
import { loginWithPassword } from '../utils/auth';
import { registerTestRom } from '../utils/rom-fixtures';

test.describe('play session', () => {
  test('operator can launch a ROM in EmulatorJS', async ({ page, request }) => {
    const rom = await registerTestRom(request);
    await loginWithPassword(page);

    await page.goto(`/rom/${rom.id}`);
    await expect(page.getByRole('heading', { name: rom.title })).toBeVisible();

    await page.getByRole('link', { name: /Play Now/i }).click();
    await expect(page).toHaveURL(new RegExp(`/play/${rom.id}`));
    await expect(
      page.locator('.play-session__status', { hasText: 'Fetching ROM dossier…' }),
    ).toBeVisible();

    await expect(
      page.getByText(`Confirm your controls before diving into ${rom.title}.`),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Ready Up' }).click();

    const toolbar = page.getByRole('toolbar', { name: `${rom.title} emulator controls` });
    await expect(toolbar).toBeVisible();
  });
});
