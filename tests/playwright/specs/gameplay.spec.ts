import { expect, test } from '@playwright/test';

import { backendBaseUrl, frontendBaseUrl } from '../utils/env';

const romId = 'demo-rom';

const romPayload = {
  rom: {
    id: romId,
    title: 'Demo Adventure',
    description: 'A showcase cartridge for smoke tests.',
    platformId: 'snes',
    releaseYear: 1995,
    genres: ['action'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    isFavorite: false,
    assets: [
      {
        id: 'asset-1',
        type: 'ROM',
        checksum: 'a'.repeat(64),
        contentType: 'application/octet-stream',
        size: 1024,
        createdAt: new Date().toISOString(),
        url: `${backendBaseUrl}/roms/${romId}.smc`,
      },
    ],
  },
};

test.describe('gameplay experience', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/roms/demo-rom/save-state/latest', (route) =>
      route.fulfill({ status: 404, contentType: 'application/json', body: '{}' }),
    );

    await page.route('**/roms/demo-rom', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(romPayload) }),
    );
  });

  test('loads ROM dossier and exposes gameplay UI affordances', async ({ page }) => {
    await page.goto(`${frontendBaseUrl}/play/${romId}`);

    await expect(page.getByText('Fetching ROM dossier…')).toBeVisible();
    await expect(page.getByRole('heading', { name: romPayload.rom.title })).toBeVisible();
    await expect(page.getByRole('button', { name: /controller map/i })).toBeVisible();
    await expect(page.getByText(/confirm your controller/i)).toBeVisible();
  });
});
