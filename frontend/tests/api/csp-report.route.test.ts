import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { GET, POST } from "@/app/api/csp-report/route";

describe("POST /api/csp-report", () => {
  const originalFetch = globalThis.fetch;
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.unstubAllGlobals();
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.useRealTimers();
    globalThis.fetch = originalFetch;
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  test("forwards structured reports to the observability endpoint", async () => {
    process.env.OBSERVABILITY_CSP_ENDPOINT = "https://observability.example.com/csp";
    process.env.OBSERVABILITY_CSP_TOKEN = "token-123";

    const mockFetch = vi.fn().mockResolvedValue(new Response(null, { status: 202 }));
    vi.stubGlobal("fetch", mockFetch);

    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-02T03:04:05.000Z"));

    const payload = {
      "csp-report": {
        "document-uri": "https://app.treazris.land/library",
        "blocked-uri": "https://evil.example/script.js",
        "violated-directive": "script-src 'self'",
        "original-policy": "default-src 'self'; script-src 'self'",
        "effective-directive": "script-src",
        "line-number": 42,
        "column-number": "13",
        "source-file": "https://app.treazris.land/_next/static/chunk.js"
      }
    } satisfies Record<string, unknown>;

    const request = new Request("http://localhost/api/csp-report", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "user-agent": "Vitest",
        "x-forwarded-for": "203.0.113.5"
      },
      body: JSON.stringify(payload)
    });

    const response = await POST(request);

    expect(response.status).toBe(204);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch).toHaveBeenCalledWith(
      "https://observability.example.com/csp",
      expect.objectContaining({
        method: "POST",
        cache: "no-store"
      })
    );

    const forwarded = JSON.parse((mockFetch.mock.calls[0]?.[1]?.body ?? "{}") as string);
    expect(forwarded).toMatchObject({
      kind: "security.csp-report",
      receivedAt: "2025-01-02T03:04:05.000Z",
      userAgent: "Vitest",
      clientIp: "203.0.113.5",
      report: {
        documentUri: "https://app.treazris.land/library",
        blockedUri: "https://evil.example/script.js",
        violatedDirective: "script-src 'self'",
        originalPolicy: "default-src 'self'; script-src 'self'",
        effectiveDirective: "script-src",
        lineNumber: 42,
        columnNumber: 13,
        sourceFile: "https://app.treazris.land/_next/static/chunk.js"
      }
    });

    const requestInit = mockFetch.mock.calls[0]?.[1] as RequestInit | undefined;
    const headers = requestInit?.headers as Headers | undefined;
    expect(headers?.get("content-type")).toBe("application/json");
    expect(headers?.get("authorization")).toBe("Bearer token-123");
  });

  test("rejects invalid payloads", async () => {
    const mockFetch = vi.fn();
    vi.stubGlobal("fetch", mockFetch);

    const request = new Request("http://localhost/api/csp-report", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({})
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: expect.stringContaining("csp-report")
    });
    expect(mockFetch).not.toHaveBeenCalled();
  });
});

describe("method guards", () => {
  test("GET returns 405", async () => {
    const response = await GET();
    expect(response.status).toBe(405);
    expect(response.headers.get("allow")).toBe("POST");
  });
});
