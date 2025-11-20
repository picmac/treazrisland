import path from 'node:path';

import { expect, test } from '@playwright/test';
import { loginWithPassword } from '../utils/auth';

const romFixturePath = path.join(__dirname, '..', 'artifacts', 'sample-rom.smc');

test.describe('admin rom uploader UI', () => {
  test('computes checksum and registers a ROM with optimistic UI', async ({ page }) => {
    const romTitle = `UI Upload ${Date.now()}`;
    await loginWithPassword(page);

    await page.goto('/admin/roms/new');

    await page.setInputFiles('#rom-file', romFixturePath);
    await expect(page.getByText(/Checksum locked/i)).toBeVisible({ timeout: 10_000 });

    await page.fill('#rom-title', romTitle);
    await page.fill('#rom-platform', 'snes');
    await page.fill('#rom-year', '1995');
    await page.fill('#rom-genres', 'action, test');
    await page.fill('#rom-description', 'Uploaded through Playwright UI smoke test.');

    await page.getByRole('button', { name: 'Create ROM' }).click();

    await page.waitForURL(/\/rom\//, { timeout: 20_000 });
    await expect(page.getByRole('heading', { name: romTitle })).toBeVisible();
    await expect(page.getByText(/ROM dossier/i)).toBeVisible();
  });
});
