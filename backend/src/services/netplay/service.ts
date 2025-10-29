import { randomInt } from "node:crypto";
import { FastifyBaseLogger } from "fastify";
import {
  NetplayParticipantRole,
  NetplaySessionStatus,
  Prisma,
  PrismaClient
} from "@prisma/client";
import { NetplayConfig } from "../../config/netplay.js";

const DEFAULT_CODE_GENERATION_ATTEMPTS = 10;

export class NetplayServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NetplayServiceError";
  }
}

export class NetplaySessionNotFoundError extends NetplayServiceError {
  constructor(message = "Netplay session not found") {
    super(message);
    this.name = "NetplaySessionNotFoundError";
  }
}

export class NetplaySessionExpiredError extends NetplayServiceError {
  constructor(message = "Netplay session has expired") {
    super(message);
    this.name = "NetplaySessionExpiredError";
  }
}

export class NetplayExternalServiceError extends NetplayServiceError {
  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = "NetplayExternalServiceError";
    if (cause !== undefined) {
      this.cause = cause;
    }
  }
}

type FetchImplementation = typeof fetch;

type NetplaySessionWithParticipants = Prisma.NetplaySessionGetPayload<{
  include: { participants: true };
}>;

type CreateSessionOptions = {
  hostUserId: string;
  romId?: string;
  ttlMs?: number;
};

type JoinSessionOptions = {
  code: string;
  userId: string;
};

type EndSessionOptions = {
  sessionId: string;
  endedById?: string;
};

type NetplayServiceDeps = {
  prisma: PrismaClient;
  logger: FastifyBaseLogger;
  config: NetplayConfig;
  fetch?: FetchImplementation;
  random?: (upperExclusive: number) => number;
};

const sanitizeBaseUrl = (value: string): string => value.replace(/\/+$/, "");

export class NetplayService {
  private readonly prisma: PrismaClient;
  private readonly logger: FastifyBaseLogger;
  private readonly config: NetplayConfig;
  private readonly fetchImpl?: FetchImplementation;
  private readonly random: (upperExclusive: number) => number;
  private readonly signalingBaseUrl?: string;
  private readonly signalingApiKey?: string;

  constructor(deps: NetplayServiceDeps) {
    this.prisma = deps.prisma;
    this.logger = deps.logger;
    this.config = deps.config;
    this.fetchImpl = deps.fetch ?? (typeof fetch === "function" ? fetch : undefined);
    this.random = deps.random ?? ((upperExclusive: number) => randomInt(upperExclusive));

    if (this.config.signaling) {
      this.signalingBaseUrl = sanitizeBaseUrl(this.config.signaling.baseUrl);
      this.signalingApiKey = this.config.signaling.apiKey;
    }
  }

  async createSession(options: CreateSessionOptions): Promise<NetplaySessionWithParticipants> {
    const ttlMs = this.resolveTtl(options.ttlMs);
    const expiresAt = new Date(Date.now() + ttlMs);
    const code = await this.generateUniqueCode();

    const session = await this.prisma.$transaction(async (tx) => {
      const created = await tx.netplaySession.create({
        data: {
          code,
          hostUserId: options.hostUserId,
          romId: options.romId,
          expiresAt
        }
      });

      await tx.netplayParticipant.create({
        data: {
          sessionId: created.id,
          userId: options.hostUserId,
          role: NetplayParticipantRole.HOST
        }
      });

      return tx.netplaySession.findUniqueOrThrow({
        where: { id: created.id },
        include: { participants: true }
      });
    });

    try {
      const externalSessionId = await this.createExternalSession(session, ttlMs);

      if (externalSessionId) {
        return await this.prisma.netplaySession.update({
          where: { id: session.id },
          data: { externalSessionId },
          include: { participants: true }
        });
      }

      return session;
    } catch (error) {
      if (error instanceof NetplayExternalServiceError) {
        this.logger.error({ err: error, sessionId: session.id }, "Failed to create external netplay session");
        await this.prisma.netplaySession.delete({ where: { id: session.id } });
      }

      throw error;
    }
  }

