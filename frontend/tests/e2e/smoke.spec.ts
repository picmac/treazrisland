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

  test("completes onboarding, redeems invite, and signs in", async ({ page }) => {
    const nowIso = () => new Date().toISOString();
    const stepsState: Record<string, { status: string; updatedAt: string; payload?: unknown }> = {
      "first-admin": { status: "PENDING", updatedAt: nowIso() },
      "system-profile": { status: "PENDING", updatedAt: nowIso() },
      integrations: { status: "PENDING", updatedAt: nowIso() },
      personalization: { status: "PENDING", updatedAt: nowIso() },
    };

    const computePending = () =>
      Object.entries(stepsState)
        .filter(([, step]) => step.status === "PENDING")
        .map(([key]) => key);

    const computeSetupComplete = () =>
      stepsState["first-admin"].status === "COMPLETED" &&
      stepsState["system-profile"].status === "COMPLETED" &&
      stepsState.integrations.status !== "PENDING" &&
      stepsState.personalization.status !== "PENDING";

    await page.route("**/onboarding/status", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          needsSetup: !computeSetupComplete(),
          setupComplete: computeSetupComplete(),
          steps: stepsState,
          pendingSteps: computePending(),
        }),
      }),
    );

    await page.route("**/onboarding/admin", async (route) => {
      stepsState["first-admin"] = {
        status: "COMPLETED",
        updatedAt: nowIso(),
        payload: { userId: "user_1" },
      };
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({
          user: {
            id: "user_1",
            email: "admin@example.com",
            nickname: "captain",
            role: "ADMIN",
          },
          accessToken: "admin-token",
          refreshExpiresAt: new Date(Date.now() + 60_000).toISOString(),
        }),
      });
    });

    await page.route("**/admin/settings", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          systemProfile: {
            instanceName: "TREAZRISLAND",
            timezone: "UTC",
          },
          storage: {
            driver: "filesystem",
            localRoot: "/var/treaz/storage",
            bucketAssets: "assets",
            bucketRoms: "roms",
            bucketBios: "bios",
          },
          email: { provider: "none" },
          metrics: { enabled: false, allowedCidrs: [] },
          screenscraper: {},
          personalization: {},
        }),
      }),
    );

    await page.route("**/onboarding/steps/system-profile", async (route) => {
      const body = JSON.parse(route.request().postData() ?? "{}") as {
        settings?: { systemProfile?: unknown };
      };
      stepsState["system-profile"] = {
        status: "COMPLETED",
        updatedAt: nowIso(),
        payload: body.settings,
      };
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          setupComplete: computeSetupComplete(),
          steps: stepsState,
        }),
      });
    });

    await page.route("**/onboarding/steps/integrations", async (route) => {
      stepsState.integrations = {
        status: "SKIPPED",
        updatedAt: nowIso(),
      };
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          setupComplete: computeSetupComplete(),
          steps: stepsState,
        }),
      });
    });

    await page.route("**/onboarding/steps/personalization", async (route) => {
      const body = JSON.parse(route.request().postData() ?? "{}") as {
        settings?: { personalization?: unknown };
      };
      stepsState.personalization = {
        status: "COMPLETED",
        updatedAt: nowIso(),
        payload: body.settings,
      };
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          setupComplete: computeSetupComplete(),
          steps: stepsState,
        }),
      });
    });

    await page.route("**/auth/invitations/preview", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          invitation: {
            role: "USER",
            email: "crew@example.com",
          },
        }),
      }),
    );

    await page.route("**/auth/signup", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          user: {
            id: "user_2",
            email: "crew@example.com",
            nickname: "deckhand",
            role: "USER",
          },
          accessToken: "user-token",
          refreshExpiresAt: new Date(Date.now() + 120_000).toISOString(),
        }),
      }),
    );

    await page.route("**/auth/login", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          user: {
            id: "user_2",
            email: "crew@example.com",
            nickname: "deckhand",
            role: "USER",
          },
          accessToken: "login-token",
          refreshExpiresAt: new Date(Date.now() + 180_000).toISOString(),
        }),
      }),
    );

    await page.goto("/onboarding");

    await expect(
      page.getByRole("heading", { name: /Welcome, Keeper of the Vault/i }),
    ).toBeVisible();

    await page.getByLabel(/Admin Email/i).fill("admin@example.com");
    await page.getByLabel(/Nickname/i).fill("captain");
    await page.getByLabel(/^Password$/i).fill("Secret1234");
    await page.getByRole("button", { name: /Create Admin/i }).click();

    await expect(
      page.getByRole("heading", { name: /Configure system profile/i }),
    ).toBeVisible();

    await page.getByLabel(/Instance name/i).fill("Vault of Wonders");
    await page.getByLabel(/Timezone/i).fill("America/New_York");
    await page.getByLabel(/Base URL/i).fill("https://vault.example.com");
    await page.getByLabel(/Local root/i).fill("/srv/treaz");
    await page.getByRole("button", { name: /Save and continue/i }).click();

    await expect(
      page.getByRole("heading", { name: /Connect integrations/i }),
    ).toBeVisible();

    await page.getByRole("button", { name: /Skip for now/i }).click();

    await expect(
      page.getByRole("heading", { name: /Personalize your portal/i }),
    ).toBeVisible();

    await page.getByLabel(/Portal theme/i).selectOption("midnight-harbor");
    await page.getByRole("button", { name: /Finish setup/i }).click();

    await expect(page.getByRole("heading", { name: /Setup complete/i })).toBeVisible();

    await page.goto("/auth/signup?token=treaz-token");

    await expect(page.getByRole("heading", { name: /Welcome Aboard/i })).toBeVisible();
    await page.getByLabel(/Nickname/i).fill("deckhand");
    await page.getByLabel(/Display Name/i).fill("Deck Hand");
    await page.getByLabel(/^Password$/i).fill("StrongPass1");
    await page.getByRole("button", { name: /Join as user/i }).click();

    await expect(page).toHaveURL(/\/play/);

    await page.goto("/auth/login");
    await page.getByLabel(/Email or Nickname/i).fill("crew@example.com");
    await page.getByLabel(/^Password$/i).fill("StrongPass1");
    await page.getByRole("button", { name: /Log In/i }).click();

    await expect(page).toHaveURL(/\/play/);
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
              heroArt: null,
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
              heroArt: null,
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

  test("library explorer shows curated hero art when provided", async ({ page }) => {
    const now = new Date().toISOString();
    await page.route("**/platforms", (route) =>
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
              screenscraperId: 2,
              romCount: 1,
              heroArt: {
                assetId: "asset_1",
                slug: "snes-hero",
                kind: "HERO",
                status: "ACTIVE",
                storageKey: "creative-assets/snes/hero.png",
                mimeType: "image/png",
                width: 800,
                height: 450,
                fileSize: 2048,
                checksumSha256: "abcdef",
                signedUrl: "https://cdn.test/creative-assets/snes/hero.png",
                signedUrlExpiresAt: now,
                updatedAt: now,
                notes: "Curated cover"
              },
              featuredRom: {
                id: "rom-1",
                title: "Chrono Trigger",
                updatedAt: now,
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
      page.getByText(/Curated hero art/i),
    ).toBeVisible();
  });
});
