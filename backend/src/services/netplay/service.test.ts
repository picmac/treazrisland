import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import type { FastifyBaseLogger } from "fastify";
import { NetplayParticipantRole, NetplaySessionStatus, Prisma, PrismaClient } from "@prisma/client";
import { NetplayConfig } from "../../config/netplay.js";
import {
  NetplayExternalServiceError,
  NetplayService
} from "./service.js";

const baseConfig: NetplayConfig = {
  defaultTtlMs: 30 * 60 * 1000,
  minTtlMs: 5 * 60 * 1000,
  maxTtlMs: 6 * 60 * 60 * 1000,
  cleanupIntervalMs: 5 * 60 * 1000,
  codeLength: 6,
  codeAlphabet: "ABCDEFGHJKLMNPQRSTUVWXYZ"
};

const createLoggerMock = (): FastifyBaseLogger => {
  const child = vi.fn();
  const logger = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    child
  };

  child.mockReturnValue(logger);

  return logger as unknown as FastifyBaseLogger;
};

const createPrismaMock = () => {
  const netplaySession = {
    findUnique: vi.fn(),
    findUniqueOrThrow: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    findMany: vi.fn(),
    updateMany: vi.fn()
  };

  const netplayParticipant = {
    create: vi.fn(),
    delete: vi.fn()
  };

  const $transaction = vi.fn(
    async <T>(callback: (tx: Prisma.TransactionClient) => Promise<T> | T): Promise<T> => {
      const tx = {
        netplaySession: {
          create: netplaySession.create,
          findUniqueOrThrow: netplaySession.findUniqueOrThrow
        },
        netplayParticipant: {
          create: netplayParticipant.create
        }
      } as unknown as Prisma.TransactionClient;

      return callback(tx);
    }
  );

  const client = {
    netplaySession,
    netplayParticipant,
    $transaction
  } as unknown as PrismaClient;

  return { client, netplaySession, netplayParticipant, $transaction };
};

