import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import nextConfig from "../../next.config.mjs";
import {
  buildSecurityHeaders,
  createContentSecurityPolicy
} from "../../security-headers.mjs";

const ORIGINAL_ENV = { ...process.env };

function restoreEnv() {
  for (const key of Object.keys(process.env)) {
    delete process.env[key];
  }

  Object.assign(process.env, ORIGINAL_ENV);
}

beforeEach(() => {
  restoreEnv();
  delete process.env.TREAZ_RUNTIME_ENV;
  delete process.env.GITHUB_ACTIONS;
});

afterEach(() => {
  restoreEnv();
});

describe("createContentSecurityPolicy", () => {
  test("includes baseline directives", () => {
    process.env.TREAZ_TLS_MODE = "http";
    const csp = createContentSecurityPolicy();
    const scriptDirective = csp
      .split("; ")
      .find((directive) => directive.startsWith("script-src"));
    const connectDirective = csp
      .split("; ")
      .find((directive) => directive.startsWith("connect-src"));

    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("report-uri /api/csp-report");
    expect(scriptDirective).toBe("script-src 'self' https: blob: 'unsafe-inline'");
    expect(connectDirective).toContain("http:");
    expect(connectDirective).toContain("ws:");
    expect(connectDirective).toContain("wss:");
    expect(csp).not.toContain("upgrade-insecure-requests");
  });

  test("adds nonce directives when provided", () => {
    process.env.TREAZ_RUNTIME_ENV = "production";

    const csp = createContentSecurityPolicy({ nonce: "nonce-value" });
    const scriptDirective = csp
      .split("; ")
      .find((directive) => directive.startsWith("script-src"));

    expect(scriptDirective).toContain("'nonce-nonce-value'");
    expect(scriptDirective).toContain("'strict-dynamic'");
    expect(scriptDirective).not.toContain("'unsafe-inline'");
  });

  test("keeps inline script allowance with nonce outside production", () => {
    process.env.TREAZ_RUNTIME_ENV = "development";

    const csp = createContentSecurityPolicy({ nonce: "nonce-value" });
    const scriptDirective = csp
      .split("; ")
      .find((directive) => directive.startsWith("script-src"));

    expect(scriptDirective).toContain("'nonce-nonce-value'");
    expect(scriptDirective).toContain("'unsafe-inline'");
    expect(scriptDirective).not.toContain("'strict-dynamic'");
  });

  test("whitelists the media CDN origin when present", () => {
    process.env.NEXT_PUBLIC_MEDIA_CDN = "https://cdn.treazris.land/static";
    process.env.TREAZ_TLS_MODE = "https";

    const csp = createContentSecurityPolicy();

    expect(csp).toContain("https://cdn.treazris.land");
    expect(csp).toContain("upgrade-insecure-requests");
  });

  test("enables strict directives by default when TLS mode is unset", () => {
    delete process.env.TREAZ_TLS_MODE;
    process.env.NODE_ENV = "production";
    delete process.env.TREAZ_RUNTIME_ENV;

    const csp = createContentSecurityPolicy();
    const connectDirective = csp
      .split("; ")
      .find((directive) => directive.startsWith("connect-src"));

    expect(csp).toContain("upgrade-insecure-requests");
    expect(connectDirective).not.toContain("http:");
    expect(connectDirective).not.toContain("ws:");
    expect(connectDirective).toContain("wss:");
  });

  test("throws in production when TREAZ_TLS_MODE is invalid", () => {
    process.env.TREAZ_TLS_MODE = "bogus";
    process.env.NODE_ENV = "production";

    expect(() => createContentSecurityPolicy()).toThrow(
      /Unsupported TREAZ_TLS_MODE value/,
    );
  });

  test("treats automatic TLS mode as disabled outside production", () => {
    process.env.TREAZ_TLS_MODE = "auto";
    process.env.NODE_ENV = "development";
    delete process.env.TREAZ_RUNTIME_ENV;

    const csp = createContentSecurityPolicy();
    const connectDirective = csp
      .split("; ")
      .find((directive) => directive.startsWith("connect-src"));

    expect(csp).not.toContain("upgrade-insecure-requests");
    expect(connectDirective).toContain("http:");
    expect(connectDirective).toContain("ws:");
  });

  test("treats GitHub Actions auto builds as LAN-friendly", () => {
    process.env.TREAZ_TLS_MODE = "auto";
    process.env.NODE_ENV = "production";
    process.env.GITHUB_ACTIONS = "true";

    const csp = createContentSecurityPolicy();
    const connectDirective = csp
      .split("; ")
      .find((directive) => directive.startsWith("connect-src"));

    expect(csp).not.toContain("upgrade-insecure-requests");
    expect(connectDirective).toContain("http:");
    expect(connectDirective).toContain("ws:");
  });

  test("defaults to LAN-friendly directives when NODE_ENV is missing", () => {
    process.env.TREAZ_TLS_MODE = "auto";
    delete process.env.NODE_ENV;
    delete process.env.GITHUB_ACTIONS;

    const csp = createContentSecurityPolicy();
    const connectDirective = csp
      .split("; ")
      .find((directive) => directive.startsWith("connect-src"));

    expect(csp).not.toContain("upgrade-insecure-requests");
    expect(connectDirective).toContain("http:");
    expect(connectDirective).toContain("ws:");
  });

  test("allows forcing LAN mode with TREAZ_RUNTIME_ENV aliases", () => {
    process.env.TREAZ_TLS_MODE = "auto";
    process.env.NODE_ENV = "production";
    process.env.TREAZ_RUNTIME_ENV = "lan";

    const csp = createContentSecurityPolicy();
    const connectDirective = csp
      .split("; ")
      .find((directive) => directive.startsWith("connect-src"));

    expect(csp).not.toContain("upgrade-insecure-requests");
    expect(connectDirective).toContain("http:");
    expect(connectDirective).toContain("ws:");
  });

  test("honours production aliases from TREAZ_RUNTIME_ENV", () => {
    delete process.env.TREAZ_TLS_MODE;
    process.env.NODE_ENV = "development";
    process.env.TREAZ_RUNTIME_ENV = "internet";

    const csp = createContentSecurityPolicy();
    const connectDirective = csp
      .split("; ")
      .find((directive) => directive.startsWith("connect-src"));

    expect(csp).toContain("upgrade-insecure-requests");
    expect(connectDirective).not.toContain("http:");
    expect(connectDirective).toContain("wss:");
  });

  test("throws in production when TREAZ_RUNTIME_ENV is invalid", () => {
    delete process.env.TREAZ_TLS_MODE;
    process.env.NODE_ENV = "production";
    process.env.TREAZ_RUNTIME_ENV = "unknown-stage";

    expect(() => createContentSecurityPolicy()).toThrow(
      /Unsupported TREAZ_RUNTIME_ENV value/,
    );
  });

  test("logs a warning for invalid runtime stages outside production", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    delete process.env.TREAZ_TLS_MODE;
    process.env.NODE_ENV = "development";
    process.env.TREAZ_RUNTIME_ENV = "mars";

    const csp = createContentSecurityPolicy();
    expect(csp).toContain("upgrade-insecure-requests");
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("Unsupported TREAZ_RUNTIME_ENV value"),
    );
    warnSpy.mockRestore();
  });
});

