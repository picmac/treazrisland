import type { FastifyInstance, FastifyRequest } from "fastify";
import type { DecryptedMfaSecret } from "../mfa/service.js";

export const extractHashedRecoveryCodes = (raw: string): string[] =>
  raw
    .split("\n")
    .map((value) => value.trim())
    .filter((value) => value.length > 0);

export interface RotateMfaSecretParams {
  secretId: string;
  userId: string;
  decryptedSecret: DecryptedMfaSecret;
}

export const rotateMfaSecretIfNeeded = async (
  app: FastifyInstance,
  request: FastifyRequest,
  params: RotateMfaSecretParams
): Promise<void> => {
  if (!params.decryptedSecret.needsRotation) {
    return;
  }

  try {
    await app.prisma.mfaSecret.update({
      where: { id: params.secretId },
      data: {
        secret: app.mfaService.encryptSecret(params.decryptedSecret.secret),
        rotatedAt: new Date()
      }
    });
  } catch (error) {
    request.log.error(
      { err: error, userId: params.userId },
      "Failed to rotate MFA secret after challenge"
    );
  }
};
