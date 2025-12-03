import { fileURLToPath } from 'node:url';

import { expect, test } from '@playwright/test';
import { loginWithPassword } from '../utils/auth';

const romFixturePath = fileURLToPath(new URL('../artifacts/sample-rom.smc', import.meta.url));

test.describe('admin rom uploader UI', () => {
  test('computes checksum and registers a ROM with optimistic UI', async ({ page }) => {
    const romTitle = `UI Upload ${Date.now()}`;
    await loginWithPassword(page);

    await page.goto('/admin/roms/new');

    await page.setInputFiles('#rom-file', romFixturePath);
    const checksumStatus = page.getByTestId('rom-upload-status');

    await expect(checksumStatus).toHaveText(
      /Computing (SHA-256 )?checksum|Checksum ready\. You can upload now\./i,
      { timeout: 12_000 },
    );
    await expect(checksumStatus).toHaveText(/Checksum ready\. You can upload now\./i, {
      timeout: 24_000,
    });

    await page.fill('#rom-title', romTitle);
    await page.fill('#rom-platform', 'snes');
    await page.fill('#rom-year', '1995');
    await page.fill('#rom-genres', 'action, test');
    await page.fill('#rom-description', 'Uploaded through Playwright UI smoke test.');

    await page.getByRole('button', { name: 'Create ROM' }).click();

    await page.waitForURL(/\/rom\//, { timeout: 20_000 });
    const romHeading = page.getByRole('heading', { level: 1 });
    await expect(romHeading).toBeVisible();
    await expect(romHeading).toContainText('UI Upload');
    await expect(page.getByText(/ROM dossier/i)).toBeVisible();
  });
});
