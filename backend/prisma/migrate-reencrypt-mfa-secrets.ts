import { PrismaClient } from "@prisma/client";
import { env } from "../src/config/env.js";
import { createMfaService } from "../src/services/mfa/service.js";

const prisma = new PrismaClient();

async function main() {
  const mfaService = createMfaService(env.MFA_ENCRYPTION_KEY);
  const secrets = await prisma.mfaSecret.findMany({
    select: { id: true, secret: true }
  });

  let rotated = 0;

  for (const record of secrets) {
    let decrypted;
    try {
      decrypted = mfaService.decryptSecret(record.secret);
    } catch (error) {
      console.error(`Unable to decrypt MFA secret ${record.id}`, error);
      throw error;
    }

    if (!decrypted.needsRotation) {
      continue;
    }

    const ciphertext = mfaService.encryptSecret(decrypted.secret);
    await prisma.mfaSecret.update({
      where: { id: record.id },
      data: { secret: ciphertext, rotatedAt: new Date() }
    });
    rotated += 1;
  }

  console.log(`Re-encrypted ${rotated} MFA secrets`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