  async joinSession(options: JoinSessionOptions): Promise<NetplaySessionWithParticipants> {
    const session = await this.prisma.netplaySession.findUnique({
      where: { code: options.code },
      include: { participants: true }
    });

    if (!session) {
      throw new NetplaySessionNotFoundError();
    }

    await this.ensureSessionIsActive(session);

    if (session.participants.some((participant) => participant.userId === options.userId)) {
      return session;
    }

    const participant = await this.prisma.netplayParticipant.create({
      data: {
        sessionId: session.id,
        userId: options.userId,
        role: NetplayParticipantRole.GUEST
      }
    });

    try {
      await this.notifyExternalParticipantJoined(session, participant.userId, participant.role);
    } catch (error) {
      await this.prisma.netplayParticipant.delete({ where: { id: participant.id } });
      throw error;
    }

    return this.prisma.netplaySession.findUniqueOrThrow({
      where: { id: session.id },
      include: { participants: true }
    });
  }

  async listSessionsForUser(userId: string): Promise<NetplaySessionWithParticipants[]> {
    return this.prisma.netplaySession.findMany({
      where: {
        participants: {
          some: { userId }
        }
      },
      include: { participants: true },
      orderBy: { createdAt: "desc" }
    });
  }

  async getSession(sessionId: string): Promise<NetplaySessionWithParticipants | null> {
    return this.prisma.netplaySession.findUnique({
      where: { id: sessionId },
      include: { participants: true }
    });
  }

  async endSession(options: EndSessionOptions): Promise<NetplaySessionWithParticipants> {
    const session = await this.prisma.netplaySession.update({
      where: { id: options.sessionId },
      data: {
        status: NetplaySessionStatus.ENDED,
        endedAt: new Date(),
        endedById: options.endedById
      },
      include: { participants: true }
    });

    await this.notifyExternalSessionClosed(session);

    return session;
  }

  async expireStaleSessions(referenceDate = new Date()): Promise<number> {
    const staleSessions = await this.prisma.netplaySession.findMany({
      where: {
        status: NetplaySessionStatus.ACTIVE,
        expiresAt: { lte: referenceDate }
      },
      select: { id: true, externalSessionId: true }
    });

    if (staleSessions.length === 0) {
      return 0;
    }

    await this.prisma.netplaySession.updateMany({
      where: { id: { in: staleSessions.map((session) => session.id) } },
      data: {
        status: NetplaySessionStatus.EXPIRED,
        endedAt: referenceDate
      }
    });

    await Promise.all(
      staleSessions
        .filter((session) => session.externalSessionId)
        .map((session) =>
          this.notifyExternalSessionClosed({
            id: session.id,
            externalSessionId: session.externalSessionId,
            status: NetplaySessionStatus.EXPIRED
          } as NetplaySessionWithParticipants).catch((error) => {
            this.logger.warn({ err: error, sessionId: session.id }, "Failed to notify external service about expired session");
          })
        )
    );

    return staleSessions.length;
  }

  private resolveTtl(requestedTtlMs: number | undefined): number {
    if (typeof requestedTtlMs !== "number" || Number.isNaN(requestedTtlMs) || requestedTtlMs <= 0) {
      return this.config.defaultTtlMs;
    }

    if (requestedTtlMs < this.config.minTtlMs) {
      return this.config.minTtlMs;
    }

    if (requestedTtlMs > this.config.maxTtlMs) {
      return this.config.maxTtlMs;
    }

    return requestedTtlMs;
  }

  private async generateUniqueCode(): Promise<string> {
    for (let attempt = 0; attempt < DEFAULT_CODE_GENERATION_ATTEMPTS; attempt += 1) {
      const candidate = this.generateCode();
      const existing = await this.prisma.netplaySession.findUnique({
        where: { code: candidate },
        select: { id: true }
      });

      if (!existing) {
        return candidate;
      }
    }

    throw new NetplayServiceError("Failed to generate unique netplay session code");
  }

