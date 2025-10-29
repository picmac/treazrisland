import { FastifyBaseLogger } from "fastify";
import { NetplayConfig } from "../../config/netplay.js";

export type NetplaySessionStatus = "ACTIVE" | "ENDED" | "EXPIRED";
export type NetplayParticipantRole = "HOST" | "GUEST";

export type NetplayParticipantRecord = {
  id: string;
  sessionId: string;
  userId: string;
  role: NetplayParticipantRole;
  joinedAt: Date;
  leftAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type NetplaySessionRecord = {
  id: string;
  code: string;
  hostUserId: string;
  romId: string | null;
  status: NetplaySessionStatus;
  externalSessionId: string | null;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
  participants?: NetplayParticipantRecord[];
};

type NetplaySessionInclude = {
  participants?: boolean;
};

type NetplaySessionCreateData = {
  code: string;
  hostUserId: string;
  romId?: string | null;
  status: NetplaySessionStatus;
  externalSessionId: string | null;
  expiresAt: Date;
};

type NetplayParticipantCreateData = {
  sessionId: string;
  userId: string;
  role: NetplayParticipantRole;
  joinedAt: Date;
  leftAt: Date | null;
};

type NetplaySessionDelegate = {
  findUnique(args: {
    where: { id?: string; code?: string };
    include?: NetplaySessionInclude;
  }): Promise<NetplaySessionRecord | null>;
  findMany(args: {
    where?: Record<string, unknown>;
    include?: NetplaySessionInclude;
    orderBy?: Record<string, "asc" | "desc">;
  }): Promise<NetplaySessionRecord[]>;
  create(args: { data: NetplaySessionCreateData }): Promise<NetplaySessionRecord>;
  update(args: {
    where: { id: string };
    data: Partial<NetplaySessionCreateData>;
  }): Promise<NetplaySessionRecord>;
  updateMany(args: {
    where?: Record<string, unknown>;
    data: Partial<NetplaySessionCreateData>;
  }): Promise<{ count: number }>;
};

type NetplayParticipantDelegate = {
  create(args: { data: NetplayParticipantCreateData }): Promise<NetplayParticipantRecord>;
  findFirst(args: {
    where?: Record<string, unknown>;
  }): Promise<NetplayParticipantRecord | null>;
  findMany(args: {
    where?: Record<string, unknown>;
  }): Promise<NetplayParticipantRecord[]>;
  update(args: {
    where: { id: string };
    data: Partial<NetplayParticipantCreateData>;
  }): Promise<NetplayParticipantRecord>;
  updateMany(args: {
    where?: Record<string, unknown>;
    data: Partial<NetplayParticipantCreateData>;
  }): Promise<{ count: number }>;
};

type NetplayTransactionClient = {
  netplaySession: NetplaySessionDelegate;
  netplayParticipant: NetplayParticipantDelegate;
};

export type NetplayPrismaClient = NetplayTransactionClient & {
  $transaction<T>(fn: (tx: NetplayTransactionClient) => Promise<T>): Promise<T>;
};

export type CreateNetplaySessionInput = {
  hostUserId: string;
  romId?: string | null;
  ttlMinutes?: number;
};

export type JoinNetplaySessionInput = {
  userId: string;
  code: string;
};

export type ListSessionsInput = {
  userId: string;
  includeExpired?: boolean;
};

export type EndSessionInput = {
  sessionId: string;
  requestedByUserId: string;
};

export type NetplaySignalingClient = {
  createSession(input: {
    code: string;
    hostUserId: string;
    romId: string | null;
    expiresAt: Date;
  }): Promise<{ externalSessionId: string | null }>;
  joinSession(input: {
    externalSessionId: string | null;
    userId: string;
  }): Promise<void>;
  endSession(input: { externalSessionId: string | null }): Promise<void>;
};

type FetchImplementation = typeof fetch;

export class HttpNetplaySignalingClient implements NetplaySignalingClient {
  private readonly fetchImpl: FetchImplementation;

  constructor(
    private readonly options: {
      baseUrl: string;
      apiKey: string;
      fetchImpl?: FetchImplementation;
    }
  ) {
    this.fetchImpl = options.fetchImpl ?? (globalThis.fetch as FetchImplementation);
    if (typeof this.fetchImpl !== "function") {
      throw new Error("Fetch implementation is required for HttpNetplaySignalingClient");
    }
  }

  async createSession(input: {
    code: string;
    hostUserId: string;
    romId: string | null;
    expiresAt: Date;
  }): Promise<{ externalSessionId: string | null }> {
    const response = await this.request("/sessions", {
      method: "POST",
      body: JSON.stringify({
        code: input.code,
        hostUserId: input.hostUserId,
        romId: input.romId,
        expiresAt: input.expiresAt.toISOString()
      })
    });

    const sessionId = this.extractSessionId(response);
    return { externalSessionId: sessionId };
  }

  async joinSession(input: { externalSessionId: string | null; userId: string }): Promise<void> {
    if (!input.externalSessionId) {
      return;
    }

    await this.request(`/sessions/${encodeURIComponent(input.externalSessionId)}/participants`, {
      method: "POST",
      body: JSON.stringify({ userId: input.userId })
    });
  }

  async endSession(input: { externalSessionId: string | null }): Promise<void> {
    if (!input.externalSessionId) {
      return;
    }

    await this.request(`/sessions/${encodeURIComponent(input.externalSessionId)}/end`, {
      method: "POST"
    });
  }

  private async request(path: string, init: RequestInit): Promise<unknown> {
    const url = new URL(path, this.options.baseUrl);
    const headers = new Headers(init.headers);
    headers.set("content-type", "application/json");
    headers.set("authorization", `Bearer ${this.options.apiKey}`);

    const response = await this.fetchImpl(url, { ...init, headers });

    if (!response.ok) {
      const message = await this.tryReadErrorMessage(response);
      throw new Error(
        `Netplay signaling request failed with status ${response.status}${message ? `: ${message}` : ""}`
      );
    }

    if (response.status === 204) {
      return undefined;
    }

    const text = await response.text();
    if (!text) {
      return undefined;
    }

    try {
      return JSON.parse(text);
    } catch (error) {
      throw new Error("Failed to parse netplay signaling response");
    }
  }

  private async tryReadErrorMessage(response: Response): Promise<string | undefined> {
    try {
      const text = await response.text();
      return text?.trim() ?? undefined;
    } catch {
      return undefined;
    }
  }

  private extractSessionId(payload: unknown): string | null {
    if (payload && typeof payload === "object") {
      const value = (payload as Record<string, unknown>).id ?? (payload as Record<string, unknown>).sessionId;
      if (typeof value === "string" && value.trim().length > 0) {
        return value;
      }
    }

    return null;
  }
}

type NetplayServiceDependencies = {
  prisma: NetplayPrismaClient;
  logger: FastifyBaseLogger;
  config: NetplayConfig;
  signalingClient: NetplaySignalingClient;
  clock?: () => Date;
  random?: () => number;
};

export class NetplayService {
  private readonly clock: () => Date;
  private readonly random: () => number;

  constructor(private readonly deps: NetplayServiceDependencies) {
    this.clock = deps.clock ?? (() => new Date());
    this.random = deps.random ?? Math.random;
  }

  async createSession(input: CreateNetplaySessionInput): Promise<NetplaySessionRecord> {
    const ttlMinutes = this.normalizeTtl(input.ttlMinutes);
    const now = this.clock();
    const expiresAt = new Date(now.getTime() + ttlMinutes * 60_000);
    const code = await this.generateUniqueJoinCode();

    let externalSessionId: string | null = null;
    try {
      const response = await this.deps.signalingClient.createSession({
        code,
        hostUserId: input.hostUserId,
        romId: input.romId ?? null,
        expiresAt
      });
      externalSessionId = response.externalSessionId;
    } catch (error) {
      this.deps.logger.error(
        { err: error, hostUserId: input.hostUserId, romId: input.romId },
        "Failed to create external netplay session"
      );
      throw new Error("Failed to create netplay session");
    }

    const created = await this.deps.prisma.$transaction(async (tx) => {
      const session = await tx.netplaySession.create({
        data: {
          code,
          hostUserId: input.hostUserId,
          romId: input.romId ?? null,
          status: "ACTIVE",
          externalSessionId,
          expiresAt
        }
      });

      await tx.netplayParticipant.create({
        data: {
          sessionId: session.id,
          userId: input.hostUserId,
          role: "HOST",
          joinedAt: now,
          leftAt: null
        }
      });

      return session;
    });

    return this.loadSession(created.id);
  }

  async joinSession(input: JoinNetplaySessionInput): Promise<NetplaySessionRecord> {
    const session = await this.deps.prisma.netplaySession.findUnique({
      where: { code: input.code },
      include: { participants: true }
    });

    if (!session) {
      throw new Error("Session not found");
    }

    const now = this.clock();
    if (this.isExpired(session, now)) {
      await this.expireSession(session.id, now, session.externalSessionId);
      throw new Error("Session has expired");
    }

    if (session.status !== "ACTIVE") {
      throw new Error("Session is not active");
    }

    const existingParticipant = (session.participants ?? []).find(
      (participant) => participant.userId === input.userId
    );

    await this.deps.prisma.$transaction(async (tx) => {
      if (existingParticipant) {
        await tx.netplayParticipant.update({
          where: { id: existingParticipant.id },
          data: { leftAt: null, joinedAt: now }
        });
      } else {
        await tx.netplayParticipant.create({
          data: {
            sessionId: session.id,
            userId: input.userId,
            role: "GUEST",
            joinedAt: now,
            leftAt: null
          }
        });
      }
    });

    try {
      await this.deps.signalingClient.joinSession({
        externalSessionId: session.externalSessionId,
        userId: input.userId
      });
    } catch (error) {
      this.deps.logger.error(
        { err: error, sessionId: session.id, userId: input.userId },
        "Failed to notify signaling service about joined participant"
      );
      throw new Error("Failed to join netplay session");
    }

    return this.loadSession(session.id);
  }

  async listSessionsForUser(input: ListSessionsInput): Promise<NetplaySessionRecord[]> {
    const where: Record<string, unknown> = {
      participants: { some: { userId: input.userId } }
    };

    if (!input.includeExpired) {
      where.status = { in: ["ACTIVE"] };
    }

    const sessions = await this.deps.prisma.netplaySession.findMany({
      where,
      include: { participants: true },
      orderBy: { createdAt: "desc" }
    });

    return sessions.map((session) => ({
      ...session,
      participants: session.participants ?? []
    }));
  }

  async getSession(sessionId: string): Promise<NetplaySessionRecord> {
    return this.loadSession(sessionId);
  }

  async endSession(input: EndSessionInput): Promise<NetplaySessionRecord> {
    const session = await this.loadSession(input.sessionId);

    if (session.hostUserId !== input.requestedByUserId) {
      throw new Error("Only the host can end the session");
    }

    if (session.status !== "ACTIVE") {
      return session;
    }

    const now = this.clock();

    const updated = await this.deps.prisma.$transaction(async (tx) => {
      await tx.netplayParticipant.updateMany({
        where: { sessionId: session.id, leftAt: null },
        data: { leftAt: now }
      });

      return tx.netplaySession.update({
        where: { id: session.id },
        data: { status: "ENDED" }
      });
    });

    try {
      await this.deps.signalingClient.endSession({ externalSessionId: session.externalSessionId });
    } catch (error) {
      this.deps.logger.error(
        { err: error, sessionId: session.id },
        "Failed to terminate external netplay session"
      );
    }

    return this.loadSession(updated.id);
  }

  async expireStaleSessions(now = this.clock()): Promise<number> {
    const staleSessions = await this.deps.prisma.netplaySession.findMany({
      where: {
        status: "ACTIVE",
        expiresAt: { lte: now }
      },
      include: { participants: true }
    });

    if (staleSessions.length === 0) {
      return 0;
    }

    await Promise.all(
      staleSessions.map(async (session) => {
        await this.expireSession(session.id, now, session.externalSessionId);
      })
    );

    return staleSessions.length;
  }

  private async expireSession(
    sessionId: string,
    expiredAt: Date,
    externalSessionId: string | null
  ): Promise<void> {
    await this.deps.prisma.$transaction(async (tx) => {
      await tx.netplayParticipant.updateMany({
        where: { sessionId, leftAt: null },
        data: { leftAt: expiredAt }
      });

      await tx.netplaySession.update({
        where: { id: sessionId },
        data: { status: "EXPIRED" }
      });
    });

    try {
      await this.deps.signalingClient.endSession({ externalSessionId });
    } catch (error) {
      this.deps.logger.error(
        { err: error, sessionId },
        "Failed to terminate expired netplay session"
      );
    }
  }

  private async loadSession(sessionId: string): Promise<NetplaySessionRecord> {
    const session = await this.deps.prisma.netplaySession.findUnique({
      where: { id: sessionId },
      include: { participants: true }
    });

    if (!session) {
      throw new Error("Session not found");
    }

    return {
      ...session,
      participants: session.participants ?? []
    };
  }

  private async generateUniqueJoinCode(): Promise<string> {
    const maxAttempts = 10;

    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      const code = this.generateJoinCode();
      const existing = await this.deps.prisma.netplaySession.findUnique({ where: { code } });
      if (!existing) {
        return code;
      }
    }

    throw new Error("Unable to allocate a unique join code");
  }

  private generateJoinCode(): string {
    const { codeAlphabet, codeLength } = this.deps.config;
    if (codeAlphabet.length === 0) {
      throw new Error("Netplay code alphabet cannot be empty");
    }

    let result = "";
    for (let index = 0; index < codeLength; index += 1) {
      const choice = Math.floor(this.random() * codeAlphabet.length);
      result += codeAlphabet.charAt(choice);
    }

    return result;
  }

  private normalizeTtl(requested?: number): number {
    if (requested !== undefined && (!Number.isFinite(requested) || requested <= 0)) {
      throw new Error("TTL must be a positive number of minutes");
    }

    const { minMinutes, maxMinutes, defaultMinutes } = this.deps.config.ttl;
    const effective = requested ?? defaultMinutes;

    if (effective < minMinutes || effective > maxMinutes) {
      throw new Error(
        `TTL must be between ${minMinutes} and ${maxMinutes} minutes`
      );
    }

    return Math.round(effective);
  }

  private isExpired(session: NetplaySessionRecord, reference: Date): boolean {
    return session.expiresAt.getTime() <= reference.getTime();
  }
}
