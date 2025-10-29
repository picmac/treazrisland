import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { FastifyInstance } from "fastify";
import {
  NetplayServiceError,
  type NetplayService,
  type NetplaySession
} from "../services/netplay/types.js";

process.env.NODE_ENV = "test";
process.env.PORT = process.env.PORT ?? "0";
process.env.JWT_SECRET = process.env.JWT_SECRET ?? "this-is-a-test-secret-at-least-32";
process.env.JWT_ACCESS_TTL = process.env.JWT_ACCESS_TTL ?? "15m";
process.env.JWT_REFRESH_TTL = process.env.JWT_REFRESH_TTL ?? "30d";
process.env.USER_INVITE_EXPIRY_HOURS = process.env.USER_INVITE_EXPIRY_HOURS ?? "24";
process.env.STORAGE_DRIVER = process.env.STORAGE_DRIVER ?? "filesystem";
process.env.STORAGE_BUCKET_ASSETS = process.env.STORAGE_BUCKET_ASSETS ?? "assets";
process.env.STORAGE_BUCKET_ROMS = process.env.STORAGE_BUCKET_ROMS ?? "roms";
process.env.STORAGE_BUCKET_BIOS = process.env.STORAGE_BUCKET_BIOS ?? "bios";
process.env.ROM_UPLOAD_MAX_BYTES = process.env.ROM_UPLOAD_MAX_BYTES ?? `${1024 * 1024}`;

let buildServer: typeof import("../server.js").buildServer;

beforeAll(async () => {
  ({ buildServer } = await import("../server.js"));
});

type NetplayServiceMock = {
  [K in keyof NetplayService]: ReturnType<typeof vi.fn>;
};

