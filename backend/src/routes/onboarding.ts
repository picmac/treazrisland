import { FastifyInstance } from "fastify";
import { z } from "zod";
import argon2 from "argon2";
import { env } from "../config/env.js";
import { issueSessionTokens } from "../utils/tokens.js";
import { setRefreshCookie } from "../utils/cookies.js";
import {
  fetchSetupState,
  updateSetupStep,
  ONBOARDING_STEP_KEYS,
  type OnboardingStepKey,
} from "../services/setup/state.js";
import {
  systemProfileSchema,
  storageSchema,
  emailSchema,
  metricsSchema,
  screenscraperSchema,
  personalizationSchema,
} from "../plugins/settings.js";
import { passwordSchema } from "../utils/passwordPolicy.js";

const adminPayloadSchema = z.object({
  email: z.string().email(),
  nickname: z.string().min(3).max(32),
  password: passwordSchema,
});

const stepUpdateSchema = z.object({
  status: z.enum(["COMPLETED", "SKIPPED"]),
  settings: z
    .object({
      systemProfile: systemProfileSchema.partial().optional(),
      storage: storageSchema.partial().optional(),
      email: emailSchema.partial().optional(),
      metrics: metricsSchema.partial().optional(),
      screenscraper: screenscraperSchema.partial().optional(),
      personalization: personalizationSchema.partial().optional(),
    })
    .partial()
    .optional(),
  notes: z.string().max(200).optional(),
});

export async function registerOnboardingRoutes(app: FastifyInstance) {
  app.get("/onboarding/status", async () => {
    const [userCount, setupState] = await Promise.all([
      app.prisma.user.count(),
      fetchSetupState(app.prisma),
    ]);

    const pendingSteps = Object.entries(setupState.steps)
      .filter(([, state]) => state.status === "PENDING")
      .map(([key]) => key as OnboardingStepKey);

    const needsSetup = userCount === 0 || !setupState.setupComplete;

    return {
      needsSetup,
      setupComplete: setupState.setupComplete,
      steps: setupState.steps,
      pendingSteps,
    };
  });

  app.post(
    "/onboarding/admin",
    {
      config: {
        rateLimit: {
          max: env.RATE_LIMIT_AUTH_POINTS,
          timeWindow: env.RATE_LIMIT_AUTH_DURATION * 1000,
        },
      },
    },
    async (request, reply) => {
    const validation = adminPayloadSchema.safeParse(request.body);
    if (!validation.success) {
      return reply.status(400).send({
        message: "Invalid payload",
        errors: validation.error.flatten().fieldErrors,
      });
    }

    const existingUsers = await app.prisma.user.count();
    if (existingUsers > 0) {
      return reply.status(400).send({
        message: "Onboarding is already completed.",
      });
    }

    const { email, nickname, password } = validation.data;

    const passwordHash = await argon2.hash(password, {
      type: argon2.argon2id,
    });

    const adminUser = await app.prisma.user.create({
      data: {
        email: email.toLowerCase(),
        nickname,
        displayName: nickname,
        passwordHash,
        role: "ADMIN",
      },
    });

    const { accessToken, refreshToken, refreshExpiresAt } =
      await issueSessionTokens(app, adminUser.id, adminUser.role);

    setRefreshCookie(reply, refreshToken, refreshExpiresAt);

    await updateSetupStep(app.prisma, "first-admin", "COMPLETED", {
      userId: adminUser.id,
    });

    request.log.info(
      { userId: adminUser.id },
      "Initial admin account created via onboarding",
    );

    return reply.status(201).send({
      user: {
        id: adminUser.id,
        email: adminUser.email,
        nickname: adminUser.nickname,
        role: adminUser.role,
      },
      accessToken,
      refreshExpiresAt: refreshExpiresAt.toISOString(),
    });
    },
  );

  app.patch(
    "/onboarding/steps/:stepKey",
    {
      preHandler: async (request, reply) => {
        await app.authenticate(request, reply);
        await app.requireAdmin(request, reply);
      },
    },
    async (request, reply) => {
      const params = z
        .object({
          stepKey: z.enum(ONBOARDING_STEP_KEYS),
        })
        .parse(request.params);

      if (params.stepKey === "first-admin") {
        return reply.status(400).send({
          message: "First admin step is managed automatically",
        });
      }

      const validation = stepUpdateSchema.safeParse(request.body ?? {});
      if (!validation.success) {
        return reply.status(400).send({
          message: "Invalid step payload",
          errors: validation.error.flatten().fieldErrors,
        });
      }

      if (validation.data.settings) {
        await app.settings.update(validation.data.settings, {
          actorId: request.user?.sub,
        });
      }

      const updatedState = await updateSetupStep(
        app.prisma,
        params.stepKey,
        validation.data.status,
        validation.data.notes ? { notes: validation.data.notes } : undefined,
      );

      return {
        setupComplete: updatedState.setupComplete,
        steps: updatedState.steps,
      };
    },
  );
}
