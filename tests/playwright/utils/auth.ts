import { expect, type Page } from '@playwright/test';

export type LoginCredentials = {
  email: string;
  password: string;
};

export const defaultCredentials: LoginCredentials = {
  email: 'operator@treazrisland.test',
  password: 'password123',
};

export async function loginWithPassword(
  page: Page,
  credentials: LoginCredentials = defaultCredentials,
) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(credentials.email);
  await page.getByLabel('Password').fill(credentials.password);
  await page.getByRole('button', { name: 'Log in' }).click();

  const status = page.getByRole('status').filter({ hasText: 'Password login successful.' });
  await expect(status).toBeVisible();
  await expect(status).toContainText(`Session issued for ${credentials.email}`);

  const tokenHandle = await page.waitForFunction(() =>
    window.localStorage.getItem('treazr.accessToken'),
  );
  const token = await tokenHandle.jsonValue<string | null>();
  expect(token).toBeTruthy();

  return token;
}
