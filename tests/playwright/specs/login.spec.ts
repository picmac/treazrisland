import { test, expect } from '@playwright/test';
import { loginWithPassword } from '../utils/auth';

const credentials = {
  email: 'operator@treazrisland.test',
  password: 'password123',
};

test.describe('authentication', () => {
  test('operator can log in with fallback password', async ({ page }) => {
    await loginWithPassword(page, credentials);

    await expect(
      page.getByRole('status').filter({ hasText: 'Password login successful.' }),
    ).toBeVisible();
    await expect(page.getByText(`Session issued for ${credentials.email}`)).toBeVisible();
  });
});