describe("buildSecurityHeaders", () => {
  test("returns TLS headers when enabled", () => {
    process.env.TREAZ_TLS_MODE = "https";

    const headers = buildSecurityHeaders();

    expect(headers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: "Content-Security-Policy",
          value: expect.stringContaining("default-src 'self'")
        }),
        { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "X-Frame-Options", value: "DENY" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" }
      ])
    );
  });

  test("omits TLS-only headers when disabled", () => {
    process.env.TREAZ_TLS_MODE = "http";

    const headers = buildSecurityHeaders();

    const headerKeys = headers.map((header) => header.key);
    expect(headerKeys).not.toContain("Strict-Transport-Security");
  });

  test("resolves automatic TLS mode based on runtime stage", () => {
    process.env.TREAZ_TLS_MODE = "auto";
    process.env.NODE_ENV = "development";
    delete process.env.TREAZ_RUNTIME_ENV;

    const devHeaders = buildSecurityHeaders();
    const devKeys = devHeaders.map((header) => header.key);
    expect(devKeys).not.toContain("Strict-Transport-Security");

    process.env.NODE_ENV = "production";
    const prodHeaders = buildSecurityHeaders();
    const prodKeys = prodHeaders.map((header) => header.key);
    expect(prodKeys).toContain("Strict-Transport-Security");

    process.env.NODE_ENV = "development";
    process.env.TREAZ_RUNTIME_ENV = "prod";
    const forcedProdHeaders = buildSecurityHeaders();
    const forcedProdKeys = forcedProdHeaders.map((header) => header.key);
    expect(forcedProdKeys).toContain("Strict-Transport-Security");
  });

  test("disables Strict-Transport-Security for GitHub Actions auto builds", () => {
    process.env.TREAZ_TLS_MODE = "auto";
    process.env.NODE_ENV = "production";
    process.env.GITHUB_ACTIONS = "true";

    const headers = buildSecurityHeaders();
    const headerKeys = headers.map((header) => header.key);

    expect(headerKeys).not.toContain("Strict-Transport-Security");
  });

  test("omits Strict-Transport-Security when NODE_ENV is missing", () => {
    process.env.TREAZ_TLS_MODE = "auto";
    delete process.env.NODE_ENV;
    delete process.env.GITHUB_ACTIONS;

    const headers = buildSecurityHeaders();
    const headerKeys = headers.map((header) => header.key);

    expect(headerKeys).not.toContain("Strict-Transport-Security");
  });

  test("logs a warning and falls back to HTTPS headers for invalid mode in non-production", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    process.env.TREAZ_TLS_MODE = "invalid";
    process.env.NODE_ENV = "test";

    const headers = buildSecurityHeaders();

    expect(headers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: "Strict-Transport-Security" })
      ])
    );
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("Unsupported TREAZ_TLS_MODE value"),
    );
    warnSpy.mockRestore();
  });
});

