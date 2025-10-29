import { createHmac, timingSafeEqual } from "node:crypto";
import argon2 from "argon2";

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

const decodeBase32 = (input: string): Buffer | null => {
  const cleaned = input.replace(/\s+/g, "").toUpperCase().replace(/=+$/, "");
  if (cleaned.length === 0) {
    return null;
  }

  let buffer = 0;
  let bits = 0;
  const output: number[] = [];

  for (const char of cleaned) {
    const value = BASE32_ALPHABET.indexOf(char);
    if (value === -1) {
      return null;
    }

    buffer = (buffer << 5) | value;
    bits += 5;

    if (bits >= 8) {
      bits -= 8;
      output.push((buffer >> bits) & 0xff);
    }
  }

  return Buffer.from(output);
};

const generateTotpForCounter = (secret: Buffer, counter: number, digits: number): string => {
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeBigUInt64BE(BigInt(counter));

  const digest = createHmac("sha1", secret).update(counterBuffer).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const code =
    ((digest[offset] & 0x7f) << 24) |
    ((digest[offset + 1] & 0xff) << 16) |
    ((digest[offset + 2] & 0xff) << 8) |
    (digest[offset + 3] & 0xff);

  const mod = 10 ** digits;
  return String(code % mod).padStart(digits, "0");
};

export interface MfaService {
  verifyTotp(secret: string, token: string): Promise<boolean>;
  findMatchingRecoveryCode(hashedCodes: string[], providedCode: string): Promise<number | null>;
}

export class BasicMfaService implements MfaService {
  async verifyTotp(secret: string, token: string): Promise<boolean> {
    const normalizedToken = token.replace(/\s+/g, "");
    if (!/^\d{6,10}$/.test(normalizedToken)) {
      return false;
    }

    const decodedSecret = decodeBase32(secret);
    if (!decodedSecret) {
      return false;
    }

    const digits = normalizedToken.length;
    const step = 30;
    const counter = Math.floor(Date.now() / 1000 / step);

    for (let offset = -1; offset <= 1; offset += 1) {
      const currentCounter = counter + offset;
      if (currentCounter < 0) {
        continue;
      }

      const expected = generateTotpForCounter(decodedSecret, currentCounter, digits);
      const expectedBuffer = Buffer.from(expected);
      const providedBuffer = Buffer.from(normalizedToken.padStart(digits, "0"));

      if (
        expectedBuffer.length === providedBuffer.length &&
        timingSafeEqual(expectedBuffer, providedBuffer)
      ) {
        return true;
      }
    }

    return false;
  }

  async findMatchingRecoveryCode(
    hashedCodes: string[],
    providedCode: string
  ): Promise<number | null> {
    for (let index = 0; index < hashedCodes.length; index += 1) {
      const hashed = hashedCodes[index];
      if (!hashed) {
        continue;
      }

      try {
        if (await argon2.verify(hashed, providedCode)) {
          return index;
        }
      } catch (error) {
        // Ignore malformed hashes and continue scanning.
      }
    }

    return null;
  }
}

export const createMfaService = (): MfaService => new BasicMfaService();
