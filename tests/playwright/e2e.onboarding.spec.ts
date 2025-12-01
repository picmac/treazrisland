import { Buffer } from 'node:buffer';

import { expect, test } from '@playwright/test';

import { obtainAccessToken, fetchLatestSaveState } from './utils/backendApi';
import { backendBaseUrl, frontendBaseUrl } from './utils/env';
import { ONBOARDING_STORAGE_KEY, resetClientStorage } from './utils/storage-mocks';
import { createInviteCode, ensureFirstAdminBootstrapped } from './utils/test-seeds';

const inviteePassword = 'PlaywrightInvite123!';

const createRomBuffer = () =>
  Buffer.from(`playwright-rom-${Date.now()}-${Math.random().toString(16).slice(2)}`, 'utf-8');

test.describe.serial('end-to-end onboarding journey', () => {
  test('bootstraps admin, invites crew, uploads ROM, and saves progress', async ({
    page,
    request,
    browser,
  }) => {
    await resetClientStorage(page, page.context());

    await ensureFirstAdminBootstrapped(request);
    const bootstrapStatus = await request.get(`${backendBaseUrl}/auth/bootstrap/status`);
    expect(bootstrapStatus.ok()).toBeTruthy();

    await page.goto(`${frontendBaseUrl}/onboarding`);
    await expect(
      page.getByRole('heading', { name: /complete the treazr island setup flow/i }),
    ).toBeVisible();

    const healthStepButton = page.getByRole('button', { name: /\. Check API health/i });
    await healthStepButton.click();
    await page.getByRole('button', { name: /Run health check/i }).click();
    await expect(page.getByText(/Stack status/i)).toBeVisible({ timeout: 15_000 });

    const profileStepButton = page.getByRole('button', { name: /\. Verify admin profile/i });
    await profileStepButton.click();
    await page.getByLabel('Display name').fill('Captain Playwright');
    await page.getByLabel('Support contact').fill('support+e2e@treazr.test');
    await page.getByRole('button', { name: 'Save profile' }).click();
    await expect(page.getByText(/Profile saved/i)).toBeVisible();

    const emulatorStepButton = page.getByRole('button', {
      name: /\. Configure EmulatorJS endpoint/i,
    });
    await emulatorStepButton.click();
    await page.getByLabel('Embed URL').fill('http://localhost:8080/dist/embed.js');
    await page.getByRole('button', { name: /Validate & save/i }).click();
    await expect(page.getByText(/Emulator endpoint verified/i)).toBeVisible();

    const romStepButton = page.getByRole('button', { name: /\. Upload your first ROM/i });
    await romStepButton.click();

    const romTitle = `Playwright Onboarding ${Date.now()}`;
    await page.getByLabel('ROM title').fill(romTitle);

    const romUploadResponse = page.waitForResponse(
      (response) =>
        response.url().includes('/admin/roms') && response.request().method() === 'POST',
    );

    await page.setInputFiles('input[type="file"]', {
      name: 'onboarding-rom.smc',
      mimeType: 'application/octet-stream',
      buffer: createRomBuffer(),
    });

    await page.getByRole('button', { name: 'Upload ROM' }).click();
    const uploadPayload = (await (await romUploadResponse).json()) as {
      rom: { id: string; title: string };
    };
    const uploadedRomId = uploadPayload.rom.id;
    await expect(page.getByText(/ROM .* uploaded\./i)).toBeVisible();

    await expect
      .poll(async () => {
        const stored = await page.evaluate(
          (key) => globalThis.localStorage?.getItem(key) ?? globalThis.sessionStorage?.getItem(key),
          ONBOARDING_STORAGE_KEY,
        );
        if (!stored) return null;
        const parsed = JSON.parse(stored) as { rom?: { completed?: boolean } };
        return parsed.rom?.completed ?? null;
      })
      .toBe(true);

    const adminToken = await obtainAccessToken(request);
    const inviteeEmail = `deckhand+${Date.now()}@treazr.test`;
    const inviteCode = await createInviteCode(request, adminToken, inviteeEmail);

    const inviteContext = await browser.newContext();
    const invitePage = await inviteContext.newPage();
    await invitePage.goto(`${frontendBaseUrl}/invite/${inviteCode}`);
    await invitePage.getByLabel('Email').fill(inviteeEmail);
    await invitePage.getByLabel('Display name (optional)').fill('Deckhand Voyager');
    await invitePage.getByLabel('Password', { exact: true }).fill(inviteePassword);
    await invitePage.getByLabel('Confirm password').fill(inviteePassword);
    await invitePage.getByRole('button', { name: 'Redeem invite' }).click();
    await invitePage.waitForURL('**/library');

    await invitePage.goto(`${frontendBaseUrl}/rom/${uploadedRomId}`);
    await expect(invitePage.getByRole('heading', { name: romTitle })).toBeVisible();

    await invitePage.getByRole('link', { name: /Play Now/i }).click();
    await invitePage.getByRole('button', { name: 'Ready Up' }).click();

    const overlay = invitePage.getByRole('toolbar', {
      name: new RegExp(`${romTitle} emulator controls`, 'i'),
    });
    await expect(overlay).toBeVisible({ timeout: 20_000 });

    const saveButton = overlay.getByRole('button', { name: 'Save State' });
    const overlayStatus = overlay.getByTestId('control-overlay-status');
    await expect(overlayStatus).toHaveText(/Live/i, { timeout: 30_000 });
    await saveButton.click();
    await expect(invitePage.getByText(/Saved \d/)).toBeVisible();

    const uploadButton = invitePage.getByRole('button', { name: 'Upload Save' });
    await uploadButton.click();
    await expect(invitePage.getByText('Save uploaded')).toBeVisible();

    const inviteeLogin = await request.post(`${backendBaseUrl}/auth/login`, {
      data: { email: inviteeEmail, password: inviteePassword },
    });
    expect(inviteeLogin.ok()).toBeTruthy();
    const inviteePayload = (await inviteeLogin.json()) as { accessToken: string };

    await expect
      .poll(
        async () =>
          (await fetchLatestSaveState(request, inviteePayload.accessToken, uploadedRomId))
            ?.saveState.id,
      )
      .not.toBeNull();

    await inviteContext.close();
  });
});
