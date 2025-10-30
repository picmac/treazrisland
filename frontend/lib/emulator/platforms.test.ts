import { describe, expect, it } from "vitest";

import { getPlatformConfig, listSupportedPlatforms } from "./platforms";

describe("emulator platform mapping", () => {
  it("returns canonical configurations for supported slugs", () => {
    const snes = getPlatformConfig("snes");
    expect(snes).not.toBeNull();
    expect(snes?.systemId).toBe("snes");
    expect(snes?.defaultCore).toBe("snes9x");
    expect(snes?.preferredCores).toContain("bsnes");
  });

  it("normalizes aliases to their canonical configuration", () => {
    const neoGeo = getPlatformConfig("neoGeo");
    const arcade = getPlatformConfig("arcade");
    expect(neoGeo).toBe(arcade);
    expect(neoGeo?.defaultCore).toBe("fbneo");
  });

  it("returns null for unsupported platforms", () => {
    expect(getPlatformConfig("dreamcast")).toBeNull();
    expect(getPlatformConfig("ps2")).toBeNull();
  });

  it("exposes a sorted list of supported platform slugs", () => {
    const supported = listSupportedPlatforms();
    expect(supported).toContain("snes");
    expect(supported).toContain("psx");
    expect(supported).toContain("arcade");
    expect(supported).not.toContain("dreamcast");
    expect([...supported]).toEqual([...supported].sort());
  });
});
