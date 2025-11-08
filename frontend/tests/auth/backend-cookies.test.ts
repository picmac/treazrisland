import { describe, expect, it, beforeEach, vi } from "vitest";

type CookieRecord = { name: string; value: string; path?: string; domain?: string; httpOnly?: boolean; secure?: boolean; sameSite?: "lax" | "strict" | "none"; maxAge?: number; expires?: Date };

const store: CookieRecord[] = [];

vi.mock("next/headers", () => ({
  cookies: () => ({
    getAll: () => store,
    set: (cookie: CookieRecord) => {
      const index = store.findIndex((existing) => existing.name === cookie.name);
      if (index >= 0) {
        store.splice(index, 1, cookie);
      } else {
        store.push(cookie);
      }
    }
  })
}));

import { applyBackendCookies, buildCookieHeaderFromStore } from "@/src/lib/server/backend-cookies";

describe("backend cookie helpers", () => {
  beforeEach(() => {
    store.length = 0;
  });

  it("parses Set-Cookie headers and stores them", async () => {
    await applyBackendCookies([
      "treaz_refresh=abc; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=1200",
      "theme=retro; Path=/settings; SameSite=None; Secure"
    ]);

    expect(store).toHaveLength(2);
    expect(store[0]).toMatchObject({
      name: "treaz_refresh",
      value: "abc",
      path: "/",
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      maxAge: 1200
    });
    expect(store[1]).toMatchObject({ name: "theme", value: "retro", path: "/settings", sameSite: "none", secure: true });
  });

  it("builds cookie header from stored values", async () => {
    store.push(
      { name: "treaz_refresh", value: "abc" },
      { name: "pixel_theme", value: "monkey" }
    );

    await expect(buildCookieHeaderFromStore()).resolves.toBe("treaz_refresh=abc; pixel_theme=monkey");
  });

  it("returns undefined when no cookies exist", async () => {
    await expect(buildCookieHeaderFromStore()).resolves.toBeUndefined();
  });
});
