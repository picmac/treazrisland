import type { FastifyInstance, FastifyRequest } from "fastify";
import { createHash, randomBytes } from "node:crypto";
import argon2 from "argon2";
import type { Prisma as PrismaNamespace } from "@prisma/client";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/library";
import { LoginAuditEvent } from "../utils/prisma-enums.js";
import {
  issueSessionTokens,
  rotateRefreshToken,
  revokeRefreshFamily,
  revokeUserRefreshFamilies,
  RefreshTokenError,
  hashToken
} from "../utils/tokens.js";
import { env } from "../config/env.js";
import {
  invitationTokenSchema,
  loginSchema,
  signupSchema,
  passwordResetRequestSchema,
  passwordResetConfirmSchema,
  mfaConfirmSchema,
  mfaDisableSchema,
} from "../schemas/auth.js";
import {
  clearRefreshCookie,
  readRefreshTokenFromRequest
} from "../utils/cookies.js";
import {
  applySessionTokens,
  recordLoginAudit,
  verifyRefreshCsrf
} from "../utils/authResponse.js";
import { LoginService, LoginServiceError } from "../services/auth/loginService.js";
import { extractHashedRecoveryCodes } from "../services/auth/mfaHelpers.js";

const RECOVERY_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

const generateRecoveryCodes = (count: number, length: number): string[] => {
  if (count <= 0 || length <= 0) {
    return [];
  }

  const codes: string[] = [];
  while (codes.length < count) {
    const bytes = randomBytes(length);
    let code = "";
    for (let index = 0; index < length; index += 1) {
      const byte = bytes[index];
      const alphabetIndex = byte % RECOVERY_CODE_ALPHABET.length;
      code += RECOVERY_CODE_ALPHABET[alphabetIndex];
    }
    codes.push(code);
  }

  return codes;
};