describe("NetplayService", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("clamps requested TTL below minimum to the configured floor", async () => {
    const now = new Date("2024-01-01T00:00:00.000Z");
    vi.setSystemTime(now);

    const prisma = createPrismaMock();
    const logger = createLoggerMock();

    prisma.netplaySession.findUnique.mockResolvedValue(null);
    prisma.netplayParticipant.create.mockResolvedValue({
      id: "participant-1",
      sessionId: "session-1",
      userId: "host-1",
      role: NetplayParticipantRole.HOST,
      joinedAt: now,
      leftAt: null,
      createdAt: now,
      updatedAt: now,
      externalParticipantId: null
    });

    prisma.netplaySession.findUniqueOrThrow.mockResolvedValue({
      id: "session-1",
      code: "AAAAAA",
      hostUserId: "host-1",
      romId: null,
      expiresAt: new Date(now.getTime() + baseConfig.minTtlMs),
      status: NetplaySessionStatus.ACTIVE,
      externalSessionId: null,
      createdAt: now,
      updatedAt: now,
      endedAt: null,
      endedById: null,
      participants: [
        {
          id: "participant-1",
          sessionId: "session-1",
          userId: "host-1",
          role: NetplayParticipantRole.HOST,
          joinedAt: now,
          leftAt: null,
          createdAt: now,
          updatedAt: now,
          externalParticipantId: null
        }
      ]
    });

    prisma.netplaySession.create.mockImplementation(async ({ data }) => {
      expect(data.expiresAt).toEqual(new Date(now.getTime() + baseConfig.minTtlMs));
      return { ...data, id: "session-1" };
    });

    const service = new NetplayService({
      prisma: prisma.client,
      logger,
      config: baseConfig,
      random: () => 0
    });

    await service.createSession({ hostUserId: "host-1", ttlMs: 60_000 });

    expect(prisma.netplaySession.create).toHaveBeenCalledTimes(1);
  });

  it("retries join code generation when a collision is detected", async () => {
    const now = new Date("2024-01-01T01:00:00.000Z");
    vi.setSystemTime(now);

    const prisma = createPrismaMock();
    const logger = createLoggerMock();

    prisma.netplaySession.findUnique
      .mockResolvedValueOnce({ id: "existing" })
      .mockResolvedValueOnce(null);

    prisma.netplayParticipant.create.mockResolvedValue({
      id: "participant-1",
      sessionId: "session-1",
      userId: "host-1",
      role: NetplayParticipantRole.HOST,
      joinedAt: now,
      leftAt: null,
      createdAt: now,
      updatedAt: now,
      externalParticipantId: null
    });

    prisma.netplaySession.findUniqueOrThrow.mockResolvedValue({
      id: "session-1",
      code: "BBBBBB",
      hostUserId: "host-1",
      romId: null,
      expiresAt: new Date(now.getTime() + baseConfig.defaultTtlMs),
      status: NetplaySessionStatus.ACTIVE,
      externalSessionId: null,
      createdAt: now,
      updatedAt: now,
      endedAt: null,
      endedById: null,
      participants: [
        {
          id: "participant-1",
          sessionId: "session-1",
          userId: "host-1",
          role: NetplayParticipantRole.HOST,
          joinedAt: now,
          leftAt: null,
          createdAt: now,
          updatedAt: now,
          externalParticipantId: null
        }
      ]
    });

    prisma.netplaySession.create.mockImplementation(async ({ data }) => ({
      ...data,
      id: "session-1"
    }));

    const randomSequence = [
      ...Array(baseConfig.codeLength).fill(0),
      ...Array(baseConfig.codeLength).fill(1)
    ];

    const service = new NetplayService({
      prisma: prisma.client,
      logger,
      config: baseConfig,
      random: () => (randomSequence.shift() ?? 0)
    });

    await service.createSession({ hostUserId: "host-1" });

    expect(prisma.netplaySession.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ code: "BBBBBB" })
      })
    );
    expect(prisma.netplaySession.findUnique).toHaveBeenCalledTimes(2);
  });

  it("rolls back a newly created session when the external API rejects the request", async () => {
    const now = new Date("2024-01-01T02:00:00.000Z");
    vi.setSystemTime(now);

    const prisma = createPrismaMock();
    const logger = createLoggerMock();

    prisma.netplaySession.findUnique.mockResolvedValue(null);

    prisma.netplayParticipant.create.mockResolvedValue({
      id: "participant-1",
      sessionId: "session-1",
      userId: "host-1",
      role: NetplayParticipantRole.HOST,
      joinedAt: now,
      leftAt: null,
      createdAt: now,
      updatedAt: now,
      externalParticipantId: null
    });

    const sessionRecord = {
      id: "session-1",
      code: "AAAAAA",
      hostUserId: "host-1",
      romId: null,
      expiresAt: new Date(now.getTime() + baseConfig.defaultTtlMs),
      status: NetplaySessionStatus.ACTIVE,
      externalSessionId: null,
      createdAt: now,
      updatedAt: now,
      endedAt: null,
      endedById: null,
      participants: [
        {
          id: "participant-1",
          sessionId: "session-1",
          userId: "host-1",
          role: NetplayParticipantRole.HOST,
          joinedAt: now,
          leftAt: null,
          createdAt: now,
          updatedAt: now,
          externalParticipantId: null
        }
      ]
    };

    prisma.netplaySession.create.mockResolvedValue({ ...sessionRecord });
    prisma.netplaySession.findUniqueOrThrow.mockResolvedValue({ ...sessionRecord });

    const fetchMock = vi.fn(async () => ({
      ok: false,
      status: 500,
      text: async () => JSON.stringify({ error: "upstream failure" })
    })) as unknown as typeof fetch;

    const service = new NetplayService({
      prisma: prisma.client,
      logger,
      config: {
        ...baseConfig,
        signaling: {
          baseUrl: "https://signal.example.com/api",
          apiKey: "secret"
        }
      },
      random: () => 0,
      fetch: fetchMock
    });

    await expect(service.createSession({ hostUserId: "host-1" })).rejects.toBeInstanceOf(
      NetplayExternalServiceError
    );

    expect(prisma.netplaySession.delete).toHaveBeenCalledWith({ where: { id: "session-1" } });
    expect(logger.error).toHaveBeenCalled();
  });
});
