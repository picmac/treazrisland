import { expect, type Page } from '@playwright/test';

import { bootstrapAdminAccount } from './backendApi';
import { defaultCredentials, type LoginCredentials } from './credentials';

export async function loginWithPassword(
  page: Page,
  credentials: LoginCredentials = defaultCredentials,
) {
  await bootstrapAdminAccount(page.request, credentials);

  await page.goto('/login');
  await page.getByLabel('Email').fill(credentials.email);
  await page.getByLabel('Password').fill(credentials.password);
  await page.getByRole('button', { name: 'Log in' }).click();

  const tokenHandle = await page.waitForFunction(() =>
    window.localStorage.getItem('treazr.accessToken'),
  );
  const token = await tokenHandle.jsonValue<string | null>();
  expect(token).toBeTruthy();

  return token;
}
