import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { NextRequest } from "next/server";

import { proxy } from "../../proxy";

const ORIGINAL_CRYPTO = globalThis.crypto;
const ORIGINAL_ENV = { ...process.env };

function mockRandomValues(bytes: Uint8Array) {
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = index;
  }
  return bytes;
}

describe("proxy", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    process.env = { ...ORIGINAL_ENV, TREAZ_TLS_MODE: "https", NODE_ENV: "production" };
    if (ORIGINAL_CRYPTO) {
      vi.spyOn(ORIGINAL_CRYPTO, "getRandomValues").mockImplementation(mockRandomValues);
    }
  });

  afterEach(() => {
    vi.restoreAllMocks();
    process.env = { ...ORIGINAL_ENV };
  });

  test("injects a nonce-backed CSP for admin routes", () => {
    const request = new NextRequest(new URL("https://treazris.land/admin/uploads"));

    const response = proxy(request);

    const nonce = response.headers.get("x-csp-nonce");
    const csp = response.headers.get("content-security-policy");

    expect(nonce).toMatch(/^[A-Za-z0-9+/=]+$/);
    expect(csp).toContain("'nonce-");
    expect(csp).toContain("'strict-dynamic'");
  });

  test("applies baseline headers for other routes", () => {
    const request = new NextRequest(new URL("https://treazris.land/library"));

    const response = proxy(request);

    const csp = response.headers.get("content-security-policy");
    expect(csp).toContain("default-src 'self'");
    expect(csp).not.toContain("'nonce-");
    expect(response.headers.get("x-csp-nonce")).toBeNull();
    expect(response.headers.get("strict-transport-security")).toMatch(/max-age=/);
  });
});
