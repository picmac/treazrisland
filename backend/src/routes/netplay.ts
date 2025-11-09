import { randomBytes, createHash } from "node:crypto";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { NetplaySessionStatus } from "@prisma/client";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/library";
import { z } from "zod";
import { Server as SocketIOServer } from "socket.io";
import { env } from "../config/env.js";

const ACTIVE_SESSION_STATUSES: NetplaySessionStatus[] = [
  "OPEN",
  "ACTIVE",
];

const createSessionBodySchema = z.object({
  romId: z.string().trim().min(1, "romId is required"),
  saveStateId: z.string().trim().min(1).optional(),
});

const sessionParamsSchema = z.object({
  sessionId: z.string().trim().min(1, "sessionId is required"),
});

const inviteBodySchema = z.object({
  userId: z.string().trim().min(1, "userId is required"),
});

const joinBodySchema = z.object({});

const heartbeatBodySchema = z.object({
  peerToken: z.string().trim().min(1, "peerToken is required"),
  status: z.enum(["connected", "disconnected"]).optional(),
});

const signalMessageSchema = z.object({
  type: z.string().trim().min(1).max(64),
  payload: z.unknown(),
  targetUserId: z.string().trim().min(1).optional(),
});

const hashPeerToken = (token: string): string =>
  createHash("sha256").update(token).digest("hex");

const generatePeerToken = () => randomBytes(32).toString("hex");

const serializeParticipant = (participant: {
  id: string;
  userId: string;
  role: string;
  status: string;
  lastHeartbeatAt: Date | null;
  connectedAt: Date | null;
  disconnectedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}) => ({
  id: participant.id,
  userId: participant.userId,
  role: participant.role,
  status: participant.status,
  lastHeartbeatAt: participant.lastHeartbeatAt?.toISOString(),
  connectedAt: participant.connectedAt?.toISOString(),
  disconnectedAt: participant.disconnectedAt?.toISOString(),
  createdAt: participant.createdAt.toISOString(),
  updatedAt: participant.updatedAt.toISOString(),
});

const serializeSession = (session: {
  id: string;
  romId: string;
  hostId: string;
  saveStateId: string | null;
  status: string;
  expiresAt: Date;
  lastActivityAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  participants: Array<{
    id: string;
    userId: string;
    role: string;
    status: string;
    lastHeartbeatAt: Date | null;
    connectedAt: Date | null;
    disconnectedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }>;
}) => ({
  id: session.id,
  romId: session.romId,
  hostId: session.hostId,
  saveStateId: session.saveStateId ?? undefined,
  status: session.status,
  expiresAt: session.expiresAt.toISOString(),
  lastActivityAt: session.lastActivityAt?.toISOString(),
  createdAt: session.createdAt.toISOString(),
  updatedAt: session.updatedAt.toISOString(),
  participants: session.participants.map(serializeParticipant),
});

const isExpired = (session: { expiresAt: Date; status: string }) =>
  session.status === "CLOSED" || session.expiresAt.getTime() <= Date.now();

type SerializedSession = ReturnType<typeof serializeSession>;
type SignalMessagePayload = z.input<typeof signalMessageSchema>;

type SignalAck =
  | { status: "ok"; id: string }
  | { status: "error"; message: string };

type NetplayServerToClientEvents = {
  "session:snapshot": (payload: {
    session: SerializedSession;
    peerToken: string;
  }) => void;
  "session:update": (payload: { session: SerializedSession }) => void;
  "session:closed": (
    payload: {
      sessionId: string;
      reason: "closed" | "expired" | "not_found";
    },
  ) => void;
  "signal:message": (payload: {
    id: string;
    sessionId: string;
    type: string;
    payload: unknown;
    sender: { userId: string; participantId: string };
    recipient?: { userId: string; participantId: string };
    createdAt: string;
  }) => void;
  "peer:token": (payload: { sessionId: string; peerToken: string }) => void;
};

