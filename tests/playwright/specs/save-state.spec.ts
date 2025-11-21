import { Buffer } from 'node:buffer';
import { expect, test } from '@playwright/test';
import { loginWithPassword } from '../utils/auth';
import { obtainAccessToken, fetchLatestSaveState } from '../utils/backendApi';
import { registerTestRom } from '../utils/rom-fixtures';

test.describe('save state management', () => {
  test('player can capture and upload progress', async ({ page, request }) => {
    const rom = await registerTestRom(request);
    await loginWithPassword(page);
    const apiToken = await obtainAccessToken(request);

    await page.goto(`/play/${rom.id}`);
    await page.getByRole('button', { name: 'Ready Up' }).click();

    const sessionStatus = page.getByText('Confirm your controller to start the emulator.');
    await expect(sessionStatus).toBeHidden({ timeout: 10_000 });

    const romLoadingStatus = page.getByText('Fetching ROM dossier…');
    await expect(romLoadingStatus).toBeHidden({ timeout: 20_000 });

    const emulatorStatus = page.getByText('Loading EmulatorJS runtime…');
    await expect(emulatorStatus).toBeHidden({ timeout: 15000 });

    const controlsOverlay = page.getByRole('toolbar', { name: /emulator controls/i });
    await expect(controlsOverlay).toBeVisible({ timeout: 20_000 });

    const saveButton = controlsOverlay.getByRole('button', { name: 'Save State' });
    const overlayStatus = controlsOverlay.getByTestId('control-overlay-status');

    await expect(overlayStatus).toBeVisible({ timeout: 30_000 });
    await expect(saveButton).toBeEnabled({ timeout: 30_000 });
    await expect(overlayStatus).toHaveText('Live', { timeout: 30_000 });
    await expect(page.getByText('No save yet')).toBeVisible();

    await saveButton.click();
    await expect(page.getByText(/Saved \d/)).toBeVisible();
    await expect(saveButton).toBeEnabled();

    const localPayload = await page.evaluate(
      (id) => window.localStorage.getItem(`treazr:save:${id}`),
      rom.id,
    );
    expect(localPayload).toBeTruthy();

    const uploadButton = page.getByRole('button', { name: 'Upload Save' });
    await uploadButton.click();
    await expect(page.getByText('Save uploaded')).toBeVisible();
    await expect(uploadButton).toBeEnabled();

    await expect
      .poll(
        async () => (await fetchLatestSaveState(request, apiToken, rom.id))?.saveState.id ?? null,
      )
      .not.toBeNull();

    const latestSave = await fetchLatestSaveState(request, apiToken, rom.id);
    expect(latestSave).not.toBeNull();
    const decoded = Buffer.from(latestSave!.data, 'base64').toString('utf-8');
    expect(decoded).toContain(rom.id);
  });
});
