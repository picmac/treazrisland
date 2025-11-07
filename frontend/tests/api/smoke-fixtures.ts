import type { Page } from "@playwright/test";

export type SmokeFixtureConfig = {
  adminEmail: string;
  adminNickname: string;
  adminPassword: string;
  instanceName: string;
  timezone: string;
  baseUrl: string;
  localRoot: string;
  inviteToken: string;
  inviteEmail: string;
  userNickname: string;
  userDisplayName: string;
  userPassword: string;
  userLoginIdentifier: string;
  platformName: string;
  platformSlug: string;
  romId: string;
  romTitle: string;
};

export function getSmokeFixtureConfig(): SmokeFixtureConfig {
  const inviteEmail = process.env.SMOKE_INVITE_EMAIL ?? "deckhand-smoke@example.com";
  const userNickname = process.env.SMOKE_USER_NICKNAME ?? "deckhand-smoke";

  return {
    adminEmail: process.env.SMOKE_ADMIN_EMAIL ?? "smoke.admin@example.com",
    adminNickname: process.env.SMOKE_ADMIN_NICKNAME ?? "captain-smoke",
    adminPassword: process.env.SMOKE_ADMIN_PASSWORD ?? "Secret1234!",
    instanceName: process.env.SMOKE_INSTANCE_NAME ?? "Smoke Test Vault",
    timezone: process.env.SMOKE_TIMEZONE ?? "Etc/UTC",
    baseUrl: process.env.SMOKE_BASE_URL ?? "http://localhost:3000",
    localRoot:
      process.env.SMOKE_STORAGE_ROOT ??
      process.env.STORAGE_LOCAL_ROOT ??
      "/var/treaz/storage",
    inviteToken: process.env.SMOKE_INVITE_TOKEN ?? "smoke-test-token",
    inviteEmail,
    userNickname,
    userDisplayName: process.env.SMOKE_USER_DISPLAY_NAME ?? "Deckhand Smoke",
    userPassword: process.env.SMOKE_USER_PASSWORD ?? "StrongPass1!",
    userLoginIdentifier: process.env.SMOKE_USER_LOGIN ?? inviteEmail,
    platformName: process.env.SMOKE_PLATFORM_NAME ?? "Smoke Test Console",
    platformSlug: process.env.SMOKE_PLATFORM_SLUG ?? "smoke-snes",
    romId: process.env.SMOKE_ROM_ID ?? "rom_smoke_demo",
    romTitle: process.env.SMOKE_ROM_TITLE ?? "Smoke Test Adventure",
  };
}

export async function resetSmokeSession(page: Page): Promise<void> {
  await page.context().clearCookies();
}
