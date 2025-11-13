import { expect, test } from '@playwright/test';
import { backendBaseUrl } from '../utils/env';
import { registerTestRom } from '../utils/rom-fixtures';

test.describe('rom ingestion', () => {
  test('admin can register a ROM through the upload API', async ({ request }) => {
    const rom = await registerTestRom(request);

    expect(rom.id).toBeTruthy();
    expect(rom.assets.length).toBeGreaterThan(0);

    const response = await request.get(`${backendBaseUrl}/roms/${rom.id}`);
    expect(response.ok()).toBeTruthy();
    const payload = (await response.json()) as { rom: { id: string; title: string } };
    expect(payload.rom.id).toBe(rom.id);
    expect(payload.rom.title).toBe(rom.title);
  });
});
