import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

const AES_KEY_LENGTH = 32;
const AES_IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

const deriveAesKey = (secret: string): Buffer => {
  if (secret.length < 16) {
    throw new Error("Encryption secret must be at least 16 characters long");
  }

  return createHash("sha256").update(secret).digest().subarray(0, AES_KEY_LENGTH);
};

export const encryptWithAesGcm = (plaintext: string, secret: string): string => {
  const key = deriveAesKey(secret);
  const iv = randomBytes(AES_IV_LENGTH);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return Buffer.concat([iv, encrypted, authTag]).toString("base64");
};

export const decryptWithAesGcm = (payload: string, secret: string): string => {
  const key = deriveAesKey(secret);
  const buffer = Buffer.from(payload, "base64");

  if (buffer.length <= AES_IV_LENGTH + AUTH_TAG_LENGTH) {
    throw new Error("Encrypted payload is too short to contain IV and auth tag");
  }

  const iv = buffer.subarray(0, AES_IV_LENGTH);
  const authTag = buffer.subarray(buffer.length - AUTH_TAG_LENGTH);
  const ciphertext = buffer.subarray(AES_IV_LENGTH, buffer.length - AUTH_TAG_LENGTH);

  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return decrypted.toString("utf8");
};
