import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type LocationDescriptor = PropertyDescriptor | undefined;
type WindowDescriptor = PropertyDescriptor | undefined;

type EnvSnapshot = Record<string, string | undefined>;

const ENV_KEYS = [
  "AUTH_API_BASE_URL",
  "NEXT_PUBLIC_API_BASE_URL",
  "VERCEL_URL",
  "NEXT_PUBLIC_SITE_URL",
  "NEXT_PUBLIC_DEV_API_PORT",
  "NEXT_PUBLIC_BACKEND_PORT",
  "NEXT_PUBLIC_API_PORT",
  "NODE_ENV",
] as const;

describe("apiRequest", () => {
  let originalEnv: EnvSnapshot;
  let originalLocationDescriptor: LocationDescriptor;
  let originalWindowDescriptor: WindowDescriptor;

  beforeEach(() => {
    vi.resetModules();
    originalEnv = ENV_KEYS.reduce<EnvSnapshot>((acc, key) => {
      acc[key] = process.env[key];
      delete process.env[key];
      return acc;
    }, {});

    originalLocationDescriptor = Object.getOwnPropertyDescriptor(globalThis, "location");
    originalWindowDescriptor = Object.getOwnPropertyDescriptor(globalThis, "window");
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

    if (originalWindowDescriptor) {
      Object.defineProperty(globalThis, "window", originalWindowDescriptor);
    } else {
      // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
      delete (globalThis as { window?: unknown }).window;
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

  it("prefers AUTH_API_BASE_URL when NEXT_PUBLIC_API_BASE_URL is undefined in browsers", async () => {
    process.env.AUTH_API_BASE_URL = "https://auth-only.example";

    Object.defineProperty(globalThis, "window", { configurable: true, value: {} });
    Object.defineProperty(globalThis, "location", { configurable: true, value: { origin: "https://ignored.test" } });

    const { resolveApiBase } = await import("./client");

    expect(resolveApiBase()).toBe("https://auth-only.example");
  });

  it("switches dev port 3000 to 3001 when inferred from runtime location", async () => {
    Object.defineProperty(globalThis, "location", {
      configurable: true,
      value: {
        protocol: "http:",
        hostname: "192.168.1.42",
        port: "3000",
      },
    });

    const { resolveApiBase } = await import("./client");

    expect(resolveApiBase()).toBe("http://192.168.1.42:3001");
  });

  it("treats RFC1918 hosts as private networks even in production", async () => {
    process.env.NODE_ENV = "production";

    Object.defineProperty(globalThis, "location", {
      configurable: true,
      value: {
        protocol: "http:",
        hostname: "192.168.50.2",
        port: "3000",
      },
    });

    const { resolveApiBase } = await import("./client");

    expect(resolveApiBase()).toBe("http://192.168.50.2:3001");
  });

  it("derives backend port from forwarded headers in dev", async () => {
    const headers = new Headers({
      "x-forwarded-host": "pirate.lan:3000",
      "x-forwarded-proto": "http",
    });

    const { resolveApiBase } = await import("./client");

    expect(resolveApiBase(headers)).toBe("http://pirate.lan:3001");
  });

  it("preserves forwarded port 3000 for non-loopback hosts in production", async () => {
    process.env.NODE_ENV = "production";

    const headers = new Headers({
      "x-forwarded-host": "runner.treaz.lan:3000",
      "x-forwarded-proto": "http",
    });

    const { resolveApiBase } = await import("./client");

    expect(resolveApiBase(headers)).toBe("http://runner.treaz.lan:3000");
  });

  it("honours NEXT_PUBLIC_DEV_API_PORT overrides when mapping dev requests", async () => {
    process.env.NEXT_PUBLIC_DEV_API_PORT = "4000";

    const headers = new Headers({
      host: "captains.cove:3000",
      "x-forwarded-proto": "http",
    });

    const { resolveApiBase } = await import("./client");

    expect(resolveApiBase(headers)).toBe("http://captains.cove:4000");
  });

  it("wraps IPv6 hosts when constructing the origin", async () => {
    Object.defineProperty(globalThis, "location", {
      configurable: true,
      value: {
        protocol: "http:",
        hostname: "::1",
        port: "3000",
      },
    });

    const { resolveApiBase } = await import("./client");

    expect(resolveApiBase()).toBe("http://[::1]:3001");
  });

  it("derives API base from request headers when provided", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(null, {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const forwardedHeaders = new Headers({
      "x-forwarded-host": "runner.treaz.lan:3000",
      "x-forwarded-proto": "http",
    });

    const { apiRequest } = await import("./client");

    await apiRequest("/status", { requestHeaders: forwardedHeaders });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://runner.treaz.lan:3001/status",
      expect.objectContaining({ credentials: "include" })
    );
  });
});
