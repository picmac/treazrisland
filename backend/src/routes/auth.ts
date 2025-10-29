import { FastifyInstance } from "fastify";
import { z } from "zod";
import { createHash } from "node:crypto";
import argon2 from "argon2";
import { issueSessionTokens } from "../utils/tokens.js";
import { Prisma } from "@prisma/client";

const invitationTokenSchema = z.object({
  token: z.string().min(1)
});

const signupSchema = z.object({
  token: z.string().min(1),
  email: z.string().email().optional(),
  nickname: z.string().min(3).max(32),
  password: z
    .string()
    .min(8)
    .regex(/[A-Z]/, "Password must include an uppercase letter")
    .regex(/[0-9]/, "Password must include a digit"),
  displayName: z.string().min(1).max(64).optional()
});

export async function registerAuthRoutes(app: FastifyInstance) {
  app.post("/auth/invitations/preview", async (request, reply) => {
    const parsed = invitationTokenSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        message: "Invalid payload",
        errors: parsed.error.flatten().fieldErrors
      });
    }

    const { token } = parsed.data;
    const tokenHash = createHash("sha256").update(token).digest("hex");
    const invitation = await app.prisma.userInvitation.findUnique({
      where: { tokenHash }
    });

    if (!invitation || invitation.redeemedAt || invitation.expiresAt <= new Date()) {
      return reply.status(404).send({ message: "Invitation not found or expired" });
    }

    return reply.send({
      invitation: {
        role: invitation.role,
        email: invitation.email
      }
    });
  });

  app.post("/auth/signup", async (request, reply) => {
    const parsed = signupSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        message: "Invalid payload",
        errors: parsed.error.flatten().fieldErrors
      });
    }

    const { token, email, nickname, password, displayName } = parsed.data;
    const tokenHash = createHash("sha256").update(token).digest("hex");

    try {
      const result = await app.prisma.$transaction(async (tx) => {
        const invitation = await tx.userInvitation.findUnique({
          where: { tokenHash }
        });

        if (!invitation || invitation.redeemedAt || invitation.expiresAt <= new Date()) {
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

        return { user };
      });

      const { accessToken, refreshToken, refreshExpiresAt } = await issueSessionTokens(
        app,
        result.user.id,
        result.user.role
      );

      return reply.status(201).send({
        user: {
          id: result.user.id,
          email: result.user.email,
          nickname: result.user.nickname,
          role: result.user.role
        },
        accessToken,
        refreshToken,
        refreshExpiresAt: refreshExpiresAt.toISOString()
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
          default:
            break;
        }
      }

      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        return reply.status(409).send({ message: "Email or nickname already in use" });
      }

      request.log.error({ err: error }, "Failed to complete signup");
      return reply.status(500).send({ message: "Unexpected error during signup" });
    }
  });
}
