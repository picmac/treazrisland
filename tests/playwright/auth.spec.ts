import { expect, test } from '@playwright/test';

import { backendBaseUrl, frontendBaseUrl } from './utils/env';
import { obtainAccessToken } from './utils/backendApi';
import { seedMagicLinkToken } from './utils/magicLink';

const invitePassword = 'InvitePass123!';

type InviteResponse = { code: string };
type LoginResponse = { user: { id: string; email: string } };

test.describe('authentication onboarding', () => {
  test('redeems an invite and a magic link token', async ({ page, request, context }) => {
    const email = `deckhand+${Date.now()}@treazr.test`;

    const adminToken = await obtainAccessToken(request);

    const inviteResponse = await request.post(`${backendBaseUrl}/auth/invitations`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: { email, expiresInDays: 1 },
    });
    expect(inviteResponse.ok()).toBeTruthy();
    const invitePayload = (await inviteResponse.json()) as InviteResponse;
    const inviteCode = invitePayload.code;

    await page.goto(`/invite/${inviteCode}`);
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Display name (optional)').fill('Deckhand Voyager');
    await page.getByLabel('Password', { exact: true }).fill(invitePassword);
    await page.getByLabel('Confirm password').fill(invitePassword);
    await page.getByRole('button', { name: 'Redeem invite' }).click();

    await page.waitForURL('**/library');
    const inviteTokenHandle = await page.waitForFunction(() =>
      window.localStorage.getItem('treazr.accessToken'),
    );
    expect(await inviteTokenHandle.jsonValue()).toBeTruthy();

    const loginResponse = await request.post(`${backendBaseUrl}/auth/login`, {
      data: { email, password: invitePassword },
    });
    expect(loginResponse.ok()).toBeTruthy();
    const loginPayload = (await loginResponse.json()) as LoginResponse;

    const magicLinkRequest = await request.post(`${backendBaseUrl}/auth/magic-link/request`, {
      data: { email, redirectUrl: `${frontendBaseUrl}/magic-link` },
    });
    expect(magicLinkRequest.status()).toBe(202);
    const { token: requestToken } = (await magicLinkRequest.json()) as { token?: string };

    const magicToken = await seedMagicLinkToken(
      {
        id: loginPayload.user.id,
        email: loginPayload.user.email,
      },
      undefined,
      requestToken,
    );

    await context.clearCookies();
    await page.goto('/');
    await page.evaluate(() => {
      window.localStorage.clear();
      window.sessionStorage.clear();
    });

    await page.goto(`/magic-link/${magicToken}`);
    const magicLinkStatus = page.getByRole('region', { name: 'Magic link' }).getByRole('status');
    await expect(magicLinkStatus).toContainText('Magic link accepted');
    await page.waitForURL('**/library');
    const magicTokenHandle = await page.waitForFunction(() =>
      window.localStorage.getItem('treazr.accessToken'),
    );
    expect(await magicTokenHandle.jsonValue()).toBeTruthy();
  });
});
