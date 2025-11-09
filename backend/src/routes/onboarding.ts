import { FastifyInstance } from "fastify";
import argon2 from "argon2";
import { issueSessionTokens } from "../utils/tokens.js";
import { setRefreshCookie } from "../utils/cookies.js";
import { env } from "../config/env.js";
import {
  fetchSetupState,
  updateSetupStep,
  type OnboardingStepKey,
} from "../services/setup/state.js";
import {
  adminPayloadSchema,
  stepUpdateSchema,
  stepParamsSchema,
  type StepUpdateSettings,
} from "../schemas/onboarding.js";

const buildStepPayload = (
  settings: StepUpdateSettings,
  notes?: string,
): Record<string, unknown> | undefined => {
  if (!notes && !settings) {
    return undefined;
  }

  const payload: Record<string, unknown> = {};
  if (notes) {
    payload.notes = notes;
  }

  if (settings) {
    payload.settings = settings;
  }

  return Object.keys(payload).length > 0 ? payload : undefined;
};

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
      const parsed = adminPayloadSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          message: "Invalid payload",
          errors: parsed.error.flatten().fieldErrors,
        });
      }

      const existingUsers = await app.prisma.user.count();
      if (existingUsers > 0) {
        return reply.status(400).send({
          message: "Onboarding is already completed.",
        });
      }

      const { email, nickname, password } = parsed.data;
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
      config: {
        rateLimit: {
          max: env.RATE_LIMIT_AUTH_POINTS,
          timeWindow: env.RATE_LIMIT_AUTH_DURATION * 1000,
        },
      },
    },
    async (request, reply) => {
      const params = stepParamsSchema.parse(request.params);

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
        buildStepPayload(validation.data.settings, validation.data.notes),
      );

      return {
        setupComplete: updatedState.setupComplete,
        steps: updatedState.steps,
      };
    },
  );
}
