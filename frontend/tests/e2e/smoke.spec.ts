import { test, expect } from "@playwright/test";
import { Buffer } from "node:buffer";
import { getSmokeFixtureConfig, resetSmokeSession } from "../api/smoke-fixtures";

const runSmoke = ["1", "true", "yes"].includes(
  (process.env.RUN_SMOKE_E2E ?? "").toLowerCase(),
);
const describe = runSmoke ? test.describe.serial : test.describe.skip;

const fixture = getSmokeFixtureConfig();

describe("@smoke TREAZRISLAND key flows", () => {
  test.beforeEach(async ({ page }) => {
    await resetSmokeSession(page);
  });

  test("completes onboarding and prepares admin workspace", async ({ page }) => {
    const statusPromise = page.waitForResponse(
      (response) =>
        response.url().includes("/onboarding/status") &&
        response.request().method() === "GET",
    );
    await page.goto("/onboarding");
    await expect(
      page.getByRole("heading", { name: /Welcome, Keeper of the Vault/i }),
    ).toBeVisible();
    expect((await statusPromise).status()).toBe(200);

    const createAdminPromise = page.waitForResponse(
      (response) =>
        response.url().includes("/onboarding/admin") &&
        response.request().method() === "POST",
    );
    await page.getByLabel(/Admin Email/i).fill(fixture.adminEmail);
    await page.getByLabel(/Nickname/i).fill(fixture.adminNickname);
    await page.getByLabel(/^Password$/i).fill(fixture.adminPassword);
    await page.getByRole("button", { name: /Create Admin/i }).click();
    expect((await createAdminPromise).status()).toBe(201);

    await expect(
      page.getByRole("heading", { name: /Configure system profile/i }),
    ).toBeVisible();

    const systemProfilePromise = page.waitForResponse(
      (response) =>
        response.url().includes("/onboarding/steps/system-profile") &&
        response.request().method() === "PATCH",
    );
    await page.getByLabel(/Instance name/i).fill(fixture.instanceName);
    await page.getByLabel(/Timezone/i).fill(fixture.timezone);
    await page.getByLabel(/Base URL/i).fill(fixture.baseUrl);
    await page.getByLabel(/Local root/i).fill(fixture.localRoot);
    await page.getByRole("button", { name: /Save and continue/i }).click();
    expect((await systemProfilePromise).status()).toBe(200);

    await expect(
      page.getByRole("heading", { name: /Connect integrations/i }),
    ).toBeVisible();

    const integrationsPromise = page.waitForResponse(
      (response) =>
        response.url().includes("/onboarding/steps/integrations") &&
        response.request().method() === "PATCH",
    );
    await page.getByRole("button", { name: /Skip for now/i }).click();
    expect((await integrationsPromise).status()).toBe(200);

    await expect(
      page.getByRole("heading", { name: /Personalize your portal/i }),
    ).toBeVisible();

    const personalizationPromise = page.waitForResponse(
      (response) =>
        response.url().includes("/onboarding/steps/personalization") &&
        response.request().method() === "PATCH",
    );
    await page.getByLabel(/Portal theme/i).selectOption("midnight-harbor");
    await page.getByRole("button", { name: /Finish setup/i }).click();
    expect((await personalizationPromise).status()).toBe(200);

    await expect(page.getByRole("heading", { name: /Setup complete/i })).toBeVisible();

    const adminPlatformsPromise = page.waitForResponse(
      (response) =>
        response.url().includes("/admin/platforms") &&
        response.request().method() === "GET",
    );
    await page.goto("/admin/uploads");
    expect((await adminPlatformsPromise).status()).toBe(200);
    await expect(
      page.getByRole("heading", { name: /ROM & BIOS Dropzone/i }),
    ).toBeVisible();

    const romBuffer = Buffer.from("smoke-rom-placeholder");
    await page.setInputFiles('input[type="file"]', {
      name: "smoke-demo.zip",
      mimeType: "application/zip",
      buffer: romBuffer,
    });

    await expect(page.getByText(/Queue:\s*1 files/i)).toBeVisible();
  });

  test("redeems invitation, browses library, and boots emulator", async ({ page }) => {
    const previewPromise = page.waitForResponse(
      (response) =>
        response.url().includes("/auth/invitations/preview") &&
        response.request().method() === "POST",
    );
    await page.goto(`/auth/signup?token=${encodeURIComponent(fixture.inviteToken)}`);
    expect((await previewPromise).status()).toBe(200);
    await expect(page.getByRole("heading", { name: /Welcome Aboard/i })).toBeVisible();
    await expect(page.getByText(fixture.inviteEmail)).toBeVisible();

    await page.getByLabel(/Nickname/i).fill(fixture.userNickname);
    await page.getByLabel(/Display Name/i).fill(fixture.userDisplayName);
    await page.getByLabel(/^Password$/i).fill(fixture.userPassword);

    const signupPromise = page.waitForResponse(
      (response) =>
        response.url().includes("/auth/signup") &&
        response.request().method() === "POST",
    );
    await page.getByRole("button", { name: /Join as/i }).click();
    expect((await signupPromise).status()).toBe(200);
    await expect(page).toHaveURL(/\/play/);

    await resetSmokeSession(page);

    await page.goto("/auth/login");
    await page.getByLabel(/Email or Nickname/i).fill(fixture.userLoginIdentifier);
    await page.getByLabel(/^Password$/i).fill(fixture.userPassword);
    const loginPromise = page.waitForResponse(
      (response) =>
        response.url().includes("/auth/login") &&
        response.request().method() === "POST",
    );
    await page.getByRole("button", { name: /Log In/i }).click();
    expect((await loginPromise).status()).toBe(200);
    await expect(page).toHaveURL(/\/play/);

    const platformsPromise = page.waitForResponse(
      (response) =>
        response.url().includes("/platforms") &&
        response.request().method() === "GET",
    );
    const romListPromise = page.waitForResponse(
      (response) =>
        response.url().includes("/roms") &&
        response.request().method() === "GET" &&
        response.request().url().includes(`platform=${fixture.platformSlug}`),
    );
    await page.goto("/library");
    expect((await platformsPromise).status()).toBe(200);
    expect((await romListPromise).status()).toBe(200);
    await expect(
      page.getByRole("heading", { name: /Discover the vault/i }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { level: 2, name: fixture.platformName }),
    ).toBeVisible();
    await expect(page.getByRole("heading", { name: fixture.romTitle })).toBeVisible();
    await page
      .getByRole("button", { name: new RegExp(fixture.platformName, "i") })
      .click();
    await expect(page.getByText(/Save-state sync coming soon/i)).toBeVisible();

    const emulatorBundlePromise = page.waitForResponse((response) =>
      response.url().includes("/vendor/emulatorjs/emulator.js"),
    );
    const romBinaryPromise = page.waitForResponse(
      (response) =>
        response.url().includes(`/play/roms/${fixture.romId}/download`) &&
        response.request().method() === "GET",
    );
    const playStatesPromise = page.waitForResponse(
      (response) =>
        response.url().includes("/play-states") &&
        response.request().method() === "GET" &&
        response.request().url().includes(`romId=${fixture.romId}`),
    );

    await page.goto(`/play/${fixture.romId}`);
    expect((await emulatorBundlePromise).status()).toBe(200);
    expect((await romBinaryPromise).status()).toBe(200);
    expect((await playStatesPromise).status()).toBe(200);
    await expect(page.getByTestId("emulator-canvas")).toBeVisible();
  });
});
