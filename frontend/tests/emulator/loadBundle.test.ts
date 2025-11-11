import { beforeEach, describe, expect, it, vi } from "vitest";

describe("loadEmulatorBundle", () => {
  const defaultSrc = "/vendor/emulatorjs/emulator.js";

  beforeEach(async () => {
    document.head.innerHTML = "";
    document.body.innerHTML = "";
    delete document.body.dataset.cspNonce;
    vi.resetModules();
  });

  it("applies the CSP nonce from the body dataset to appended scripts", async () => {
    document.body.dataset.cspNonce = "nonce-value";
    const appendSpy = vi
      .spyOn(document.body, "appendChild")
      .mockImplementation((node: Node) => node);

    try {
      const { loadEmulatorBundle } = await import("@/lib/emulator/loadBundle");
      const promise = loadEmulatorBundle(defaultSrc);

      const script = appendSpy.mock.calls[0]?.[0] as HTMLScriptElement | undefined;

      expect(script).toBeTruthy();
      expect(script?.nonce).toBe("nonce-value");

      script?.dispatchEvent(new Event("load"));
      await promise;
    } finally {
      appendSpy.mockRestore();
    }
  });

  it("falls back to the <meta name=\"csp-nonce\"> tag when present", async () => {
    const meta = document.createElement("meta");
    meta.name = "csp-nonce";
    meta.content = "meta-nonce";
    document.head.appendChild(meta);

    const appendSpy = vi
      .spyOn(document.body, "appendChild")
      .mockImplementation((node: Node) => node);

    try {
      const { loadEmulatorBundle } = await import("@/lib/emulator/loadBundle");
      const promise = loadEmulatorBundle(defaultSrc);

      const script = appendSpy.mock.calls[0]?.[0] as HTMLScriptElement | undefined;

      expect(script).toBeTruthy();
      expect(script?.nonce).toBe("meta-nonce");

      script?.dispatchEvent(new Event("load"));
      await promise;
    } finally {
      appendSpy.mockRestore();
    }
  });
});
