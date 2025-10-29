import { describe, expect, it } from "vitest";
import {
  NETPLAY_CODE_ALPHABET,
  NETPLAY_CODE_LENGTH,
  generateNetplayJoinCode,
  isValidNetplayJoinCode,
  normalizeNetplayJoinCode
} from "./netplayCodes.js";

const alphabetSet = new Set(NETPLAY_CODE_ALPHABET.split(""));

describe("netplay join codes", () => {
  it("generates codes with the expected format", () => {
    const code = generateNetplayJoinCode();

    expect(code).toHaveLength(NETPLAY_CODE_LENGTH);
    expect(isValidNetplayJoinCode(code)).toBe(true);
    for (const char of code) {
      expect(alphabetSet.has(char)).toBe(true);
    }
  });

  it("normalizes codes to uppercase without surrounding whitespace", () => {
    expect(normalizeNetplayJoinCode("  abc123 ")).toBe("ABC123");
    expect(normalizeNetplayJoinCode("qwerty")).toBe("QWERTY");
  });

  it("validates codes correctly", () => {
    expect(isValidNetplayJoinCode("ABCDEF")).toBe(true);
    expect(isValidNetplayJoinCode("abcdef")).toBe(false);
    expect(isValidNetplayJoinCode("ABC-12")).toBe(false);
    expect(isValidNetplayJoinCode("ABC1234")).toBe(false);
  });

  it("produces high-entropy codes with negligible collisions in practice", () => {
    const iterations = 2000;
    const codes = new Set<string>();

    for (let i = 0; i < iterations; i += 1) {
      codes.add(generateNetplayJoinCode());
    }

    expect(codes.size).toBe(iterations);
  });
});
