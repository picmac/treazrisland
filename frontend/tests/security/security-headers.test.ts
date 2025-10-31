import { afterEach, beforeEach, describe, expect, test } from "vitest";

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
    const csp = createContentSecurityPolicy();
    const scriptDirective = csp
      .split("; ")
      .find((directive) => directive.startsWith("script-src"));

    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("report-uri /api/csp-report");
    expect(scriptDirective).toBe("script-src 'self' https: blob: 'unsafe-inline'");
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

    const csp = createContentSecurityPolicy();

    expect(csp).toContain("https://cdn.treazris.land");
  });
});

describe("buildSecurityHeaders", () => {
  test("returns the required security headers", () => {
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
});

describe("next.config headers integration", () => {
  test("applies the security headers to all routes", async () => {
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
});
