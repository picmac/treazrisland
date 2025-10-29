import { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  isNetplayServiceError,
  NetplayServiceError,
  type NetplayService,
  type NetplaySession
} from "../services/netplay/types.js";
import {
  isValidNetplayJoinCode,
  normalizeNetplayJoinCode
} from "../utils/netplayCodes.js";

const createSessionSchema = z.object({
  romId: z.string().min(1).optional(),
  ttlMinutes: z
    .number()
    .int()
    .min(5, "TTL must be at least 5 minutes")
    .max(360, "TTL cannot exceed 360 minutes")
    .default(60)
});

const joinSessionSchema = z.object({
  joinCode: z
    .string()
    .min(1)
    .transform((value) => normalizeNetplayJoinCode(value))
    .refine((value) => isValidNetplayJoinCode(value), {
      message: "Join code must be 6 characters from the allowed alphabet",
      path: ["joinCode"]
    })
});

const sessionIdParamsSchema = z.object({
  id: z.string().min(1)
});

const mapParticipant = (participant: NetplaySession["participants"][number]) => ({
  id: participant.id,
  sessionId: participant.sessionId,
  userId: participant.userId,
  role: participant.role,
  nickname: participant.nickname,
  displayName: participant.displayName,
  joinedAt: participant.joinedAt.toISOString()
});

type ParticipantResponse = ReturnType<typeof mapParticipant>;

const mapSession = (session: NetplaySession) => ({
  id: session.id,
  hostUserId: session.hostUserId,
  romId: session.romId,
  joinCode: session.joinCode,
  status: session.status,
  createdAt: session.createdAt.toISOString(),
  updatedAt: session.updatedAt.toISOString(),
  expiresAt: session.expiresAt.toISOString(),
  externalSessionId: session.externalSessionId,
  participants: session.participants.map(mapParticipant)
});

type SessionResponse = ReturnType<typeof mapSession>;

const respondWithServiceError = (
  app: FastifyInstance,
  error: unknown,
  defaultMessage: string
) => {
  if (isNetplayServiceError(error)) {
    switch (error.code) {
      case "SESSION_NOT_FOUND":
      case "INVALID_JOIN_CODE":
        return { status: 404, body: { message: "Session not found" } } as const;
      case "UNAUTHORIZED":
        return { status: 403, body: { message: "Not authorized for this session" } } as const;
      case "SESSION_CLOSED":
      case "SESSION_FULL":
      case "ALREADY_JOINED":
      case "MAX_ACTIVE_SESSIONS":
        return { status: 409, body: { message: error.message } } as const;
      default:
        break;
    }
  }

  app.log.error({ err: error }, "Unexpected netplay service failure");
  return { status: 500, body: { message: defaultMessage } } as const;
};

export async function registerNetplayRoutes(app: FastifyInstance) {
  const hasNetplayService =
    typeof app.hasDecorator === "function" ? app.hasDecorator("netplayService") : "netplayService" in app;

  if (!hasNetplayService) {
    const createError = () =>
      new NetplayServiceError("Netplay service is not configured", "UNKNOWN");

    const placeholder: NetplayService = {
      async createSession(): Promise<NetplaySession> {
        throw createError();
      },
      async joinSession(): Promise<NetplaySession> {
        throw createError();
      },
      async listSessionsForUser(): Promise<NetplaySession[]> {
        throw createError();
      },
      async getSessionById(): Promise<NetplaySession | null> {
        throw createError();
      },
      async deleteSession(): Promise<void> {
        throw createError();
      }
    };

    app.decorate("netplayService", placeholder);
  }

  app.post(
    "/netplay/sessions",
    {
      preHandler: [app.authenticate],
      config: {
        rateLimit: {
          max: 10,
          timeWindow: 60_000
        }
      }
    },
    async (request, reply) => {
      const validation = createSessionSchema.safeParse(request.body ?? {});
      if (!validation.success) {
        return reply.status(400).send({
          message: "Invalid payload",
          errors: validation.error.flatten().fieldErrors
        });
      }

      const { ttlMinutes, romId } = validation.data;

      try {
        const session = await app.netplayService.createSession({
          hostUserId: request.user!.sub,
          romId: romId ?? null,
          ttlMinutes
        });

        return reply.status(201).send({ session: mapSession(session) });
      } catch (error) {
        const result = respondWithServiceError(
          app,
          error,
          "Failed to create netplay session"
        );
        return reply.status(result.status).send(result.body);
      }
    }
  );

  app.post(
    "/netplay/sessions/join",
    {
      preHandler: [app.authenticate],
      config: {
        rateLimit: {
          max: 20,
          timeWindow: 60_000
        }
      }
    },
    async (request, reply) => {
      const validation = joinSessionSchema.safeParse(request.body ?? {});
      if (!validation.success) {
        return reply.status(400).send({
          message: "Invalid payload",
          errors: validation.error.flatten().fieldErrors
        });
      }

      const { joinCode } = validation.data;

      try {
        const session = await app.netplayService.joinSession({
          userId: request.user!.sub,
          joinCode
        });

        return reply.status(200).send({ session: mapSession(session) });
      } catch (error) {
        const result = respondWithServiceError(app, error, "Failed to join netplay session");
        return reply.status(result.status).send(result.body);
      }
    }
  );

  app.get(
    "/netplay/sessions",
    {
      preHandler: [app.authenticate],
      config: {
        rateLimit: {
          max: 60,
          timeWindow: 60_000
        }
      }
    },
    async (request, reply) => {
      const sessions = await app.netplayService.listSessionsForUser(request.user!.sub);
      return reply.send({ sessions: sessions.map(mapSession) });
    }
  );

  app.get(
    "/netplay/sessions/:id",
    {
      preHandler: [app.authenticate],
      config: {
        rateLimit: {
          max: 30,
          timeWindow: 60_000
        }
      }
    },
    async (request, reply) => {
      const parsedParams = sessionIdParamsSchema.safeParse(request.params ?? {});
      if (!parsedParams.success) {
        return reply.status(400).send({
          message: "Invalid session identifier"
        });
      }

      const { id } = parsedParams.data;
      const session = await app.netplayService.getSessionById(id);

      if (!session) {
        return reply.status(404).send({ message: "Session not found" });
      }

      const userId = request.user!.sub;
      const isParticipant =
        session.hostUserId === userId ||
        session.participants.some((participant) => participant.userId === userId);

      if (!isParticipant) {
        return reply.status(403).send({ message: "Not authorized to view this session" });
      }

      return reply.send({ session: mapSession(session) });
    }
  );

  app.delete(
    "/netplay/sessions/:id",
    {
      preHandler: [app.authenticate],
      config: {
        rateLimit: {
          max: 20,
          timeWindow: 60_000
        }
      }
    },
    async (request, reply) => {
      const parsedParams = sessionIdParamsSchema.safeParse(request.params ?? {});
      if (!parsedParams.success) {
        return reply.status(400).send({
          message: "Invalid session identifier"
        });
      }

      const { id } = parsedParams.data;
      const session = await app.netplayService.getSessionById(id);

      if (!session) {
        return reply.status(404).send({ message: "Session not found" });
      }

      if (session.hostUserId !== request.user!.sub) {
        return reply.status(403).send({ message: "Only the host can end this session" });
      }

      try {
        await app.netplayService.deleteSession({
          sessionId: id,
          requestingUserId: request.user!.sub
        });
      } catch (error) {
        const result = respondWithServiceError(app, error, "Failed to end netplay session");
        return reply.status(result.status).send(result.body);
      }

      return reply.status(204).send();
    }
  );
}