describe("netplay routes", () => {
  let app: FastifyInstance;
  let netplayService: NetplayServiceMock;

  const baseDate = new Date("2025-01-01T00:00:00.000Z");

  const makeSession = (overrides: Partial<NetplaySession> = {}): NetplaySession => ({
    id: "session-1",
    hostUserId: "host-user",
    romId: "rom-1",
    joinCode: "ABCDEF",
    status: "ACTIVE",
    createdAt: baseDate,
    updatedAt: baseDate,
    expiresAt: new Date(baseDate.getTime() + 60 * 60 * 1000),
    externalSessionId: "ext-1",
    participants: [
      {
        id: "participant-1",
        sessionId: "session-1",
        userId: "host-user",
        role: "HOST",
        nickname: "captain",
        displayName: "Captain",
        joinedAt: baseDate
      },
      {
        id: "participant-2",
        sessionId: "session-1",
        userId: "guest-user",
        role: "GUEST",
        nickname: "deckhand",
        displayName: "Deckhand",
        joinedAt: baseDate
      }
    ],
    ...overrides
  });

  const authHeader = (sub = "host-user", role: "ADMIN" | "USER" = "USER") => ({
    authorization: `Bearer ${app.jwt.sign({ sub, role })}`
  });

  beforeEach(async () => {
    app = buildServer({ registerPrisma: false });
    netplayService = {
      createSession: vi.fn(),
      joinSession: vi.fn(),
      listSessionsForUser: vi.fn(),
      getSessionById: vi.fn(),
      deleteSession: vi.fn()
    } as NetplayServiceMock;

    app.decorate("netplayService", netplayService as unknown as NetplayService);
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    vi.clearAllMocks();
  });

  it("requires authentication to create sessions", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/netplay/sessions",
      payload: { ttlMinutes: 30 }
    });

    expect(response.statusCode).toBe(401);
  });

  it("creates a session for the authenticated host", async () => {
    const session = makeSession();
    netplayService.createSession.mockResolvedValueOnce(session);

    const response = await app.inject({
      method: "POST",
      url: "/netplay/sessions",
      headers: authHeader(),
      payload: {
        romId: "rom-1",
        ttlMinutes: 45
      }
    });

    expect(response.statusCode).toBe(201);
    const body = await response.json();
    expect(body.session).toMatchObject({
      id: session.id,
      hostUserId: session.hostUserId,
      romId: session.romId,
      joinCode: session.joinCode,
      status: session.status
    });

    expect(netplayService.createSession).toHaveBeenCalledWith({
      hostUserId: "host-user",
      romId: "rom-1",
      ttlMinutes: 45
    });
  });

  it("applies default TTL when not provided", async () => {
    netplayService.createSession.mockResolvedValueOnce(makeSession());

    const response = await app.inject({
      method: "POST",
      url: "/netplay/sessions",
      headers: authHeader(),
      payload: {}
    });

    expect(response.statusCode).toBe(201);
    expect(netplayService.createSession).toHaveBeenCalledWith({
      hostUserId: "host-user",
      romId: null,
      ttlMinutes: 60
    });
  });

  it("rejects invalid TTL values", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/netplay/sessions",
      headers: authHeader(),
      payload: { ttlMinutes: 3 }
    });

    expect(response.statusCode).toBe(400);
  });

  it("handles service errors during session creation", async () => {
    netplayService.createSession.mockRejectedValueOnce(
      new NetplayServiceError("Maximum active sessions reached", "MAX_ACTIVE_SESSIONS")
    );

    const response = await app.inject({
      method: "POST",
      url: "/netplay/sessions",
      headers: authHeader(),
      payload: { ttlMinutes: 30 }
    });

    expect(response.statusCode).toBe(409);
    const body = await response.json();
    expect(body.message).toContain("Maximum active sessions");
  });

  it("joins an existing session with normalized join code", async () => {
    netplayService.joinSession.mockResolvedValueOnce(makeSession());

    const response = await app.inject({
      method: "POST",
      url: "/netplay/sessions/join",
      headers: authHeader("guest-user"),
      payload: { joinCode: " abcd23 " }
    });

    expect(response.statusCode).toBe(200);
    expect(netplayService.joinSession).toHaveBeenCalledWith({
      userId: "guest-user",
      joinCode: "ABCD23"
    });
  });

  it("rejects invalid join codes", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/netplay/sessions/join",
      headers: authHeader(),
      payload: { joinCode: "invalid" }
    });

    expect(response.statusCode).toBe(400);
  });

  it("maps service errors while joining", async () => {
    netplayService.joinSession.mockRejectedValueOnce(
      new NetplayServiceError("Session has already ended", "SESSION_CLOSED")
    );

    const response = await app.inject({
      method: "POST",
      url: "/netplay/sessions/join",
      headers: authHeader("guest-user"),
      payload: { joinCode: "ABCDEF" }
    });

    expect(response.statusCode).toBe(409);
  });

  it("lists sessions for the authenticated user", async () => {
    netplayService.listSessionsForUser.mockResolvedValueOnce([
      makeSession(),
      makeSession({ id: "session-2", joinCode: "GHIJKL" })
    ]);

    const response = await app.inject({
      method: "GET",
      url: "/netplay/sessions",
      headers: authHeader()
    });

    expect(response.statusCode).toBe(200);
    const body = await response.json();
    expect(body.sessions).toHaveLength(2);
    expect(netplayService.listSessionsForUser).toHaveBeenCalledWith("host-user");
  });

  it("fetches a specific session when user participates", async () => {
    netplayService.getSessionById.mockResolvedValueOnce(makeSession());

    const response = await app.inject({
      method: "GET",
      url: "/netplay/sessions/session-1",
      headers: authHeader()
    });

    expect(response.statusCode).toBe(200);
    const body = await response.json();
    expect(body.session.id).toBe("session-1");
  });

  it("returns 404 when session is missing", async () => {
    netplayService.getSessionById.mockResolvedValueOnce(null);

    const response = await app.inject({
      method: "GET",
      url: "/netplay/sessions/session-unknown",
      headers: authHeader()
    });

    expect(response.statusCode).toBe(404);
  });

  it("rejects access to sessions the user is not part of", async () => {
    netplayService.getSessionById.mockResolvedValueOnce(
      makeSession({
        participants: [
          {
            id: "participant-1",
            sessionId: "session-1",
            userId: "someone-else",
            role: "HOST",
            nickname: "other",
            displayName: "Other",
            joinedAt: baseDate
          }
        ]
      })
    );

    const response = await app.inject({
      method: "GET",
      url: "/netplay/sessions/session-1",
      headers: authHeader("stranger")
    });

    expect(response.statusCode).toBe(403);
  });

  it("allows the host to end a session", async () => {
    netplayService.getSessionById.mockResolvedValueOnce(makeSession());
    netplayService.deleteSession.mockResolvedValueOnce(undefined);

    const response = await app.inject({
      method: "DELETE",
      url: "/netplay/sessions/session-1",
      headers: authHeader()
    });

    expect(response.statusCode).toBe(204);
    expect(netplayService.deleteSession).toHaveBeenCalledWith({
      sessionId: "session-1",
      requestingUserId: "host-user"
    });
  });

  it("prevents non-host users from ending sessions", async () => {
    netplayService.getSessionById.mockResolvedValueOnce(makeSession());

    const response = await app.inject({
      method: "DELETE",
      url: "/netplay/sessions/session-1",
      headers: authHeader("guest-user")
    });

    expect(response.statusCode).toBe(403);
    expect(netplayService.deleteSession).not.toHaveBeenCalled();
  });

  it("maps errors while ending sessions", async () => {
    netplayService.getSessionById.mockResolvedValueOnce(makeSession());
    netplayService.deleteSession.mockRejectedValueOnce(
      new NetplayServiceError("Session already closed", "SESSION_CLOSED")
    );

    const response = await app.inject({
      method: "DELETE",
      url: "/netplay/sessions/session-1",
      headers: authHeader()
    });

    expect(response.statusCode).toBe(409);
  });
});
