import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import argon2 from "argon2";
import { env } from "../../config/env.js";
import { createSecretCipher, type SecretCipher } from "../../utils/secret-encryption.js";

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

const encodeBase32 = (input: Buffer): string => {
  let buffer = 0;
  let bits = 0;
  let output = "";

  for (const byte of input) {
    buffer = (buffer << 8) | byte;
    bits += 8;

    while (bits >= 5) {
      bits -= 5;
      const index = (buffer >> bits) & 0x1f;
      output += BASE32_ALPHABET[index];
    }
  }

  if (bits > 0) {
    const index = (buffer << (5 - bits)) & 0x1f;
    output += BASE32_ALPHABET[index];
  }

  return output;
};

export interface BuildOtpAuthUriOptions {
  issuer: string;
  label: string;
  secret: string;
  digits?: number;
  period?: number;
}

export interface DecryptedMfaSecret {
  secret: string;
  needsRotation: boolean;
}

export interface MfaService {
  verifyTotp(secret: string, token: string): Promise<boolean>;
  findMatchingRecoveryCode(hashedCodes: string[], providedCode: string): Promise<number | null>;
  generateSecret(byteLength?: number): string;
  buildOtpAuthUri(options: BuildOtpAuthUriOptions): string;
  encryptSecret(secret: string): string;
  decryptSecret(payload: string): DecryptedMfaSecret;
}

export class BasicMfaService implements MfaService {
  private readonly cipher: SecretCipher;

  constructor(private readonly encryptionKey: string = env.MFA_ENCRYPTION_KEY) {
    this.cipher = createSecretCipher(this.encryptionKey);
  }

  generateSecret(byteLength = 20): string {
    if (!Number.isInteger(byteLength) || byteLength <= 0) {
      throw new Error("byteLength must be a positive integer");
    }

    return encodeBase32(randomBytes(byteLength));
  }

  buildOtpAuthUri({
    issuer,
    label,
    secret,
    digits = 6,
    period = 30
  }: BuildOtpAuthUriOptions): string {
    if (!issuer || !label || !secret) {
      throw new Error("issuer, label, and secret are required to build an otpauth URI");
    }

    const safeIssuer = encodeURIComponent(issuer);
    const safeLabel = encodeURIComponent(label);
    const safeSecret = secret.replace(/\s+/g, "");

    return `otpauth://totp/${safeIssuer}:${safeLabel}?secret=${safeSecret}&issuer=${safeIssuer}&digits=${digits}&period=${period}`;
  }

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

  encryptSecret(secret: string): string {
    return this.cipher.encrypt(secret);
  }

  decryptSecret(payload: string): DecryptedMfaSecret {
    try {
      const decrypted = this.cipher.decrypt(payload);
      return { secret: decrypted, needsRotation: false };
    } catch (error) {
      const normalized = payload.replace(/\s+/g, "").toUpperCase();
      if (/^[A-Z2-7]+=*$/.test(normalized)) {
        return { secret: normalized, needsRotation: true };
      }

      throw error;
    }
  }
}

export const createMfaService = (encryptionKey = env.MFA_ENCRYPTION_KEY): MfaService =>
  new BasicMfaService(encryptionKey);
