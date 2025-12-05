import { expect, test } from '@playwright/test';

import { loginWithPassword } from '../utils/auth';
import { defaultCredentials } from '../utils/credentials';

test.describe('sign out flow', () => {
  test('logs out cleanly and allows a fresh login', async ({ page }) => {
    await loginWithPassword(page, defaultCredentials);

    await page.waitForURL('**/onboarding');
    const tokenAfterLogin = await page.evaluate(() =>
      window.localStorage.getItem('treazr.accessToken'),
    );
    expect(tokenAfterLogin).toBeTruthy();

    await page.getByRole('button', { name: /sign out/i }).click();
    await page.waitForURL('**/login');

    const tokenAfterLogout = await page.evaluate(() =>
      window.localStorage.getItem('treazr.accessToken'),
    );
    expect(tokenAfterLogout).toBeNull();

    const refreshResponse = await page.request.post('/api/auth/refresh');
    expect(refreshResponse.status()).toBe(401);

    await page.getByLabel('Email').fill(defaultCredentials.email);
    await page.getByLabel('Password').fill(defaultCredentials.password);
    await page.getByRole('button', { name: 'Log in' }).click();

    await expect(
      page.getByRole('status').filter({ hasText: 'Password login successful.' }),
    ).toBeVisible();
  });
});
