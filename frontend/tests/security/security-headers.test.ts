import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import nextConfig from "@/next.config";
import {
  buildSecurityHeaders,
  createContentSecurityPolicy
} from "@/security-headers";

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe("createContentSecurityPolicy", () => {
  test("includes baseline directives", () => {
    process.env.TREAZ_TLS_MODE = "http";
    const csp = createContentSecurityPolicy();
    const scriptDirective = csp
      .split("; ")
      .find((directive) => directive.startsWith("script-src"));

    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("report-uri /api/csp-report");
    expect(scriptDirective).toBe("script-src 'self' https: blob: 'unsafe-inline'");
    expect(csp).not.toContain("upgrade-insecure-requests");
  });

  test("adds nonce directives when provided", () => {
    const csp = createContentSecurityPolicy({ nonce: "nonce-value" });
    const scriptDirective = csp
      .split("; ")
      .find((directive) => directive.startsWith("script-src"));

    expect(scriptDirective).toContain("'nonce-nonce-value'");
    expect(scriptDirective).toContain("'strict-dynamic'");
    expect(scriptDirective).not.toContain("'unsafe-inline'");
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

    const csp = createContentSecurityPolicy();

    expect(csp).toContain("upgrade-insecure-requests");
  });

  test("throws in production when TREAZ_TLS_MODE is invalid", () => {
    process.env.TREAZ_TLS_MODE = "bogus";
    process.env.NODE_ENV = "production";

    expect(() => createContentSecurityPolicy()).toThrow(
      /Unsupported TREAZ_TLS_MODE value/, 
    );
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

    const headerConfig = await nextConfig.headers?.();

    expect(headerConfig).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source: "/(.*)",
          headers: expect.arrayContaining([
            expect.objectContaining({ key: "Content-Security-Policy" }),
            expect.objectContaining({ key: "Strict-Transport-Security" }),
            expect.objectContaining({ key: "X-Content-Type-Options" }),
            expect.objectContaining({ key: "X-Frame-Options" }),
            expect.objectContaining({ key: "Referrer-Policy" })
          ])
        })
      ])
    );
  });

  test("omits Strict-Transport-Security when TLS mode is http", async () => {
    process.env.TREAZ_TLS_MODE = "http";

    const headerConfig = await nextConfig.headers?.();
    const headerEntry = headerConfig?.find((entry) => entry.source === "/(.*)");

    expect(headerEntry).toBeDefined();
    expect(headerEntry?.headers).toEqual(
      expect.not.arrayContaining([
        expect.objectContaining({ key: "Strict-Transport-Security" })
      ])
    );
  });
});
