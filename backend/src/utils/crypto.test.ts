import { describe, expect, it } from "vitest";
import { decryptWithAesGcm, encryptWithAesGcm } from "./crypto.js";

describe("crypto", () => {
  it("encrypts and decrypts values symmetrically", () => {
    const secret = "super-secret-key-that-should-be-long";
    const plaintext = "muldjord";

    const encrypted = encryptWithAesGcm(plaintext, secret);
    expect(encrypted).not.toEqual(plaintext);

    const decrypted = decryptWithAesGcm(encrypted, secret);
    expect(decrypted).toEqual(plaintext);
  });

  it("throws when decrypting with the wrong secret", () => {
    const secret = "another-secret-that-is-longer";
    const plaintext = "uWu5VRc9QDVMPpD8";

    const encrypted = encryptWithAesGcm(plaintext, secret);

    expect(() => decryptWithAesGcm(encrypted, "incorrect-secret-value")).toThrow();
  });
});
