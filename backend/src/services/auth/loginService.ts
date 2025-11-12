import type { FastifyInstance, FastifyRequest } from "fastify";
import argon2 from "argon2";
import type { Role } from "@prisma/client";

import { LoginAuditEvent } from "../../utils/prisma-enums.js";
import {
  issueSessionTokens,
  type SessionTokensResult,
} from "../../utils/tokens.js";
import { recordLoginAudit } from "../../utils/authResponse.js";
import {
  extractHashedRecoveryCodes,
  rotateMfaSecretIfNeeded,
} from "./mfaHelpers.js";
import type { DecryptedMfaSecret } from "../mfa/service.js";

export interface LoginAttempt {
  identifier: string;
  password: string;
  mfaCode?: string | null;
  recoveryCode?: string | null;
}

export type LoginUser = {
  id: string;
  email: string | null;
  nickname: string;
  role: Role;
};

type UserWithSecrets = LoginUser & {
  passwordHash: string;
  mfaSecrets: Array<{
    id: string;
    secret: string;
    recoveryCodes: string;
    disabledAt: Date | null;
    confirmedAt: Date | null;
  }>;
};

export type LoginServiceResult =
  | { status: "success"; user: LoginUser; tokens: SessionTokensResult }
  | { status: "mfa-required" };

export type LoginServiceErrorCode =
  | "INVALID_CREDENTIALS"
  | "MFA_CHALLENGE_FAILED"
  | "MFA_VERIFICATION_ERROR";

export class LoginServiceError extends Error {
  constructor(
    public readonly code: LoginServiceErrorCode,
    public readonly statusCode: number,
    public readonly response: { message: string },
    options?: { cause?: unknown }
  ) {
    super(response.message, options);
    this.name = "LoginServiceError";
  }
}

export class LoginService {
  constructor(private readonly app: FastifyInstance) {}

  async execute(
    request: FastifyRequest,
    attempt: LoginAttempt
  ): Promise<LoginServiceResult> {
    const normalizedEmail = attempt.identifier.toLowerCase();

    const user = (await this.app.prisma.user.findFirst({
      where: {
        OR: [{ email: normalizedEmail }, { nickname: attempt.identifier }],
      },
      include: {
        mfaSecrets: {
          where: { disabledAt: null, confirmedAt: { not: null } },
          orderBy: { createdAt: "desc" },
        },
      },
    })) as UserWithSecrets | null;

    if (!user) {
      await recordLoginAudit(this.app, request, {
        emailAttempted: attempt.identifier,
        event: LoginAuditEvent.FAILURE,
        reason: "user_not_found",
      });
      throw new LoginServiceError("INVALID_CREDENTIALS", 401, {
        message: "Invalid credentials",
      });
    }

    const passwordValid = await argon2.verify(user.passwordHash, attempt.password);
    if (!passwordValid) {
      await recordLoginAudit(this.app, request, {
        userId: user.id,
        emailAttempted: attempt.identifier,
        event: LoginAuditEvent.FAILURE,
        reason: "invalid_password",
      });
      throw new LoginServiceError("INVALID_CREDENTIALS", 401, {
        message: "Invalid credentials",
      });
    }

    const activeSecret = user.mfaSecrets.find(
      (secret) => !secret.disabledAt && secret.confirmedAt,
    );

    if (activeSecret) {
      const mfaOutcome = await this.handleMfaChallenge(
        request,
        user,
        activeSecret,
        attempt,
      );

      if (mfaOutcome === "challenge") {
        return { status: "mfa-required" };
      }
    }

    const tokens = await issueSessionTokens(this.app, user.id, user.role);

    await recordLoginAudit(this.app, request, {
      userId: user.id,
      event: LoginAuditEvent.SUCCESS,
    });

    const { passwordHash: _passwordHash, mfaSecrets: _mfaSecrets, ...publicUser } =
      user;

    return {
      status: "success",
      user: publicUser,
      tokens,
    };
  }

  private async handleMfaChallenge(
    request: FastifyRequest,
    user: UserWithSecrets,
    activeSecret: UserWithSecrets["mfaSecrets"][number],
    attempt: LoginAttempt,
  ): Promise<"challenge" | "ok"> {
    if (!attempt.mfaCode && !attempt.recoveryCode) {
      await recordLoginAudit(this.app, request, {
        userId: user.id,
        event: LoginAuditEvent.MFA_REQUIRED,
        reason: "challenge",
      });
      return "challenge";
    }

    let mfaSatisfied = false;
    let decryptedSecret: DecryptedMfaSecret | null = null;

    if (attempt.mfaCode) {
      try {
        decryptedSecret = this.app.mfaService.decryptSecret(activeSecret.secret);
      } catch (error) {
        request.log.error(
          { err: error, userId: user.id },
          "Failed to decrypt MFA secret",
        );
        throw new LoginServiceError("MFA_VERIFICATION_ERROR", 500, {
          message: "Unable to verify MFA challenge",
        });
      }

      try {
        mfaSatisfied = await this.app.mfaService.verifyTotp(
          decryptedSecret.secret,
          attempt.mfaCode,
        );
      } catch (error) {
        request.log.error(
          { err: error, userId: user.id },
          "Failed to verify MFA code",
        );
        throw new LoginServiceError("MFA_VERIFICATION_ERROR", 500, {
          message: "Unable to verify MFA challenge",
        });
      }
    }

    if (!mfaSatisfied && attempt.recoveryCode) {
      try {
        const hashedCodes = extractHashedRecoveryCodes(activeSecret.recoveryCodes);
        const matchIndex = await this.app.mfaService.findMatchingRecoveryCode(
          hashedCodes,
          attempt.recoveryCode,
        );

        if (matchIndex !== null) {
          mfaSatisfied = true;
          hashedCodes.splice(matchIndex, 1);
          await this.app.prisma.mfaSecret.update({
            where: { id: activeSecret.id },
            data: {
              recoveryCodes: hashedCodes.join("\n"),
              rotatedAt: new Date(),
            },
          });
        }
      } catch (error) {
        request.log.error(
          { err: error, userId: user.id },
          "Failed to verify recovery code",
        );
        throw new LoginServiceError("MFA_VERIFICATION_ERROR", 500, {
          message: "Unable to verify MFA challenge",
        });
      }
    }

    if (!mfaSatisfied) {
      await recordLoginAudit(this.app, request, {
        userId: user.id,
        event: LoginAuditEvent.FAILURE,
        reason: "mfa_failed",
      });
      throw new LoginServiceError("MFA_CHALLENGE_FAILED", 401, {
        message: "Invalid multi-factor credentials",
      });
    }

    if (decryptedSecret?.needsRotation) {
      await rotateMfaSecretIfNeeded(this.app, request, {
        decryptedSecret,
        secretId: activeSecret.id,
        userId: user.id,
      });
    }

    return "ok";
  }
}
