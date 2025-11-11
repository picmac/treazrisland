import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type LocationDescriptor = PropertyDescriptor | undefined;

type EnvSnapshot = Record<string, string | undefined>;

const ENV_KEYS = [
  "AUTH_API_BASE_URL",
  "NEXT_PUBLIC_API_BASE_URL",
  "VERCEL_URL",
  "NEXT_PUBLIC_SITE_URL",
] as const;

describe("apiRequest", () => {
  let originalEnv: EnvSnapshot;
  let originalLocationDescriptor: LocationDescriptor;

  beforeEach(() => {
    vi.resetModules();
    originalEnv = ENV_KEYS.reduce<EnvSnapshot>((acc, key) => {
      acc[key] = process.env[key];
      delete process.env[key];
      return acc;
    }, {});

    originalLocationDescriptor = Object.getOwnPropertyDescriptor(globalThis, "location");
  });

  afterEach(() => {
    ENV_KEYS.forEach((key) => {
      const value = originalEnv[key];
      if (typeof value === "undefined") {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    });

    if (originalLocationDescriptor) {
      Object.defineProperty(globalThis, "location", originalLocationDescriptor);
    } else {
      // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
      delete (globalThis as { location?: unknown }).location;
    }

    vi.restoreAllMocks();
  });

  it("falls back to window location when explicit API base env vars are missing", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(null, {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    Object.defineProperty(globalThis, "location", {
      configurable: true,
      value: { origin: "https://runtime.test" },
    });

    const { apiRequest } = await import("./client");

    await apiRequest("/status");

    expect(fetchMock).toHaveBeenCalledWith(
      "https://runtime.test/status",
      expect.objectContaining({ credentials: "include" })
    );
  });
});
