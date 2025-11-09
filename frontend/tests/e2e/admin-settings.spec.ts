import { test, expect } from "@playwright/test";

const initialSettings = {
  systemProfile: {
    instanceName: "TREAZRISLAND",
    timezone: "UTC",
    baseUrl: "https://treaz.example",
  },
  storage: {
    driver: "filesystem" as const,
    localRoot: "/var/lib/treaz",
    bucketAssets: "assets",
    bucketRoms: "roms",
    bucketBios: "bios",
  },
  email: { provider: "none" as const },
  metrics: { enabled: false, allowedCidrs: [] as string[] },
  screenscraper: {},
  personalization: {},
};

test.describe("Admin settings console", () => {
  test("saves system profile and blocks invalid metrics payloads", async ({ page }) => {
    const updatePayloads: unknown[] = [];
    let currentSettings = structuredClone(initialSettings);

    await page.route("**/auth/refresh", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          user: {
            id: "admin-1",
            email: "admin@example.com",
            nickname: "captain",
            role: "ADMIN",
          },
          accessToken: "test-token",
          refreshExpiresAt: new Date(Date.now() + 60_000).toISOString(),
        }),
      });
    });

    await page.route("**/admin/settings", async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(currentSettings),
        });
        return;
      }

      const payload = route.request().postDataJSON();
      updatePayloads.push(payload);
      currentSettings = {
        ...currentSettings,
        ...payload,
      };
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(currentSettings),
      });
    });

    await page.goto("/admin/settings");
    await expect(page.getByRole("heading", { name: /System Configuration Nexus/i })).toBeVisible();

    const systemProfileForm = page.locator("form").first();
    await systemProfileForm.getByLabel(/Instance name/i).fill("Treaz HQ");
    await systemProfileForm.getByLabel(/Timezone/i).fill("America/New_York");
    await systemProfileForm.getByLabel(/Base URL/i).fill("https://hq.example.com");

    const putPromise = page.waitForResponse(
      (response) => response.url().includes("/admin/settings") && response.request().method() === "PUT",
    );
    await systemProfileForm.getByRole("button", { name: /Save changes/i }).click();
    const response = await putPromise;
    expect(response.status()).toBe(200);

    expect(updatePayloads).toHaveLength(1);
    expect(updatePayloads[0]).toMatchObject({
      systemProfile: {
        instanceName: "Treaz HQ",
        timezone: "America/New_York",
        baseUrl: "https://hq.example.com",
      },
    });
    await expect(page.getByText(/System profile updated\./i)).toBeVisible();

    const metricsForm = page.locator("form").nth(3);
    await metricsForm.locator("label", { hasText: /Enable metrics/i }).click();
    await metricsForm.getByRole("button", { name: /Save changes/i }).click();

    await expect(page.getByText(/Token is required when metrics are enabled\./i)).toBeVisible();
    expect(updatePayloads).toHaveLength(1);
  });
});
