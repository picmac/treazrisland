import { describe, expect, it } from "vitest";
import { BasicMfaService } from "./service.js";

const TEST_KEY = "test-encryption-key-that-is-long-enough";

describe("BasicMfaService", () => {
  const service = new BasicMfaService(TEST_KEY);

  it("generates a base32 secret of the requested size", () => {
    const secret = service.generateSecret(16);
    expect(secret).toMatch(/^[A-Z2-7]+$/);
    expect(secret.length).toBeGreaterThanOrEqual(26);
  });

  it("builds an otpauth URI with encoded issuer and label", () => {
    const uri = service.buildOtpAuthUri({
      issuer: "TREAZRISLAND",
      label: "player@example.com",
      secret: "JBSWY3DPEHPK3PXP"
    });

    expect(uri).toBe(
      "otpauth://totp/TREAZRISLAND:player%40example.com?secret=JBSWY3DPEHPK3PXP&issuer=TREAZRISLAND&digits=6&period=30"
    );
  });

  it("strips whitespace from secrets when building otpauth URIs", () => {
    const uri = service.buildOtpAuthUri({
      issuer: "TREAZRISLAND",
      label: "Captain Pirate",
      secret: "JBSW Y3DP EHPK 3PXP"
    });

    expect(uri).toContain("secret=JBSWY3DPEHPK3PXP");
  });

  it("encrypts and decrypts MFA secrets symmetrically", () => {
    const plaintext = "JBSWY3DPEHPK3PXP";

    const ciphertext = service.encryptSecret(plaintext);
    expect(ciphertext).not.toEqual(plaintext);

    const result = service.decryptSecret(ciphertext);
    expect(result.secret).toEqual(plaintext);
    expect(result.needsRotation).toBe(false);
  });

  it("flags legacy base32 secrets for rotation", () => {
    const legacy = "JBSWY3DPEHPK3PXP";

    const result = service.decryptSecret(legacy);
    expect(result.secret).toEqual(legacy);
    expect(result.needsRotation).toBe(true);
  });
});
