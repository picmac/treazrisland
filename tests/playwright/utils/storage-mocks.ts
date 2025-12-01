import type { BrowserContext, Page } from '@playwright/test';

export const ONBOARDING_STORAGE_KEY = 'treazr.adminOnboarding.v1';

export async function resetClientStorage(page: Page, context?: BrowserContext) {
  await context?.clearCookies();
  await page.goto('about:blank');
  await page.evaluate(() => {
    try {
      const { localStorage, sessionStorage } = globalThis;
      localStorage?.clear();
      sessionStorage?.clear();
    } catch {
      // Some environments (e.g., about:blank) restrict access to storage.
    }
  });
}

export async function readOnboardingProgress(page: Page) {
  return page.evaluate((key) => {
    const stored = globalThis.localStorage?.getItem(key) ?? globalThis.sessionStorage?.getItem(key);
    return stored ? JSON.parse(stored) : null;
  }, ONBOARDING_STORAGE_KEY);
}
