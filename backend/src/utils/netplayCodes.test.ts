import { describe, expect, it } from "vitest";
import {
  NETPLAY_JOIN_CODE_REGEX,
  generateNetplayJoinCode,
  isValidNetplayJoinCode,
  normaliseNetplayJoinCode
} from "./netplayCodes.js";

describe("netplayCodes", () => {
  it("generates codes that match the expected format", () => {
    const code = generateNetplayJoinCode();

    expect(code).toMatch(NETPLAY_JOIN_CODE_REGEX);
  });

  it("normalises join codes to uppercase without surrounding whitespace", () => {
    const code = normaliseNetplayJoinCode("  ab3-cd4  ");

    expect(code).toBe("AB3-CD4");
  });

  it("validates that generated codes are unique across a large sample", () => {
    const sampleSize = 500;
    const codes = new Set<string>();

    for (let index = 0; index < sampleSize; index += 1) {
      codes.add(generateNetplayJoinCode());
    }

    expect(codes.size).toBe(sampleSize);
  });

  it("rejects codes that use unsupported characters", () => {
    expect(isValidNetplayJoinCode("OO0-111")).toBe(false);
    expect(isValidNetplayJoinCode("abc-def")).toBe(false);
  });
});