type NetplayClientToServerEvents = {
  "signal:message": (
    payload: SignalMessagePayload,
    callback?: (response: SignalAck) => void,
  ) => void;
  "latency:ping": (callback?: (payload: { receivedAt: number }) => void) => void;
};

type NetplayInterServerEvents = Record<string, never>;

type NetplaySocketData = {
  sessionId: string;
  userId: string;
  participantId: string;
  peerTokenHash: string;
  peerToken: string;
  refreshedToken: boolean;
};

type NetplaySignalServer = SocketIOServer<
  NetplayServerToClientEvents,
  NetplayClientToServerEvents,
  NetplayInterServerEvents,
  NetplaySocketData
>;

const configuredSignalServers = new WeakSet<NetplaySignalServer>();

const sessionRoomId = (sessionId: string) => `netplay-session:${sessionId}`;

const normalizeOrigin = (value?: string) =>
  value ? value.replace(/\/$/, "") : undefined;

const getAllowedOrigins = () =>
  env.NETPLAY_SIGNAL_ALLOWED_ORIGINS
    ?.map((origin) => normalizeOrigin(origin))
    .filter((origin): origin is string => Boolean(origin)) ?? [];

const configureSignalServer = (
  instance: FastifyInstance,
  server: NetplaySignalServer,
) => {
  if (configuredSignalServers.has(server)) {
    return;
  }

  configuredSignalServers.add(server);

  const allowedOrigins = getAllowedOrigins();

  server.use(async (socket, next) => {
    try {
      if (allowedOrigins.length > 0) {
        const rawOrigin =
          (socket.handshake.headers.origin as string | undefined) ??
          (socket.handshake.headers.referer as string | undefined);
        const origin = normalizeOrigin(rawOrigin);

        if (!origin || !allowedOrigins.includes(origin)) {
          const error = new Error("Origin not allowed");
          return next(error);
        }
      }

      const authToken =
        typeof socket.handshake.auth?.token === "string"
          ? socket.handshake.auth.token
          : undefined;

      if (!authToken) {
        return next(new Error("Authentication token required"));
      }

      const fakeRequest = {
        headers: { authorization: `Bearer ${authToken}` },
        user: undefined as FastifyRequest["user"],
        async jwtVerify(this: FastifyRequest & { user?: typeof fakeRequest.user }) {
          const decoded = await instance.jwt.verify(authToken);
          this.user = decoded as typeof fakeRequest.user;
          return decoded;
        },
      } as unknown as FastifyRequest;

      const fakeReply = {} as FastifyReply;
      await instance.authenticate(fakeRequest, fakeReply);

      if (!fakeRequest.user) {
        return next(new Error("Authentication required"));
      }

      const sessionId =
        typeof socket.handshake.auth?.sessionId === "string"
          ? socket.handshake.auth.sessionId
          : undefined;

      if (!sessionId) {
        return next(new Error("sessionId is required"));
      }

      const providedPeerToken =
        typeof socket.handshake.auth?.peerToken === "string"
          ? socket.handshake.auth.peerToken
          : undefined;

      const participant = await instance.prisma.netplayParticipant.findUnique({
        where: { sessionId_userId: { sessionId, userId: fakeRequest.user.sub } },
        include: { session: { include: { participants: true } } },
      });

      if (!participant || !participant.session) {
        return next(new Error("Participant not found"));
      }

      if (isExpired(participant.session)) {
        await instance.prisma.netplaySession
          .update({
            where: { id: sessionId },
            data: { status: "CLOSED", expiresAt: new Date() },
          })
          .catch(() => undefined);
        return next(new Error("Session has expired"));
      }

      const now = new Date();
      const expiresAt = new Date(now.getTime() + env.NETPLAY_IDLE_TIMEOUT_MS);

      const needsNewToken =
        !participant.peerTokenHash ||
        !providedPeerToken ||
        participant.peerTokenHash !== hashPeerToken(providedPeerToken);

      const peerToken = needsNewToken ? generatePeerToken() : providedPeerToken!;
      const peerTokenHash = hashPeerToken(peerToken);

      const participantUpdate: Record<string, unknown> = {
        lastHeartbeatAt: now,
        peerTokenHash,
      };

      if (participant.status !== "CONNECTED") {
        participantUpdate.status = "CONNECTED";
        participantUpdate.disconnectedAt = null;
      }

      if (!participant.connectedAt) {
        participantUpdate.connectedAt = now;
      }

      await instance.prisma.$transaction([
        instance.prisma.netplayParticipant.update({
          where: { sessionId_userId: { sessionId, userId: fakeRequest.user.sub } },
          data: participantUpdate,
        }),
        instance.prisma.netplaySession.update({
          where: { id: sessionId },
          data: {
            lastActivityAt: now,
            expiresAt,
            status:
              participant.session.status === "OPEN"
                ? "ACTIVE"
                : participant.session.status,
          },
        }),
      ]);

      socket.data = {
        sessionId,
        userId: fakeRequest.user.sub,
        participantId: participant.id,
        peerTokenHash,
        peerToken,
        refreshedToken: needsNewToken,
      } satisfies NetplaySocketData;

      next();
    } catch (error) {
      instance.log.warn(
        {
          event: "netplay.signal.handshake_failed",
          error: error instanceof Error ? error.message : String(error),
        },
        "Netplay signal authentication failed",
      );
      next(error instanceof Error ? error : new Error("Authentication failed"));
    }
  });

  server.on("connection", (socket) => {
    const { sessionId } = socket.data;
    const room = sessionRoomId(sessionId);
    socket.join(room);

    const emitSnapshot = async (broadcast: boolean) => {
      try {
        const session = await instance.prisma.netplaySession.findUnique({
          where: { id: sessionId },
          include: { participants: true },
        });

        if (!session) {
          socket.emit("session:closed", { sessionId, reason: "not_found" });
          socket.disconnect(true);
          return;
        }

        if (isExpired(session)) {
          await instance.prisma.netplaySession
            .update({
              where: { id: sessionId },
              data: { status: "CLOSED", expiresAt: new Date() },
            })
            .catch(() => undefined);
          socket.emit("session:closed", { sessionId, reason: "expired" });
          socket.disconnect(true);
          return;
        }

        const serialized = serializeSession(session);
        socket.emit("session:snapshot", {
          session: serialized,
          peerToken: socket.data.peerToken,
        });

        if (socket.data.refreshedToken) {
          socket.emit("peer:token", {
            sessionId,
            peerToken: socket.data.peerToken,
          });
          socket.data.refreshedToken = false;
        }

        if (broadcast) {
          socket.to(room).emit("session:update", { session: serialized });
        }
      } catch (error) {
        instance.log.error(
          {
            event: "netplay.signal.snapshot_failed",
            sessionId,
            error: error instanceof Error ? error.message : String(error),
          },
          "Failed to emit netplay session snapshot",
        );
      }
    };

    void emitSnapshot(true);

    socket.on("signal:message", async (rawPayload, callback) => {
      const payloadResult = signalMessageSchema.safeParse(rawPayload);
      if (!payloadResult.success) {
        callback?.({ status: "error", message: "Invalid signal payload" });
        return;
      }

      try {
        const session = await instance.prisma.netplaySession.findUnique({
          where: { id: sessionId },
          include: { participants: true },
        });

        if (!session) {
          callback?.({ status: "error", message: "Session not found" });
          socket.emit("session:closed", { sessionId, reason: "not_found" });
          socket.disconnect(true);
          return;
        }

        if (isExpired(session)) {
          await instance.prisma.netplaySession
            .update({
              where: { id: sessionId },
              data: { status: "CLOSED", expiresAt: new Date() },
            })
            .catch(() => undefined);
          callback?.({ status: "error", message: "Session expired" });
          socket.emit("session:closed", { sessionId, reason: "expired" });
          socket.disconnect(true);
          return;
        }

        const targetUserId = payloadResult.data.targetUserId;
        const recipientParticipant = targetUserId
          ? session.participants.find((entry) => entry.userId === targetUserId)
          : undefined;

        if (targetUserId && !recipientParticipant) {
          callback?.({
            status: "error",
            message: "Recipient not part of session",
          });
          return;
        }

        const sanitizedPayload =
          payloadResult.data.payload === undefined
            ? null
            : payloadResult.data.payload;

        const now = new Date();
        const expiresAt = new Date(now.getTime() + env.NETPLAY_IDLE_TIMEOUT_MS);

        const messageRecord = await instance.prisma.netplaySignalMessage.create({
          data: {
            session: { connect: { id: sessionId } },
            sender: { connect: { id: socket.data.participantId } },
            senderTokenHash: socket.data.peerTokenHash,
            recipient: recipientParticipant
              ? { connect: { id: recipientParticipant.id } }
              : undefined,
            recipientTokenHash: recipientParticipant?.peerTokenHash ?? null,
            messageType: payloadResult.data.type,
            payload: sanitizedPayload,
          },
        });

        await instance.prisma.$transaction([
          instance.prisma.netplayParticipant.update({
            where: { id: socket.data.participantId },
            data: { lastHeartbeatAt: now },
          }),
          instance.prisma.netplaySession.update({
            where: { id: sessionId },
            data: { lastActivityAt: now, expiresAt },
          }),
        ]);

        const outbound = {
          id: messageRecord.id,
          sessionId,
          type: payloadResult.data.type,
          payload: sanitizedPayload,
          sender: {
            userId: socket.data.userId,
            participantId: socket.data.participantId,
          },
          recipient: recipientParticipant
            ? {
                userId: recipientParticipant.userId,
                participantId: recipientParticipant.id,
              }
            : undefined,
          createdAt: messageRecord.createdAt.toISOString(),
        } satisfies Parameters<
          NetplayServerToClientEvents["signal:message"]
        >[0];

        if (recipientParticipant) {
          for (const client of server.sockets.sockets.values()) {
            if (
              client.data.sessionId === sessionId &&
              client.data.userId === recipientParticipant.userId
            ) {
              client.emit("signal:message", outbound);
            }
          }
        } else {
          socket.to(room).emit("signal:message", outbound);
        }

        callback?.({ status: "ok", id: messageRecord.id });
      } catch (error) {
        instance.log.error(
          {
            event: "netplay.signal.forward_failed",
            sessionId,
            error: error instanceof Error ? error.message : String(error),
          },
          "Failed to process netplay signalling payload",
        );
        callback?.({
          status: "error",
          message: "Failed to forward signal message",
        });
      }
    });

    socket.on("latency:ping", (ack) => {
      ack?.({ receivedAt: Date.now() });
    });
  });
};

