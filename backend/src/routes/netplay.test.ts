import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Role } from "@prisma/client";
import Fastify, { type FastifyInstance } from "fastify";
import rateLimit from "@fastify/rate-limit";
import { registerNetplayRoutes } from "./netplay.js";
import { NetplayService, NetplayServiceError, NetplaySession } from "../services/netplay/types.js";

const createSessionFixture = (): NetplaySession => ({
  id: "session-123",
  hostId: "user-1",
  hostDisplayName: "Host",
  joinCode: "ABC-DEF",
  gameId: "game-001",
  expiresAt: new Date("2024-01-01T01:00:00.000Z"),
  createdAt: new Date("2024-01-01T00:00:00.000Z"),
  endedAt: null,
  participants: [
    {
      id: "participant-1",
      userId: "user-1",
      displayName: "Host",
      joinedAt: new Date("2024-01-01T00:00:00.000Z")
    }
  ]
});

type NetplayServiceMock = {
  [K in keyof NetplayService]: ReturnType<typeof vi.fn>;
};

describe("netplay routes", () => {
  let app: FastifyInstance;
  let netplayService: NetplayServiceMock;
  const authenticatedUser = { sub: "user-1", role: Role.USER };

  beforeEach(async () => {
    app = Fastify({ logger: false });

    await app.register(rateLimit, {
      global: false,
      max: 100,
      timeWindow: 60_000
    });

    netplayService = {
      createSession: vi.fn(),
      joinSession: vi.fn(),
      listSessions: vi.fn(),
      getSession: vi.fn(),
      endSession: vi.fn()
    } as NetplayServiceMock;

    app.decorate("netplayService", netplayService as unknown as NetplayService);

    app.authenticate = (async (request) => {
      request.user = authenticatedUser;
    }) as any;

    await registerNetplayRoutes(app);
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  it("creates a netplay session with validated payload", async () => {
    const session = createSessionFixture();
    netplayService.createSession.mockResolvedValue(session);

    const response = await app.inject({
      method: "POST",
      url: "/netplay/sessions",
      payload: {
        ttlMinutes: 45,
        gameId: "game-001"
      }
    });

    expect(netplayService.createSession).toHaveBeenCalledWith({
      hostId: authenticatedUser.sub,
      ttlMinutes: 45,
      gameId: "game-001"
    });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toEqual({
      session: {
        id: session.id,
        hostId: session.hostId,
        hostDisplayName: session.hostDisplayName,
        joinCode: session.joinCode,
        gameId: session.gameId,
        expiresAt: session.expiresAt.toISOString(),
        createdAt: session.createdAt.toISOString(),
        endedAt: null,
        participants: [
          {
            id: session.participants[0].id,
            userId: session.participants[0].userId,
            displayName: session.participants[0].displayName,
            joinedAt: session.participants[0].joinedAt.toISOString()
          }
        ]
      }
    });
  });

  it("joins an existing session via join code", async () => {
    const session = createSessionFixture();
    const participant = {
      id: "participant-2",
      userId: authenticatedUser.sub,
      displayName: "Guest",
      joinedAt: new Date("2024-01-01T00:15:00.000Z")
    };

    netplayService.joinSession.mockResolvedValue({
      session,
      participant
    });

    const response = await app.inject({
      method: "POST",
      url: "/netplay/sessions/join",
      payload: {
        joinCode: " abc-def "
      }
    });

    expect(netplayService.joinSession).toHaveBeenCalledWith({
      joinCode: "ABC-DEF",
      playerId: authenticatedUser.sub
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      session: {
        id: session.id,
        hostId: session.hostId,
        hostDisplayName: session.hostDisplayName,
        joinCode: session.joinCode,
        gameId: session.gameId,
        expiresAt: session.expiresAt.toISOString(),
        createdAt: session.createdAt.toISOString(),
        endedAt: null,
        participants: session.participants.map((existing) => ({
          id: existing.id,
          userId: existing.userId,
          displayName: existing.displayName,
          joinedAt: existing.joinedAt.toISOString()
        }))
      },
      participant: {
        id: participant.id,
        userId: participant.userId,
        displayName: participant.displayName,
        joinedAt: participant.joinedAt.toISOString()
      }
    });
  });

  it("lists the user's sessions", async () => {
    const session = createSessionFixture();
    netplayService.listSessions.mockResolvedValue([session]);

    const response = await app.inject({
      method: "GET",
      url: "/netplay/sessions"
    });

    expect(netplayService.listSessions).toHaveBeenCalledWith({
      userId: authenticatedUser.sub
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      sessions: [
        {
          id: session.id,
          hostId: session.hostId,
          hostDisplayName: session.hostDisplayName,
          joinCode: session.joinCode,
          gameId: session.gameId,
          expiresAt: session.expiresAt.toISOString(),
          createdAt: session.createdAt.toISOString(),
          endedAt: null,
          participants: session.participants.map((existing) => ({
            id: existing.id,
            userId: existing.userId,
            displayName: existing.displayName,
            joinedAt: existing.joinedAt.toISOString()
          }))
        }
      ]
    });
  });

  it("retrieves a single session by id", async () => {
    const session = createSessionFixture();
    netplayService.getSession.mockResolvedValue(session);

    const response = await app.inject({
      method: "GET",
      url: `/netplay/sessions/${session.id}`
    });

    expect(netplayService.getSession).toHaveBeenCalledWith({
      sessionId: session.id
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      session: {
        id: session.id,
        hostId: session.hostId,
        hostDisplayName: session.hostDisplayName,
        joinCode: session.joinCode,
        gameId: session.gameId,
        expiresAt: session.expiresAt.toISOString(),
        createdAt: session.createdAt.toISOString(),
        endedAt: null,
        participants: session.participants.map((existing) => ({
          id: existing.id,
          userId: existing.userId,
          displayName: existing.displayName,
          joinedAt: existing.joinedAt.toISOString()
        }))
      }
    });
  });

  it("returns 204 after ending a session", async () => {
    netplayService.endSession.mockResolvedValue(undefined);

    const response = await app.inject({
      method: "DELETE",
      url: "/netplay/sessions/session-123"
    });

    expect(netplayService.endSession).toHaveBeenCalledWith({
      sessionId: "session-123",
      requestedBy: authenticatedUser.sub
    });

    expect(response.statusCode).toBe(204);
  });

  it("rejects TTL values outside the allowed range", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/netplay/sessions",
      payload: {
        ttlMinutes: 4
      }
    });

    expect(response.statusCode).toBe(400);
    expect(netplayService.createSession).not.toHaveBeenCalled();
  });

  it("prevents non-host users from ending sessions", async () => {
    netplayService.endSession.mockRejectedValue(
      new NetplayServiceError("NOT_HOST", "Only the host can end the session", 403)
    );

    const response = await app.inject({
      method: "DELETE",
      url: "/netplay/sessions/session-123"
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({
      message: "Only the host can end the session",
      code: "NOT_HOST",
      details: undefined
    });
  });

  it("prevents duplicate joins", async () => {
    netplayService.joinSession.mockRejectedValue(
      new NetplayServiceError("DUPLICATE_JOIN", "You are already part of this session", 409)
    );

    const response = await app.inject({
      method: "POST",
      url: "/netplay/sessions/join",
      payload: {
        joinCode: "ABC-DEF"
      }
    });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual({
      message: "You are already part of this session",
      code: "DUPLICATE_JOIN",
      details: undefined
    });
  });

  it("returns 410 when attempting to join an expired session", async () => {
    netplayService.joinSession.mockRejectedValue(
      new NetplayServiceError("SESSION_EXPIRED", "This session has already expired", 410)
    );

    const response = await app.inject({
      method: "POST",
      url: "/netplay/sessions/join",
      payload: {
        joinCode: "ABC-DEF"
      }
    });

    expect(response.statusCode).toBe(410);
    expect(response.json()).toEqual({
      message: "This session has already expired",
      code: "SESSION_EXPIRED",
      details: undefined
    });
  });
});