describe("next.config headers integration", () => {
  test("applies the security headers to all routes", async () => {
    process.env.TREAZ_TLS_MODE = "https";
    process.env.NODE_ENV = "production";

    const headerConfig = await nextConfig.headers?.();

    const headerEntry = headerConfig?.find((entry) => entry.source === "/(.*)");

    expect(headerEntry).toBeDefined();
    expect(headerEntry?.headers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: "Strict-Transport-Security" }),
        expect.objectContaining({ key: "X-Content-Type-Options" }),
        expect.objectContaining({ key: "X-Frame-Options" }),
        expect.objectContaining({ key: "Referrer-Policy" })
      ])
    );
    expect(headerEntry?.headers).toEqual(
      expect.not.arrayContaining([
        expect.objectContaining({ key: "Content-Security-Policy" })
      ])
    );
  });

  test("omits Strict-Transport-Security when TLS mode is http", async () => {
    process.env.TREAZ_TLS_MODE = "http";
    process.env.NODE_ENV = "development";

    const headerConfig = await nextConfig.headers?.();
    const headerEntry = headerConfig?.find((entry) => entry.source === "/(.*)");

    expect(headerEntry).toBeDefined();
    expect(headerEntry?.headers).toEqual(
      expect.not.arrayContaining([
        expect.objectContaining({ key: "Strict-Transport-Security" })
      ])
    );
    expect(headerEntry?.headers).toEqual(
      expect.not.arrayContaining([
        expect.objectContaining({ key: "Content-Security-Policy" })
      ])
    );
  });
});
