import { FastifyInstance } from "fastify";
import { z } from "zod";
import argon2 from "argon2";
import { issueSessionTokens } from "../utils/tokens.js";

const adminPayloadSchema = z.object({
  email: z.string().email(),
  nickname: z.string().min(3).max(32),
  password: z
    .string()
    .min(8)
    .regex(/[A-Z]/, "Password must include an uppercase letter")
    .regex(/[0-9]/, "Password must include a digit")
});

export async function registerOnboardingRoutes(app: FastifyInstance) {
  app.get("/onboarding/status", async () => {
    const userCount = await app.prisma.user.count();
    return {
      needsSetup: userCount === 0
    };
  });

  app.post("/onboarding/admin", async (request, reply) => {
    const validation = adminPayloadSchema.safeParse(request.body);
    if (!validation.success) {
      return reply.status(400).send({
        message: "Invalid payload",
        errors: validation.error.flatten().fieldErrors
      });
    }

    const existingUsers = await app.prisma.user.count();
    if (existingUsers > 0) {
      return reply.status(400).send({
        message: "Onboarding is already completed."
      });
    }

    const { email, nickname, password } = validation.data;

    const passwordHash = await argon2.hash(password, {
      type: argon2.argon2id
    });

    const adminUser = await app.prisma.user.create({
      data: {
        email: email.toLowerCase(),
        nickname,
        displayName: nickname,
        passwordHash,
        role: "ADMIN"
      }
    });

    const { accessToken, refreshToken, refreshExpiresAt } = await issueSessionTokens(
      app,
      adminUser.id,
      adminUser.role
    );

    request.log.info(
      { userId: adminUser.id },
      "Initial admin account created via onboarding"
    );

    return reply.status(201).send({
      user: {
        id: adminUser.id,
        email: adminUser.email,
        nickname: adminUser.nickname,
        role: adminUser.role
      },
      accessToken,
      refreshToken,
      refreshExpiresAt: refreshExpiresAt.toISOString()
    });
  });
}
