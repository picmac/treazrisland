import { decryptWithAesGcm, encryptWithAesGcm } from "./crypto.js";

export interface SecretCipher {
  encrypt(value: string): string;
  decrypt(payload: string): string;
}

export const createSecretCipher = (key: string): SecretCipher => {
  if (!key || key.trim().length < 16) {
    throw new Error("Secret encryption key must be at least 16 characters long");
  }

  const normalizedKey = key.trim();

  return {
    encrypt(value: string): string {
      if (value === undefined || value === null) {
        throw new Error("Cannot encrypt undefined or null values");
      }
      return encryptWithAesGcm(value, normalizedKey);
    },
    decrypt(payload: string): string {
      if (payload === undefined || payload === null) {
        throw new Error("Cannot decrypt undefined or null payloads");
      }
      return decryptWithAesGcm(payload, normalizedKey);
    }
  };
};
