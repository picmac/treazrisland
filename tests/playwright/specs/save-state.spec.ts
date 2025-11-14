import { expect, test } from '@playwright/test';
import { loginWithPassword } from '../utils/auth';
import { registerTestRom } from '../utils/rom-fixtures';

test.describe('save state management', () => {
  test('player can capture and upload progress', async ({ page, request }) => {
    const rom = await registerTestRom(request);
    await loginWithPassword(page);

    await page.goto(`/play/${rom.id}`);
    await page.getByRole('button', { name: 'Ready Up' }).click();

    const saveButton = page.getByRole('button', { name: 'Save State' });
    await expect(saveButton).toBeEnabled();
    await expect(page.getByText('No save yet')).toBeVisible();

    await saveButton.click();
    await expect(page.getByText(/Saved \d/)).toBeVisible();

    const localPayload = await page.evaluate(
      (id) => window.localStorage.getItem(`treazr:save:${id}`),
      rom.id,
    );
    expect(localPayload).toBeTruthy();

    await page.getByRole('button', { name: 'Upload Save' }).click();
    await expect(page.getByText('Save uploaded')).toBeVisible();
  });
});