export async function registerAuthRoutes(app: FastifyInstance) {
  const loginService = new LoginService(app);
  app.post(
    "/auth/invitations/preview",
    {
      config: {
        rateLimit: {
          max: env.RATE_LIMIT_AUTH_POINTS,
          timeWindow: env.RATE_LIMIT_AUTH_DURATION * 1000
        }
      }
    },
    async (request, reply) => {
      const parsed = invitationTokenSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          message: "Invalid payload",
          errors: parsed.error.flatten().fieldErrors
        });
      }

      const { token } = parsed.data;
      const tokenFingerprint = createHash("sha256").update(token).digest("hex");
      const invitation = await app.prisma.userInvitation.findUnique({
        where: { tokenFingerprint }
      });

      if (!invitation || invitation.redeemedAt || invitation.expiresAt <= new Date()) {
        return reply.status(404).send({ message: "Invitation not found or expired" });
      }

      let matches = false;
      try {
        matches = await argon2.verify(invitation.tokenHash, token);
      } catch (error) {
        request.log.error({ err: error, invitationId: invitation.id }, "Failed to verify invitation token");
        return reply.status(500).send({ message: "Unable to validate invitation" });
      }

      if (!matches) {
        return reply.status(404).send({ message: "Invitation not found or expired" });
      }

      return reply.send({
        invitation: {
          role: invitation.role,
          email: invitation.email
        }
      });
    }
  );

  app.post(
    "/auth/signup",
    {
      config: {
        rateLimit: {
          max: env.RATE_LIMIT_AUTH_POINTS,
          timeWindow: env.RATE_LIMIT_AUTH_DURATION * 1000
        }
      }
    },
    async (request, reply) => {
      const parsed = signupSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          message: "Invalid payload",
          errors: parsed.error.flatten().fieldErrors
        });
      }

      const { token, email, nickname, password, displayName } = parsed.data;
      const tokenFingerprint = createHash("sha256").update(token).digest("hex");

      try {
        const result = await app.prisma.$transaction(async (tx) => {
          const invitation = await tx.userInvitation.findUnique({
            where: { tokenFingerprint }
          });

          if (!invitation || invitation.redeemedAt || invitation.expiresAt <= new Date()) {
            throw new Error("INVALID_INVITATION");
          }

          let matches = false;
          try {
            matches = await argon2.verify(invitation.tokenHash, token);
          } catch (error) {
            request.log.error({ err: error, invitationId: invitation.id }, "Failed to verify invitation during signup");
            throw new Error("INVITATION_VERIFICATION_FAILED");
          }

          if (!matches) {
            throw new Error("INVALID_INVITATION");
          }

          const invitationEmail = invitation.email?.toLowerCase() ?? null;
          const providedEmail = email?.toLowerCase() ?? null;

          let resolvedEmail: string | null = null;

          if (invitationEmail) {
            if (providedEmail && providedEmail !== invitationEmail) {
              throw new Error("EMAIL_MISMATCH");
            }
            resolvedEmail = invitationEmail;
          } else {
            if (!providedEmail) {
              throw new Error("EMAIL_REQUIRED");
            }
            resolvedEmail = providedEmail;
          }

          const passwordHash = await argon2.hash(password, { type: argon2.argon2id });

          const user = await tx.user.create({
            data: {
              email: resolvedEmail,
              nickname,
              displayName: displayName ?? nickname,
              passwordHash,
              role: invitation.role
            }
          });

          await tx.userInvitation.update({
            where: { id: invitation.id },
            data: {
              redeemedAt: new Date()
            }
          });

          const tokens = await issueSessionTokens(app, user.id, user.role, { tx });

          return { user, tokens };
        });

      applySessionTokens(reply, result.tokens);

      void recordLoginAudit(app, request, {
        userId: result.user.id,
        event: LoginAuditEvent.SUCCESS,
        reason: "signup"
      });

      return reply.status(201).send({
        user: {
          id: result.user.id,
          email: result.user.email,
          nickname: result.user.nickname,
          role: result.user.role
        },
        accessToken: result.tokens.accessToken,
        refreshExpiresAt: result.tokens.refreshExpiresAt.toISOString()
      });
    } catch (error) {
      if (error instanceof Error) {
        switch (error.message) {
          case "INVALID_INVITATION":
            return reply.status(400).send({ message: "Invitation is invalid or expired" });
          case "EMAIL_REQUIRED":
            return reply.status(400).send({ message: "Email is required to redeem this invitation" });
          case "EMAIL_MISMATCH":
            return reply.status(400).send({ message: "Email does not match invitation" });
          case "INVITATION_VERIFICATION_FAILED":
            return reply.status(500).send({ message: "Unexpected error during signup" });
          default:
            break;
        }
      }

      if (error instanceof PrismaClientKnownRequestError && error.code === "P2002") {
        return reply.status(409).send({ message: "Email or nickname already in use" });
      }

      request.log.error({ err: error }, "Failed to complete signup");
      return reply.status(500).send({ message: "Unexpected error during signup" });
    }
  }
  );

  app.post(
    "/auth/mfa/setup",
    {
      preHandler: app.authenticate
    },
    async (request, reply) => {
      if (!request.user) {
        throw app.httpErrors.unauthorized();
      }

      const user = await app.prisma.user.findUnique({
        where: { id: request.user.sub },
        select: { id: true, email: true, nickname: true }
      });

      if (!user) {
        throw app.httpErrors.notFound("User not found");
      }

      const secret = app.mfaService.generateSecret();
      const encryptedSecret = app.mfaService.encryptSecret(secret);
      const recoveryCodes = generateRecoveryCodes(
        env.MFA_RECOVERY_CODE_COUNT,
        env.MFA_RECOVERY_CODE_LENGTH
      );

      let hashedRecoveryCodes: string[];
      try {
        hashedRecoveryCodes = await Promise.all(
          recoveryCodes.map((code) => argon2.hash(code, { type: argon2.argon2id }))
        );
      } catch (error) {
        request.log.error({ err: error, userId: user.id }, "Failed to hash recovery codes");
        return reply.status(500).send({ message: "Unable to prepare recovery codes" });
      }

      let record: { id: string };
      try {
        record = await app.prisma.$transaction(async (tx) => {
          await tx.mfaSecret.deleteMany({
            where: { userId: user.id, confirmedAt: null }
          });

          return tx.mfaSecret.create({
            data: {
              userId: user.id,
              secret: encryptedSecret,
              recoveryCodes: hashedRecoveryCodes.join("\n")
            }
          });
        });
      } catch (error) {
        request.log.error({ err: error, userId: user.id }, "Failed to create MFA secret");
        return reply.status(500).send({ message: "Unable to prepare MFA secret" });
      }

      const label = user.email ?? user.nickname;
      const otpauthUri = app.mfaService.buildOtpAuthUri({
        issuer: env.MFA_ISSUER,
        label,
        secret
      });

      return reply.send({
        secretId: record.id,
        secret,
        otpauthUri,
        recoveryCodes
      });
    }
  );

  app.post(
    "/auth/mfa/confirm",
    {
      preHandler: app.authenticate
    },
    async (request, reply) => {
      if (!request.user) {
        throw app.httpErrors.unauthorized();
      }

      const parsed = mfaConfirmSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          message: "Invalid payload",
          errors: parsed.error.flatten().fieldErrors
        });
      }

      const pendingSecret = await app.prisma.mfaSecret.findFirst({
        where: {
          id: parsed.data.secretId,
          userId: request.user.sub,
          confirmedAt: null
        }
      });

      if (!pendingSecret) {
        return reply.status(404).send({ message: "MFA setup request not found" });
      }

      let decryptedSecret: ReturnType<typeof app.mfaService.decryptSecret>;
      try {
        decryptedSecret = app.mfaService.decryptSecret(pendingSecret.secret);
      } catch (error) {
        request.log.error(
          { err: error, userId: request.user.sub },
          "Failed to decrypt stored MFA secret",
        );
        return reply.status(500).send({ message: "Unable to verify MFA code" });
      }

      let verified = false;
      try {
        verified = await app.mfaService.verifyTotp(
          decryptedSecret.secret,
          parsed.data.code,
        );
      } catch (error) {
        request.log.error({ err: error, userId: request.user.sub }, "Failed to verify MFA code");
        return reply.status(500).send({ message: "Unable to verify MFA code" });
      }

      if (!verified) {
        return reply.status(400).send({ message: "Invalid MFA code" });
      }

      try {
        await app.prisma.$transaction(async (tx) => {
          await tx.mfaSecret.updateMany({
            where: {
              userId: request.user!.sub,
              disabledAt: null,
              confirmedAt: { not: null }
            },
            data: { disabledAt: new Date() }
          });

          await tx.mfaSecret.update({
            where: { id: pendingSecret.id },
            data: {
              confirmedAt: new Date(),
              disabledAt: null,
              ...(decryptedSecret.needsRotation
                ? { secret: app.mfaService.encryptSecret(decryptedSecret.secret) }
                : {})
            }
          });
        });
      } catch (error) {
        request.log.error({ err: error, userId: request.user.sub }, "Failed to confirm MFA setup");
        return reply.status(500).send({ message: "Unable to activate MFA" });
      }

      return reply.send({ message: "Multi-factor authentication enabled" });
    }
  );

  app.post(
    "/auth/mfa/disable",
    {
      preHandler: app.authenticate
    },
    async (request, reply) => {
      if (!request.user) {
        throw app.httpErrors.unauthorized();
      }

      const parsed = mfaDisableSchema.safeParse(request.body ?? {});
      if (!parsed.success) {
        return reply.status(400).send({
          message: "Invalid payload",
          errors: parsed.error.flatten().fieldErrors
        });
      }

      const activeSecret = await app.prisma.mfaSecret.findFirst({
        where: {
          userId: request.user.sub,
          disabledAt: null,
          confirmedAt: { not: null }
        },
        orderBy: { createdAt: "desc" }
      });

      if (!activeSecret) {
        return reply.status(400).send({ message: "No active MFA secret to disable" });
      }

      let verified = false;
      let hashedCodes = extractHashedRecoveryCodes(activeSecret.recoveryCodes);
      let recoveryCodeUsed = false;
      let decryptedSecret: ReturnType<typeof app.mfaService.decryptSecret> | null = null;

      if (parsed.data.mfaCode) {
        try {
          decryptedSecret = app.mfaService.decryptSecret(activeSecret.secret);
        } catch (error) {
          request.log.error(
            { err: error, userId: request.user.sub },
            "Failed to decrypt MFA secret during disable",
          );
          return reply.status(500).send({ message: "Unable to verify MFA challenge" });
        }

        try {
          verified = await app.mfaService.verifyTotp(
            decryptedSecret.secret,
            parsed.data.mfaCode,
          );
        } catch (error) {
          request.log.error({ err: error, userId: request.user.sub }, "Failed to verify MFA code during disable");
          return reply.status(500).send({ message: "Unable to verify MFA challenge" });
        }
      }

      if (!verified && parsed.data.recoveryCode) {
        try {
          const matchIndex = await app.mfaService.findMatchingRecoveryCode(
            hashedCodes,
            parsed.data.recoveryCode
          );
          if (matchIndex !== null) {
            verified = true;
            recoveryCodeUsed = true;
            hashedCodes.splice(matchIndex, 1);
          }
        } catch (error) {
          request.log.error({ err: error, userId: request.user.sub }, "Failed to verify recovery code during disable");
          return reply.status(500).send({ message: "Unable to verify MFA challenge" });
        }
      }

      if (!verified) {
        return reply.status(401).send({ message: "Invalid multi-factor credentials" });
      }

      try {
        await app.prisma.$transaction(async (tx) => {
          if (recoveryCodeUsed || decryptedSecret?.needsRotation) {
            const updateData: PrismaNamespace.MfaSecretUpdateInput = {};
            if (recoveryCodeUsed) {
              updateData.recoveryCodes = hashedCodes.join("\n");
              updateData.rotatedAt = new Date();
            }
            if (decryptedSecret?.needsRotation) {
              updateData.secret = app.mfaService.encryptSecret(decryptedSecret.secret);
              updateData.rotatedAt = new Date();
            }

            await tx.mfaSecret.update({
              where: { id: activeSecret.id },
              data: updateData
            });
          }

          await tx.mfaSecret.updateMany({
            where: { userId: request.user!.sub, disabledAt: null },
            data: { disabledAt: new Date() }
          });

          await tx.mfaSecret.deleteMany({
            where: { userId: request.user!.sub, confirmedAt: null }
          });
        });
      } catch (error) {
        request.log.error({ err: error, userId: request.user.sub }, "Failed to disable MFA");
        return reply.status(500).send({ message: "Unable to disable MFA" });
      }

      return reply.send({ message: "Multi-factor authentication disabled" });
    }
  );

  app.post(
    "/auth/login",
    {
      config: {
        rateLimit: {
          max: env.RATE_LIMIT_AUTH_POINTS,
          timeWindow: env.RATE_LIMIT_AUTH_DURATION * 1000
        }
      }
    },
    async (request, reply) => {
      const parsed = loginSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          message: "Invalid payload",
          errors: parsed.error.flatten().fieldErrors
        });
      }

      const { identifier, password, mfaCode, recoveryCode } = parsed.data;

      try {
        const result = await loginService.execute(request, {
          identifier,
          password,
          mfaCode,
          recoveryCode
        });

        if (result.status === "mfa-required") {
          return reply.status(401).send({
            message: "MFA challenge required",
            mfaRequired: true
          });
        }

        applySessionTokens(reply, result.tokens);

        return reply.send({
          user: result.user,
          accessToken: result.tokens.accessToken,
          refreshExpiresAt: result.tokens.refreshExpiresAt.toISOString()
        });
      } catch (error) {
        if (error instanceof LoginServiceError) {
          return reply.status(error.statusCode).send(error.response);
        }

        request.log.error({ err: error }, "Unexpected error during login");
        return reply.status(500).send({ message: "Unable to complete login" });
      }
    }
  );

  app.post(
    "/auth/refresh",
    {
      config: {
        rateLimit: {
          max: env.RATE_LIMIT_AUTH_POINTS,
          timeWindow: env.RATE_LIMIT_AUTH_DURATION * 1000
        }
      }
    },
    async (request, reply) => {
      const refreshToken = readRefreshTokenFromRequest(request);
      if (!refreshToken) {
        return reply.status(401).send({ message: "Refresh token missing" });
      }

      if (!verifyRefreshCsrf(request, reply)) {
        return reply.status(403).send({ message: "CSRF token missing or invalid" });
      }

      try {
        const result = await rotateRefreshToken(app, refreshToken);
        applySessionTokens(reply, result);

      return reply.send({
        user: result.user,
        accessToken: result.accessToken,
        refreshExpiresAt: result.refreshExpiresAt.toISOString()
      });
    } catch (error) {
      if (error instanceof RefreshTokenError) {
        clearRefreshCookie(reply);
        return reply.status(401).send({ message: "Refresh token invalid" });
      }

      request.log.error({ err: error }, "Unexpected error while rotating refresh token");
      return reply.status(500).send({ message: "Unable to refresh session" });
    }
    }
  );

  app.post("/auth/logout", async (request, reply) => {
    const refreshToken = readRefreshTokenFromRequest(request);

    if (refreshToken && !verifyRefreshCsrf(request, reply)) {
      return reply.status(403).send({ message: "CSRF token missing or invalid" });
    }

    clearRefreshCookie(reply);

    if (!refreshToken) {
      return reply.status(204).send();
    }

    try {
      const hashed = hashToken(refreshToken);
      const tokenRecord = await app.prisma.refreshToken.findUnique({
        where: { tokenHash: hashed },
        select: {
          id: true,
          familyId: true,
          userId: true
        }
      });

      if (!tokenRecord) {
        return reply.status(204).send();
      }

      await revokeRefreshFamily(app, tokenRecord.familyId, "logout");
      await recordLoginAudit(app, request, {
        userId: tokenRecord.userId,
        event: LoginAuditEvent.LOGOUT
      });
    } catch (error) {
      request.log.error({ err: error }, "Failed to revoke refresh family on logout");
    }

    return reply.status(204).send();
  });

  app.post(
    "/auth/password/reset/request",
    {
      config: {
        rateLimit: {
          max: env.RATE_LIMIT_AUTH_POINTS,
          timeWindow: env.RATE_LIMIT_AUTH_DURATION * 1000
        }
      }
    },
    async (request, reply) => {
      const parsed = passwordResetRequestSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          message: "Invalid payload",
          errors: parsed.error.flatten().fieldErrors
        });
      }

    const email = parsed.data.email.toLowerCase();
    const user = await app.prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, nickname: true }
    });

    if (user) {
      const token = randomBytes(48).toString("hex");
      const tokenHash = createHash("sha256").update(token).digest("hex");
      const expiresAt = new Date(Date.now() + env.PASSWORD_RESET_TTL_MS);

      try {
        await app.prisma.$transaction(async (tx) => {
          await tx.passwordResetToken.updateMany({
            where: { userId: user.id, redeemedAt: null },
            data: { redeemedAt: new Date() }
          });

          await tx.passwordResetToken.create({
            data: {
              userId: user.id,
              tokenHash,
              expiresAt
            }
          });
        });

        await app.emailService.sendPasswordReset({
          to: user.email,
          nickname: user.nickname,
          token,
          expiresAt
        });
      } catch (error) {
        request.log.error({ err: error, userId: user.id }, "Failed to create password reset token");
      }
    }

    return reply.send({ message: "If the account exists we sent reset instructions." });
  }
  );

  app.post(
    "/auth/password/reset/confirm",
    {
      config: {
        rateLimit: {
          max: env.RATE_LIMIT_AUTH_POINTS,
          timeWindow: env.RATE_LIMIT_AUTH_DURATION * 1000
        }
      }
    },
    async (request, reply) => {
      const parsed = passwordResetConfirmSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          message: "Invalid payload",
          errors: parsed.error.flatten().fieldErrors
        });
      }

      const { token, password } = parsed.data;
      const tokenHash = createHash("sha256").update(token).digest("hex");

      const resetRecord = await app.prisma.passwordResetToken.findUnique({
        where: { tokenHash },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              nickname: true,
              role: true,
              passwordHash: true
            }
          }
        }
      });

      if (!resetRecord || resetRecord.redeemedAt || resetRecord.expiresAt <= new Date()) {
        return reply.status(400).send({ message: "Reset token is invalid or expired" });
      }

      const passwordHash = await argon2.hash(password, { type: argon2.argon2id });

      const { updatedUser, tokens } = await app.prisma.$transaction(async (tx) => {
        const updatedUser = await tx.user.update({
          where: { id: resetRecord.userId },
          data: { passwordHash },
          select: {
            id: true,
            email: true,
            nickname: true,
            role: true
          }
        });

        await tx.passwordResetToken.update({
          where: { id: resetRecord.id },
          data: { redeemedAt: new Date() }
        });

        await revokeUserRefreshFamilies(app, resetRecord.userId, "password_reset", tx);

        const tokens = await issueSessionTokens(app, updatedUser.id, updatedUser.role, { tx });

        return { updatedUser, tokens };
      });

      applySessionTokens(reply, tokens);

      await recordLoginAudit(app, request, {
        userId: updatedUser.id,
        event: LoginAuditEvent.PASSWORD_RESET
      });

      return reply.send({
        user: updatedUser,
        accessToken: tokens.accessToken,
        refreshExpiresAt: tokens.refreshExpiresAt.toISOString()
      });
    }
  );
}
