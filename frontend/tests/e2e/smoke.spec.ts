import { test, expect } from "@playwright/test";
import { Buffer } from "node:buffer";

const runSmoke = ["1", "true", "yes"].includes(
  (process.env.RUN_SMOKE_E2E ?? "").toLowerCase(),
);
const describe = runSmoke ? test.describe : test.describe.skip;

describe("@smoke TREAZRISLAND key flows", () => {
  test.beforeEach(async ({ page }) => {
    await page.route("**/auth/refresh", (route) =>
      route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({ message: "Unauthenticated" }),
      }),
    );
  });

  test("onboarding surfaces first admin setup", async ({ page }) => {
    await page.route("**/onboarding/status", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ needsSetup: true }),
      }),
    );

    await page.goto("/onboarding");

    await expect(
      page.getByRole("heading", { name: /Welcome, Keeper of the Vault/i }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Create Admin/i }),
    ).toBeVisible();
  });

  test("login handles MFA challenge then redirects to play", async ({
    page,
  }) => {
    let loginAttempts = 0;
    await page.route("**/auth/login", (route) => {
      loginAttempts += 1;
      if (loginAttempts === 1) {
        return route.fulfill({
          status: 401,
          contentType: "application/json",
          body: JSON.stringify({ message: "MFA required", mfaRequired: true }),
        });
      }

      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          user: {
            id: "user-1",
            email: "pirate@example.com",
            nickname: "Captain",
            role: "ADMIN",
          },
          accessToken: "fake-token",
          refreshExpiresAt: new Date(Date.now() + 60_000).toISOString(),
        }),
      });
    });

    await page.goto("/auth/login");

    await page.getByLabel(/Email or Nickname/i).fill("pirate@example.com");
    await page.getByLabel(/Password/i).fill("Secret123!");
    await page.getByRole("button", { name: /Log In/i }).click();

    await expect(page.getByText(/Enter your MFA code/i)).toBeVisible();

    await page.getByLabel(/MFA Code/i).fill("123456");
    await page.getByRole("button", { name: /Log In/i }).click();

    await expect(page).toHaveURL(/\/play/);
  });

  test("library explorer lists mocked platforms", async ({ page }) => {
    await page.route("**/platforms", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          platforms: [
            {
              id: "nes",
              name: "Nintendo Entertainment System",
              slug: "nes",
              shortName: "NES",
              screenscraperId: 1,
              romCount: 42,
              featuredRom: {
                id: "rom-1",
                title: "Legend of Pixel",
                updatedAt: new Date().toISOString(),
                assetSummary: {
                  cover: null,
                  screenshots: [],
                  videos: [],
                  manuals: [],
                },
              },
            },
          ],
        }),
      }),
    );

    await page.goto("/platforms");

    await expect(
      page.getByRole("heading", { name: /Choose your platform/i }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: /Nintendo Entertainment System/i }),
    ).toBeVisible();
    await expect(page.getByText(/42 ROMs/)).toBeVisible();
  });

  test("admin upload queue accepts files for processing", async ({ page }) => {
    await page.route("**/admin/platforms", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          platforms: [
            {
              id: "snes",
              name: "Super Nintendo",
              slug: "snes",
              shortName: "SNES",
            },
          ],
        }),
      }),
    );

    await page.goto("/admin/uploads");

    await expect(
      page.getByRole("heading", { name: /ROM & BIOS Dropzone/i }),
    ).toBeVisible();

    const romBuffer = Buffer.from("pretend rom archive");
    await page.setInputFiles('input[type="file"]', {
      name: "test-rom.zip",
      mimeType: "application/zip",
      buffer: romBuffer,
    });

    await expect(page.getByText(/Queue: 1 files/i)).toBeVisible();
  });
});
