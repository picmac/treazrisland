import { expect, test } from '@playwright/test';

import { loginWithPassword } from '../utils/auth';
import { defaultCredentials } from '../utils/credentials';

test.describe('authentication', () => {
  test('admin can log in with provisioned credentials', async ({ page }) => {
    await loginWithPassword(page, defaultCredentials);

    await expect(
      page.getByRole('status').filter({ hasText: 'Password login successful.' }),
    ).toBeVisible();
    await expect(page.getByText(`Session issued for ${defaultCredentials.email}`)).toBeVisible();
  });
});
