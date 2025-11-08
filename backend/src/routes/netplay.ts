import { randomBytes, createHash } from "node:crypto";
import type { FastifyInstance } from "fastify";
import type { NetplaySessionStatus } from "@prisma/client";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/library";
import { z } from "zod";
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

export async function registerNetplayRoutes(app: FastifyInstance) {
  app.register(async (instance) => {
    instance.addHook("preHandler", instance.authenticate);

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

        return reply.status(200).send({
          session: serializeSession(updated!),
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

        return reply.status(200).send({
          session: serializeSession(updated!),
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

        return reply.status(204).send();
      },
    );
  });
}
