import { beforeEach, describe, expect, it, vi } from "vitest";
import { NetplayService } from "./service.js";
import type {
  NetplayConfig,
  NetplayPrismaClient,
  NetplaySessionRecord,
  NetplaySignalingClient
} from "./service.js";

const baseConfig: NetplayConfig = {
  baseUrl: "https://netplay.example.com",
  apiKey: "test-key",
  ttl: { minMinutes: 5, maxMinutes: 360, defaultMinutes: 60 },
  cleanupCadenceMs: 60_000,
  codeLength: 4,
  codeAlphabet: "ABCD"
};

const logger = {
  error: vi.fn()
} as unknown as import("fastify").FastifyBaseLogger;

const createPrismaMock = () => {
  const netplaySession = {
    findUnique: vi.fn<NetplayPrismaClient["netplaySession"]["findUnique"]>(),
    findMany: vi.fn<NetplayPrismaClient["netplaySession"]["findMany"]>(),
    create: vi.fn<NetplayPrismaClient["netplaySession"]["create"]>(),
    update: vi.fn<NetplayPrismaClient["netplaySession"]["update"]>(),
    updateMany: vi.fn<NetplayPrismaClient["netplaySession"]["updateMany"]>()
  };

  const netplayParticipant = {
    create: vi.fn<NetplayPrismaClient["netplayParticipant"]["create"]>(),
    findFirst: vi.fn<NetplayPrismaClient["netplayParticipant"]["findFirst"]>(),
    findMany: vi.fn<NetplayPrismaClient["netplayParticipant"]["findMany"]>(),
    update: vi.fn<NetplayPrismaClient["netplayParticipant"]["update"]>(),
    updateMany: vi.fn<NetplayPrismaClient["netplayParticipant"]["updateMany"]>()
  };

  const transactionClient = { netplaySession, netplayParticipant };

  const prisma: NetplayPrismaClient = {
    netplaySession,
    netplayParticipant,
    $transaction: vi.fn(async (fn) => fn(transactionClient))
  };

  return prisma;
};

describe("NetplayService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("generates a unique join code and creates the session with host participant", async () => {
    const now = new Date("2024-01-01T00:00:00Z");
    const prisma = createPrismaMock();

    const existingSession: NetplaySessionRecord = {
      id: "existing",
      code: "AAAA",
      hostUserId: "other",
      romId: null,
      status: "ACTIVE",
      externalSessionId: "ext-existing",
      expiresAt: new Date(now.getTime() + 10_000),
      createdAt: now,
      updatedAt: now,
      participants: []
    };

    const finalSession: NetplaySessionRecord = {
      id: "session-123",
      code: "BCDA",
      hostUserId: "host-1",
      romId: "rom-9",
      status: "ACTIVE",
      externalSessionId: "ext-1",
      expiresAt: new Date(now.getTime() + 30 * 60_000),
      createdAt: now,
      updatedAt: now,
      participants: [
        {
          id: "participant-1",
          sessionId: "session-123",
          userId: "host-1",
          role: "HOST",
          joinedAt: now,
          leftAt: null,
          createdAt: now,
          updatedAt: now
        }
      ]
    };

    prisma.netplaySession.findUnique.mockImplementation(async (args) => {
      if (args.where.code === "AAAA") {
        return existingSession;
      }
      if (args.where.id === finalSession.id) {
        return finalSession;
      }
      return null;
    });

    prisma.netplaySession.create.mockResolvedValue({
      ...finalSession,
      participants: undefined
    });

    prisma.netplayParticipant.create.mockResolvedValue(finalSession.participants![0]!);

    const signalingClient: NetplaySignalingClient = {
      createSession: vi.fn().mockResolvedValue({ externalSessionId: "ext-1" }),
      joinSession: vi.fn(),
      endSession: vi.fn()
    };

    const randomSequence = [0, 0, 0, 0, 0.25, 0.5, 0.75, 0.1];
    const random = vi.fn(() => randomSequence.shift() ?? 0);

    const service = new NetplayService({
      prisma,
      logger,
      config: baseConfig,
      signalingClient,
      clock: () => now,
      random
    });

    const result = await service.createSession({
      hostUserId: "host-1",
      romId: "rom-9",
      ttlMinutes: 30
    });

    expect(result).toEqual(finalSession);
    expect(prisma.netplaySession.create).toHaveBeenCalledTimes(1);

    const createArgs = prisma.netplaySession.create.mock.calls[0]![0]!.data;
    expect(createArgs.code).toBe(finalSession.code);
    expect(createArgs.hostUserId).toBe("host-1");
    expect(createArgs.romId).toBe("rom-9");
    expect(createArgs.expiresAt.toISOString()).toBe(finalSession.expiresAt.toISOString());

    expect(prisma.netplayParticipant.create).toHaveBeenCalledTimes(1);
    const participantArgs = prisma.netplayParticipant.create.mock.calls[0]![0]!.data;
    expect(participantArgs.role).toBe("HOST");
    expect(participantArgs.joinedAt).toEqual(now);

    expect(signalingClient.createSession).toHaveBeenCalledWith({
      code: finalSession.code,
      hostUserId: "host-1",
      romId: "rom-9",
      expiresAt: finalSession.expiresAt
    });

    // random should have been consumed for two attempts (collision + final)
    expect(random).toHaveBeenCalledTimes(baseConfig.codeLength * 2);
  });

  it("enforces TTL bounds when creating sessions", async () => {
    const prisma = createPrismaMock();
    const signalingClient: NetplaySignalingClient = {
      createSession: vi.fn(),
      joinSession: vi.fn(),
      endSession: vi.fn()
    };

    const service = new NetplayService({
      prisma,
      logger,
      config: baseConfig,
      signalingClient
    });

    await expect(
      service.createSession({ hostUserId: "host", ttlMinutes: 1 })
    ).rejects.toThrow(/TTL must be between/);

    expect(signalingClient.createSession).not.toHaveBeenCalled();
    expect(prisma.netplaySession.create).not.toHaveBeenCalled();
  });

  it("logs and surfaces errors when signaling session creation fails", async () => {
    const prisma = createPrismaMock();
    const signalingClient: NetplaySignalingClient = {
      createSession: vi.fn().mockRejectedValue(new Error("network error")),
      joinSession: vi.fn(),
      endSession: vi.fn()
    };

    const service = new NetplayService({
      prisma,
      logger,
      config: baseConfig,
      signalingClient
    });

    await expect(
      service.createSession({ hostUserId: "host-1" })
    ).rejects.toThrow("Failed to create netplay session");

    expect(logger.error).toHaveBeenCalled();
    expect(prisma.netplaySession.create).not.toHaveBeenCalled();
  });
});
