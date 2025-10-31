import { describe, expect, it } from "vitest";
import { BasicMfaService } from "./service.js";

describe("BasicMfaService", () => {
  const service = new BasicMfaService();

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
});