export async function registerNetplayRoutes(app: FastifyInstance) {
  app.register(async (instance) => {
    instance.addHook("preHandler", instance.authenticate);

    const existingServer = instance.netplaySignalServer as
      | NetplaySignalServer
      | undefined;

    if (!existingServer) {
      const corsOrigins =
        env.NETPLAY_SIGNAL_ALLOWED_ORIGINS &&
        env.NETPLAY_SIGNAL_ALLOWED_ORIGINS.length > 0
          ? env.NETPLAY_SIGNAL_ALLOWED_ORIGINS
          : true;

      const signalServer = new SocketIOServer<
        NetplayServerToClientEvents,
        NetplayClientToServerEvents,
        NetplayInterServerEvents,
        NetplaySocketData
      >(instance.server, {
        path: "/netplay/signal",
        serveClient: false,
        cors: {
          origin: corsOrigins,
          credentials: true,
        },
      });

      instance.netplaySignalServer = signalServer;
      configureSignalServer(instance, signalServer);

      instance.addHook("onClose", (fastify, done) => {
        const serverInstance = fastify.netplaySignalServer as
          | NetplaySignalServer
          | undefined;
        if (serverInstance) {
          serverInstance.removeAllListeners();
          serverInstance.close();
        }
        done();
      });
    } else {
      configureSignalServer(instance, existingServer);
    }

    instance.get("/netplay/sessions", async (request) => {
      const sessions = await instance.prisma.netplaySession.findMany({
        where: {
          participants: { some: { userId: request.user.sub } },
          status: { not: "CLOSED" },
        },
        orderBy: { createdAt: "desc" },
        include: { participants: true },
      });

      return {
        sessions: sessions.map(serializeSession),
      };
    });

    instance.post("/netplay/sessions", async (request, reply) => {
      const parseResult = createSessionBodySchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({ message: "Invalid session payload" });
      }

      const { romId, saveStateId } = parseResult.data;
      const now = new Date();
      const expiresAt = new Date(now.getTime() + env.NETPLAY_IDLE_TIMEOUT_MS);

      const [hostCount, totalCount] = await Promise.all([
        instance.prisma.netplaySession.count({
          where: {
            hostId: request.user.sub,
            status: { in: ACTIVE_SESSION_STATUSES },
            expiresAt: { gt: now },
          },
        }),
        instance.prisma.netplaySession.count({
          where: {
            status: { in: ACTIVE_SESSION_STATUSES },
            expiresAt: { gt: now },
          },
        }),
      ]);

      if (hostCount >= env.NETPLAY_MAX_HOSTED_SESSIONS) {
        return reply
          .status(429)
          .send({ message: "Host session limit reached" });
      }

      if (totalCount >= env.NETPLAY_MAX_CONCURRENT_SESSIONS) {
        return reply
          .status(503)
          .send({ message: "Netplay capacity reached" });
      }

      const peerToken = generatePeerToken();

      try {
        const session = await instance.prisma.netplaySession.create({
          data: {
            rom: { connect: { id: romId } },
            host: { connect: { id: request.user.sub } },
            saveState: saveStateId
              ? { connect: { id: saveStateId } }
              : undefined,
            status: "OPEN",
            expiresAt,
            lastActivityAt: now,
            participants: {
              create: {
                user: { connect: { id: request.user.sub } },
                role: "HOST",
                status: "CONNECTED",
                connectedAt: now,
                lastHeartbeatAt: now,
                peerTokenHash: hashPeerToken(peerToken),
              },
            },
          },
          include: { participants: true },
        });

        instance.log.info(
          {
            event: "netplay.session.created",
            sessionId: session.id,
            hostId: request.user.sub,
            romId,
          },
          "Netplay session created",
        );

        return reply.status(201).send({
          session: serializeSession(session),
          peerToken,
        });
      } catch (error) {
        if (error instanceof PrismaClientKnownRequestError) {
          if (error.code === "P2025") {
            return reply.status(404).send({ message: "ROM or save state not found" });
          }
        }

        throw error;
      }
    });

    instance.post(
      "/netplay/sessions/:sessionId/invite",
      async (request, reply) => {
        const paramsResult = sessionParamsSchema.safeParse(request.params);
        const bodyResult = inviteBodySchema.safeParse(request.body);

        if (!paramsResult.success || !bodyResult.success) {
          return reply.status(400).send({ message: "Invalid invite payload" });
        }

        const { sessionId } = paramsResult.data;
        const { userId } = bodyResult.data;

        if (userId === request.user.sub) {
          return reply
            .status(400)
            .send({ message: "Host is already part of the session" });
        }

        const session = await instance.prisma.netplaySession.findUnique({
          where: { id: sessionId },
          include: { participants: true },
        });

        if (!session) {
          return reply.status(404).send({ message: "Session not found" });
        }

        if (session.hostId !== request.user.sub) {
          return reply.status(403).send({ message: "Only the host can invite" });
        }

        if (isExpired(session)) {
          await instance.prisma.netplaySession.update({
            where: { id: sessionId },
            data: { status: "CLOSED", expiresAt: new Date() },
          });
          instance.netplaySignalServer
            ?.to(sessionRoomId(sessionId))
            .emit("session:closed", { sessionId, reason: "expired" });
          return reply.status(410).send({ message: "Session has expired" });
        }

        const existingParticipant = session.participants.find(
          (participant) => participant.userId === userId,
        );

        if (existingParticipant) {
          await instance.prisma.netplayParticipant.update({
            where: { sessionId_userId: { sessionId, userId } },
            data: {
              status: "INVITED",
              disconnectedAt: null,
              peerTokenHash: null,
            },
          });
        } else {
          await instance.prisma.netplayParticipant.create({
            data: {
              session: { connect: { id: sessionId } },
              user: { connect: { id: userId } },
              role: "PLAYER",
              status: "INVITED",
            },
          });
        }

        const updated = await instance.prisma.netplaySession.findUnique({
          where: { id: sessionId },
          include: { participants: true },
        });

        if (!updated) {
          return reply.status(404).send({ message: "Session not found" });
        }

        const serialized = serializeSession(updated);
        instance.netplaySignalServer
          ?.to(sessionRoomId(sessionId))
          .emit("session:update", { session: serialized });

        return reply.status(200).send({
          session: serialized,
        });
      },
    );

    instance.post(
      "/netplay/sessions/:sessionId/join",
      async (request, reply) => {
        const paramsResult = sessionParamsSchema.safeParse(request.params);
        if (!paramsResult.success) {
          return reply.status(400).send({ message: "Invalid session identifier" });
        }

        const bodyResult = joinBodySchema.safeParse(request.body ?? {});
        if (!bodyResult.success) {
          return reply.status(400).send({ message: "Invalid join payload" });
        }

        const { sessionId } = paramsResult.data;
        const session = await instance.prisma.netplaySession.findUnique({
          where: { id: sessionId },
          include: { participants: true },
        });

        if (!session) {
          return reply.status(404).send({ message: "Session not found" });
        }

        if (isExpired(session)) {
          await instance.prisma.netplaySession.update({
            where: { id: sessionId },
            data: { status: "CLOSED", expiresAt: new Date() },
          });
          instance.netplaySignalServer
            ?.to(sessionRoomId(sessionId))
            .emit("session:closed", { sessionId, reason: "expired" });
          return reply.status(410).send({ message: "Session has expired" });
        }

        const participant = session.participants.find(
          (entry) => entry.userId === request.user.sub,
        );

        if (!participant) {
          return reply.status(403).send({ message: "You are not invited" });
        }

        const token = generatePeerToken();
        const now = new Date();
        const expiresAt = new Date(now.getTime() + env.NETPLAY_IDLE_TIMEOUT_MS);

        await instance.prisma.$transaction([
          instance.prisma.netplayParticipant.update({
            where: { sessionId_userId: { sessionId, userId: request.user.sub } },
            data: {
              status: "CONNECTED",
              peerTokenHash: hashPeerToken(token),
              connectedAt: now,
              lastHeartbeatAt: now,
              disconnectedAt: null,
            },
          }),
          instance.prisma.netplaySession.update({
            where: { id: sessionId },
            data: {
              status: "ACTIVE",
              lastActivityAt: now,
              expiresAt,
            },
          }),
        ]);

        const updated = await instance.prisma.netplaySession.findUnique({
          where: { id: sessionId },
          include: { participants: true },
        });

        if (!updated) {
          return reply.status(404).send({ message: "Session not found" });
        }

        const serialized = serializeSession(updated);
        instance.netplaySignalServer
          ?.to(sessionRoomId(sessionId))
          .emit("session:update", { session: serialized });

        return reply.status(200).send({
          session: serialized,
          peerToken: token,
        });
      },
    );

    instance.post(
      "/netplay/sessions/:sessionId/heartbeat",
      async (request, reply) => {
        const paramsResult = sessionParamsSchema.safeParse(request.params);
        const bodyResult = heartbeatBodySchema.safeParse(request.body);

        if (!paramsResult.success || !bodyResult.success) {
          return reply.status(400).send({ message: "Invalid heartbeat payload" });
        }

        const { sessionId } = paramsResult.data;
        const { peerToken, status } = bodyResult.data;

        const participant = await instance.prisma.netplayParticipant.findUnique({
          where: { sessionId_userId: { sessionId, userId: request.user.sub } },
          include: { session: { include: { participants: true } } },
        });

        if (!participant) {
          return reply.status(404).send({ message: "Participant not found" });
        }

        if (isExpired(participant.session)) {
          await instance.prisma.netplaySession.update({
            where: { id: sessionId },
            data: { status: "CLOSED", expiresAt: new Date() },
          });
          instance.netplaySignalServer
            ?.to(sessionRoomId(sessionId))
            .emit("session:closed", { sessionId, reason: "expired" });
          return reply.status(410).send({ message: "Session has expired" });
        }

        if (!participant.peerTokenHash) {
          return reply.status(403).send({ message: "Join token missing" });
        }

        if (participant.peerTokenHash !== hashPeerToken(peerToken)) {
          return reply.status(403).send({ message: "Invalid peer token" });
        }

        const now = new Date();
        const expiresAt = new Date(now.getTime() + env.NETPLAY_IDLE_TIMEOUT_MS);
        const connectedPeers = participant.session.participants.filter(
          (entry) => entry.userId !== request.user.sub && entry.status === "CONNECTED",
        ).length;

        const participantUpdate: Record<string, unknown> = {
          lastHeartbeatAt: now,
        };

        if (status === "disconnected") {
          participantUpdate.status = "DISCONNECTED";
          participantUpdate.disconnectedAt = now;
        }

        if (status === "connected" && participant.status !== "CONNECTED") {
          participantUpdate.status = "CONNECTED";
          participantUpdate.disconnectedAt = null;
        }

        await instance.prisma.$transaction([
          instance.prisma.netplayParticipant.update({
            where: { sessionId_userId: { sessionId, userId: request.user.sub } },
            data: participantUpdate,
          }),
          instance.prisma.netplaySession.update({
            where: { id: sessionId },
            data: {
              lastActivityAt: now,
              expiresAt,
              status:
                status === "disconnected"
                  ? connectedPeers === 0
                    ? "OPEN"
                    : participant.session.status
                  : "ACTIVE",
            },
          }),
        ]);

        const refreshed = await instance.prisma.netplaySession.findUnique({
          where: { id: sessionId },
          include: { participants: true },
        });

        if (refreshed) {
          instance.netplaySignalServer
            ?.to(sessionRoomId(sessionId))
            .emit("session:update", { session: serializeSession(refreshed) });
        }

        return reply.status(204).send();
      },
    );

    instance.delete(
      "/netplay/sessions/:sessionId",
      async (request, reply) => {
        const paramsResult = sessionParamsSchema.safeParse(request.params);
        if (!paramsResult.success) {
          return reply.status(400).send({ message: "Invalid session identifier" });
        }

        const { sessionId } = paramsResult.data;
        const session = await instance.prisma.netplaySession.findUnique({
          where: { id: sessionId },
        });

        if (!session) {
          return reply.status(404).send({ message: "Session not found" });
        }

        if (session.hostId !== request.user.sub) {
          return reply.status(403).send({ message: "Only the host can close the session" });
        }

        await instance.prisma.$transaction([
          instance.prisma.netplayParticipant.updateMany({
            where: { sessionId },
            data: { status: "DISCONNECTED", disconnectedAt: new Date() },
          }),
          instance.prisma.netplaySession.update({
            where: { id: sessionId },
            data: { status: "CLOSED", expiresAt: new Date() },
          }),
        ]);

        instance.log.info(
          {
            event: "netplay.session.closed",
            sessionId,
            hostId: request.user.sub,
          },
          "Netplay session closed",
        );

        instance.netplaySignalServer
          ?.to(sessionRoomId(sessionId))
          .emit("session:closed", { sessionId, reason: "closed" });

        return reply.status(204).send();
      },
    );
  });
}
