import { PrismaClient } from "@prisma/client";
import { config as loadEnv } from "dotenv";
import { createSecretCipher } from "../src/utils/secret-encryption.js";

loadEnv();

const prisma = new PrismaClient();

const LEGACY_BASE32_PATTERN = /^[A-Z2-7]+=*$/;

async function main() {
  const rawKey = process.env.MFA_ENCRYPTION_KEY?.trim();

  if (!rawKey) {
    console.warn(
      "[prisma:mfa-rotation] Skipping re-encryption: MFA_ENCRYPTION_KEY is not configured.",
    );
    return;
  }

  if (rawKey.length < 32) {
    console.warn(
      "[prisma:mfa-rotation] Skipping re-encryption: MFA_ENCRYPTION_KEY must be at least 32 characters.",
    );
    return;
  }

  const cipher = createSecretCipher(rawKey);

  const secrets = await prisma.mfaSecret.findMany({
    select: { id: true, secret: true }
  });

  let rotated = 0;

  for (const record of secrets) {
    let decryptedSecret: string;
    let requiresRotation = false;

    try {
      decryptedSecret = cipher.decrypt(record.secret);
    } catch (error) {
      const normalized = record.secret.replace(/\s+/g, "").toUpperCase();
      if (normalized.length > 0 && LEGACY_BASE32_PATTERN.test(normalized)) {
        decryptedSecret = normalized;
        requiresRotation = true;
      } else {
        console.error(`Unable to decrypt MFA secret ${record.id}`, error);
        throw error;
      }
    }

    if (!requiresRotation) {
      continue;
    }

    const ciphertext = cipher.encrypt(decryptedSecret);
    await prisma.mfaSecret.update({
      where: { id: record.id },
      data: { secret: ciphertext, rotatedAt: new Date() }
    });
    rotated += 1;
  }

  console.log(`[prisma:mfa-rotation] Re-encrypted ${rotated} MFA secrets`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
