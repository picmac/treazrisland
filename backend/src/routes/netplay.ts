import { FastifyInstance, FastifyReply } from "fastify";
import { z } from "zod";
import { NETPLAY_JOIN_CODE_REGEX, normaliseNetplayJoinCode } from "../utils/netplayCodes.js";
import {
  NetplayParticipant,
  NetplaySession,
  isNetplayServiceError
} from "../services/netplay/types.js";

const TTL_MIN_MINUTES = 5;
const TTL_MAX_MINUTES = 360;

const createSessionSchema = z
  .object({
    ttlMinutes: z
      .coerce
      .number({ invalid_type_error: "ttlMinutes must be a number" })
      .int()
      .min(TTL_MIN_MINUTES)
      .max(TTL_MAX_MINUTES)
      .default(60),
    gameId: z
      .string()
      .min(1)
      .max(128)
      .optional()
  })
  .strict();

const joinSessionSchema = z
  .object({
    joinCode: z.string().min(1).max(32)
  })
  .strict();

const sessionIdParamsSchema = z
  .object({
    id: z.string().min(1)
  })
  .strict();

type ValidationResult<T extends z.ZodTypeAny> = z.infer<T>;

const formatParticipant = (participant: NetplayParticipant) => ({
  id: participant.id,
  userId: participant.userId,
  displayName: participant.displayName ?? null,
  joinedAt: participant.joinedAt.toISOString()
});

const formatSession = (session: NetplaySession) => ({
  id: session.id,
  hostId: session.hostId,
  hostDisplayName: session.hostDisplayName ?? null,
  joinCode: session.joinCode,
  gameId: session.gameId ?? null,
  expiresAt: session.expiresAt.toISOString(),
  createdAt: session.createdAt.toISOString(),
  endedAt: session.endedAt ? session.endedAt.toISOString() : null,
  participants: session.participants.map(formatParticipant)
});

const sendValidationError = (reply: FastifyReply, error: z.ZodError) => {
  return reply.status(400).send({
    message: "Invalid payload",
    errors: error.flatten().fieldErrors
  });
};

const handleServiceError = (reply: FastifyReply, error: unknown) => {
  if (isNetplayServiceError(error)) {
    return reply.status(error.statusCode).send({
      message: error.message,
      code: error.code,
      details: error.details ?? undefined
    });
  }

  throw error;
};

export async function registerNetplayRoutes(app: FastifyInstance) {
  const authenticatedConfig = {
    preHandler: [app.authenticate]
  } as const;

  app.post(
    "/netplay/sessions",
    {
      ...authenticatedConfig,
      config: {
        rateLimit: {
          max: 5,
          timeWindow: 60_000
        }
      }
    },
    async (request, reply) => {
      const validation = createSessionSchema.safeParse(request.body ?? {});

      if (!validation.success) {
        return sendValidationError(reply, validation.error);
      }

      const payload: ValidationResult<typeof createSessionSchema> = validation.data;

      try {
        const session = await app.netplayService.createSession({
          hostId: request.user!.sub,
          ttlMinutes: payload.ttlMinutes,
          gameId: payload.gameId ?? null
        });

        return reply.status(201).send({
          session: formatSession(session)
        });
      } catch (error) {
        return handleServiceError(reply, error);
      }
    }
  );

  app.post(
    "/netplay/sessions/join",
    {
      ...authenticatedConfig,
      config: {
        rateLimit: {
          max: 10,
          timeWindow: 60_000
        }
      }
    },
    async (request, reply) => {
      const validation = joinSessionSchema.safeParse(request.body ?? {});

      if (!validation.success) {
        return sendValidationError(reply, validation.error);
      }

      const payload: ValidationResult<typeof joinSessionSchema> = validation.data;
      const normalisedCode = normaliseNetplayJoinCode(payload.joinCode);

      if (!NETPLAY_JOIN_CODE_REGEX.test(normalisedCode)) {
        return reply.status(400).send({
          message: "Join code is not valid"
        });
      }

      try {
        const result = await app.netplayService.joinSession({
          joinCode: normalisedCode,
          playerId: request.user!.sub
        });

        return reply.send({
          session: formatSession(result.session),
          participant: formatParticipant(result.participant)
        });
      } catch (error) {
        return handleServiceError(reply, error);
      }
    }
  );

  app.get(
    "/netplay/sessions",
    {
      ...authenticatedConfig,
      config: {
        rateLimit: {
          max: 20,
          timeWindow: 60_000
        }
      }
    },
    async (request) => {
      const sessions = await app.netplayService.listSessions({
        userId: request.user!.sub
      });

      return {
        sessions: sessions.map(formatSession)
      };
    }
  );

  app.get(
    "/netplay/sessions/:id",
    {
      ...authenticatedConfig,
      config: {
        rateLimit: {
          max: 30,
          timeWindow: 60_000
        }
      }
    },
    async (request, reply) => {
      const validation = sessionIdParamsSchema.safeParse(request.params ?? {});

      if (!validation.success) {
        return sendValidationError(reply, validation.error);
      }

      const { id } = validation.data;

      const session = await app.netplayService.getSession({
        sessionId: id
      });

      if (!session) {
        return reply.status(404).send({
          message: "Session not found"
        });
      }

      return {
        session: formatSession(session)
      };
    }
  );

  app.delete(
    "/netplay/sessions/:id",
    {
      ...authenticatedConfig,
      config: {
        rateLimit: {
          max: 5,
          timeWindow: 60_000
        }
      }
    },
    async (request, reply) => {
      const validation = sessionIdParamsSchema.safeParse(request.params ?? {});

      if (!validation.success) {
        return sendValidationError(reply, validation.error);
      }

      const { id } = validation.data;

      try {
        await app.netplayService.endSession({
          sessionId: id,
          requestedBy: request.user!.sub
        });
      } catch (error) {
        return handleServiceError(reply, error);
      }

      return reply.status(204).send();
    }
  );
}