  private generateCode(): string {
    const characters = this.config.codeAlphabet;
    let code = "";

    for (let index = 0; index < this.config.codeLength; index += 1) {
      const position = this.random(characters.length);
      code += characters[position];
    }

    return code;
  }

  private async ensureSessionIsActive(session: NetplaySessionWithParticipants): Promise<void> {
    const now = new Date();

    if (session.status !== NetplaySessionStatus.ACTIVE) {
      throw new NetplaySessionExpiredError();
    }

    if (session.expiresAt <= now) {
      await this.prisma.netplaySession.update({
        where: { id: session.id },
        data: {
          status: NetplaySessionStatus.EXPIRED,
          endedAt: now
        }
      });

      throw new NetplaySessionExpiredError();
    }
  }

  private async createExternalSession(
    session: NetplaySessionWithParticipants,
    ttlMs: number
  ): Promise<string | undefined> {
    if (!this.signalingBaseUrl || !this.signalingApiKey) {
      return undefined;
    }

    const response = await this.requestSignaling("/sessions", {
      method: "POST",
      body: JSON.stringify({
        sessionId: session.id,
        code: session.code,
        ttlMs,
        expiresAt: session.expiresAt.toISOString(),
        participants: session.participants.map((participant) => ({
          userId: participant.userId,
          role: participant.role
        }))
      })
    });

    const externalSessionId = this.extractExternalSessionId(response);

    if (!externalSessionId) {
      this.logger.warn({ response }, "External netplay service did not return a session identifier");
    }

    return externalSessionId;
  }

  private async notifyExternalParticipantJoined(
    session: NetplaySessionWithParticipants,
    userId: string,
    role: NetplayParticipantRole
  ): Promise<void> {
    if (!this.signalingBaseUrl || !this.signalingApiKey || !session.externalSessionId) {
      return;
    }

    await this.requestSignaling(`/sessions/${session.externalSessionId}/participants`, {
      method: "POST",
      body: JSON.stringify({ userId, role })
    });
  }

  private async notifyExternalSessionClosed(
    session: Pick<NetplaySessionWithParticipants, "externalSessionId" | "id" | "status">
  ): Promise<void> {
    if (!this.signalingBaseUrl || !this.signalingApiKey || !session.externalSessionId) {
      return;
    }

    await this.requestSignaling(`/sessions/${session.externalSessionId}`, {
      method: "DELETE"
    });
  }

  private async requestSignaling(path: string, init: RequestInit): Promise<unknown> {
    if (!this.fetchImpl) {
      throw new NetplayExternalServiceError("Fetch implementation is not available for signaling API requests");
    }

    if (!this.signalingBaseUrl || !this.signalingApiKey) {
      throw new NetplayExternalServiceError("Signaling API configuration is incomplete");
    }

    const response = await this.fetchImpl(`${this.signalingBaseUrl}${path}`, {
      ...init,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.signalingApiKey}`,
        ...(init.headers ?? {})
      }
    });

    const text = await response.text();
    let payload: unknown;

    if (text) {
      try {
        payload = JSON.parse(text);
      } catch (error) {
        throw new NetplayExternalServiceError("Failed to parse response from signaling API", error);
      }
    }

    if (!response.ok) {
      throw new NetplayExternalServiceError(
        `Signaling API request failed with status ${response.status}`,
        payload ?? text
      );
    }

    return payload;
  }

  private extractExternalSessionId(response: unknown): string | undefined {
    if (!response || typeof response !== "object") {
      return undefined;
    }

    const candidate = (response as Record<string, unknown>).externalSessionId
      ?? (response as Record<string, unknown>).sessionId
      ?? (response as Record<string, unknown>).id;

    if (typeof candidate === "string" && candidate.trim().length > 0) {
      return candidate.trim();
    }

    return undefined;
  }
}
