import { createHash } from "node:crypto";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import type { FastifyInstance } from "fastify";
import { io as createSocketClient } from "socket.io-client";

process.env.NODE_ENV = "test";
process.env.PORT = "0";
process.env.JWT_SECRET = "this-is-a-test-secret-at-least-32";
process.env.JWT_ACCESS_TTL = "15m";
process.env.JWT_REFRESH_TTL = "30d";
process.env.PASSWORD_RESET_TTL = "1h";
process.env.USER_INVITE_EXPIRY_HOURS = "24";
process.env.STORAGE_DRIVER = "filesystem";
process.env.STORAGE_BUCKET_ASSETS = "assets";
process.env.STORAGE_BUCKET_ROMS = "roms";
process.env.STORAGE_BUCKET_BIOS = "bios";
process.env.ROM_UPLOAD_MAX_BYTES = `${1024 * 1024}`;
process.env.EMAIL_PROVIDER = "smtp";
process.env.SMTP_HOST = "smtp.test";
process.env.SMTP_PORT = "1025";
process.env.SMTP_SECURE = "none";
process.env.SMTP_FROM_EMAIL = "no-reply@example.com";
process.env.SMTP_FROM_NAME = "TREAZ";
process.env.NETPLAY_SIGNAL_ALLOWED_ORIGINS = "https://trusted.example";
process.env.TREAZ_TLS_MODE = "http";

let buildServer: typeof import("../server.js").buildServer;
let registerNetplayRoutes: typeof import("./netplay.js").registerNetplayRoutes;

type PrismaMock = {
  netplaySession: {
    count: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  netplayParticipant: {
    findUnique: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    updateMany: ReturnType<typeof vi.fn>;
  };
  netplaySignalMessage: {
    create: ReturnType<typeof vi.fn>;
  };
  $transaction: ReturnType<typeof vi.fn>;
};

beforeAll(async () => {
  ({ buildServer } = await import("../server.js"));
  ({ registerNetplayRoutes } = await import("./netplay.js"));
});

describe("netplay routes", () => {
  let app: FastifyInstance;
  const prismaMock: PrismaMock = {
    netplaySession: {
      count: vi.fn(),
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    netplayParticipant: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    netplaySignalMessage: {
      create: vi.fn(),
    },
    $transaction: vi.fn(async (operations: unknown) => {
      if (Array.isArray(operations)) {
        return Promise.all(operations);
      }
      return operations;
    }),
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    app = buildServer({ registerPrisma: false });
    app.decorate("prisma", prismaMock as unknown as typeof app.prisma);
    prismaMock.netplaySession.count.mockResolvedValue(0);
    prismaMock.netplaySession.create.mockResolvedValue({
      id: "session_1",
      romId: "rom_1",
      hostId: "user_1",
      saveStateId: null,
      status: "OPEN",
      expiresAt: new Date("2024-01-01T01:10:00.000Z"),
      lastActivityAt: new Date("2024-01-01T01:00:00.000Z"),
      createdAt: new Date("2024-01-01T01:00:00.000Z"),
      updatedAt: new Date("2024-01-01T01:00:00.000Z"),
      participants: [
        {
          id: "participant_1",
          userId: "user_1",
          role: "HOST",
          status: "CONNECTED",
          lastHeartbeatAt: new Date("2024-01-01T01:00:00.000Z"),
          connectedAt: new Date("2024-01-01T01:00:00.000Z"),
          disconnectedAt: null,
          createdAt: new Date("2024-01-01T01:00:00.000Z"),
          updatedAt: new Date("2024-01-01T01:00:00.000Z"),
        },
      ],
    });
    prismaMock.netplaySession.findMany.mockResolvedValue([]);
    prismaMock.netplaySession.findUnique.mockResolvedValue(null);
    prismaMock.netplaySession.update.mockResolvedValue(undefined);
    prismaMock.netplayParticipant.create.mockResolvedValue(undefined);
    prismaMock.netplayParticipant.update.mockResolvedValue(undefined);
    prismaMock.netplayParticipant.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.netplayParticipant.findUnique.mockResolvedValue(null);
    prismaMock.netplaySignalMessage.create.mockResolvedValue({
      id: "signal_1",
      sessionId: "session_1",
      senderId: "participant_1",
      senderTokenHash: createHash("sha256").update("peer-token").digest("hex"),
      recipientId: null,
      recipientTokenHash: null,
      messageType: "offer",
      payload: {},
      createdAt: new Date("2024-01-01T01:00:00.000Z"),
    });

    await app.register(async (instance) => {
      await registerNetplayRoutes(instance);
    });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  it("requires authentication", async () => {
    const response = await request(app).get("/netplay/sessions");
    expect(response.status).toBe(401);
  });

  it("lists only active netplay sessions for the user", async () => {
    const token = app.jwt.sign({ sub: "user_1", role: "ADMIN" });

    const activeSession = {
      id: "session_active",
      romId: "rom_1",
      hostId: "user_1",
      saveStateId: null,
      status: "OPEN" as const,
      expiresAt: new Date(Date.now() + 60_000),
      lastActivityAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
      participants: [
        {
          id: "participant_host",
          userId: "user_1",
          role: "HOST",
          status: "CONNECTED",
          lastHeartbeatAt: new Date(),
          connectedAt: new Date(),
          disconnectedAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
    };

    const expiredSession = {
      ...activeSession,
      id: "session_expired",
      expiresAt: new Date(Date.now() - 60_000),
      participants: [
        {
          id: "participant_host",
          userId: "user_1",
          role: "HOST",
          status: "CONNECTED",
          lastHeartbeatAt: new Date(Date.now() - 120_000),
          connectedAt: new Date(Date.now() - 300_000),
          disconnectedAt: null,
          createdAt: new Date(Date.now() - 300_000),
          updatedAt: new Date(Date.now() - 120_000),
        },
      ],
    };

    prismaMock.netplaySession.findMany.mockResolvedValueOnce([
      activeSession,
      expiredSession,
    ]);

    const response = await request(app)
      .get("/netplay/sessions")
      .set("authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.sessions).toHaveLength(1);
    expect(response.body.sessions[0]).toMatchObject({
      id: "session_active",
      status: "OPEN",
    });

    const [findManyArgs] = prismaMock.netplaySession.findMany.mock.calls[0];
    expect(findManyArgs.where?.expiresAt?.gt).toBeInstanceOf(Date);
  });

  it("creates a netplay session for the host", async () => {
    const token = app.jwt.sign({ sub: "user_1", role: "ADMIN" });

    const response = await request(app)
      .post("/netplay/sessions")
      .set("authorization", `Bearer ${token}`)
      .send({ romId: "rom_1" });

    expect(response.status).toBe(201);
    expect(response.body.session).toMatchObject({
      id: "session_1",
      romId: "rom_1",
      hostId: "user_1",
      status: "OPEN",
    });
    expect(typeof response.body.peerToken).toBe("string");
    expect(response.body.peerToken).toHaveLength(64);

    const createCall = prismaMock.netplaySession.create.mock.calls[0][0];
    expect(createCall.data.rom.connect).toEqual({ id: "rom_1" });
    expect(createCall.data.participants.create.role).toBe("HOST");
    expect(createCall.data.participants.create.peerTokenHash).toBe(
      createHash("sha256").update(response.body.peerToken).digest("hex"),
    );
  });

  it("returns 429 when host limit is reached", async () => {
    prismaMock.netplaySession.count
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(5);

    const token = app.jwt.sign({ sub: "user_1", role: "ADMIN" });
    const response = await request(app)
      .post("/netplay/sessions")
      .set("authorization", `Bearer ${token}`)
      .send({ romId: "rom_1" });

    expect(response.status).toBe(429);
    expect(response.body).toEqual({ message: "Host session limit reached" });
  });

  it("invites a participant", async () => {
    const session = {
      id: "session_1",
      romId: "rom_1",
      hostId: "user_1",
      saveStateId: null,
      status: "OPEN",
      expiresAt: new Date(Date.now() + 10_000),
      lastActivityAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
      participants: [
        {
          id: "participant_1",
          userId: "user_1",
          role: "HOST",
          status: "CONNECTED",
          lastHeartbeatAt: new Date(),
          connectedAt: new Date(),
          disconnectedAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
    };

    prismaMock.netplaySession.findUnique
      .mockResolvedValueOnce(session)
      .mockResolvedValueOnce({
        ...session,
        participants: [
          ...session.participants,
          {
            id: "participant_2",
            userId: "user_2",
            role: "PLAYER",
            status: "INVITED",
            lastHeartbeatAt: null,
            connectedAt: null,
            disconnectedAt: null,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
      });

    const token = app.jwt.sign({ sub: "user_1", role: "ADMIN" });
    const response = await request(app)
      .post("/netplay/sessions/session_1/invite")
      .set("authorization", `Bearer ${token}`)
      .send({ userId: "user_2" });

    expect(response.status).toBe(200);
    expect(prismaMock.netplayParticipant.create).toHaveBeenCalledWith({
      data: {
        session: { connect: { id: "session_1" } },
        user: { connect: { id: "user_2" } },
        role: "PLAYER",
        status: "INVITED",
      },
    });
    expect(response.body.session.participants).toHaveLength(2);
  });

  it("allows an invited participant to join and receive a peer token", async () => {
    const session = {
      id: "session_1",
      romId: "rom_1",
      hostId: "user_1",
      saveStateId: null,
      status: "OPEN",
      expiresAt: new Date(Date.now() + 10_000),
      lastActivityAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
      participants: [
        {
          id: "participant_1",
          userId: "user_1",
          role: "HOST",
          status: "CONNECTED",
          lastHeartbeatAt: new Date(),
          connectedAt: new Date(),
          disconnectedAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: "participant_2",
          userId: "user_2",
          role: "PLAYER",
          status: "INVITED",
          lastHeartbeatAt: null,
          connectedAt: null,
          disconnectedAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
    };

    prismaMock.netplaySession.findUnique
      .mockResolvedValueOnce(session)
      .mockResolvedValueOnce({ ...session, status: "ACTIVE" });

    const token = app.jwt.sign({ sub: "user_2", role: "USER" });
    const response = await request(app)
      .post("/netplay/sessions/session_1/join")
      .set("authorization", `Bearer ${token}`)
      .send();

    expect(response.status).toBe(200);
    expect(typeof response.body.peerToken).toBe("string");
    expect(prismaMock.netplayParticipant.update).toHaveBeenCalled();
    expect(prismaMock.$transaction).toHaveBeenCalled();
  });

  it("records heartbeat updates", async () => {
    const now = new Date();
    const participant = {
      id: "participant_2",
      sessionId: "session_1",
      userId: "user_2",
      role: "PLAYER",
      status: "CONNECTED",
      peerTokenHash: createHash("sha256").update("peer-token").digest("hex"),
      lastHeartbeatAt: now,
      connectedAt: now,
      disconnectedAt: null,
      createdAt: now,
      updatedAt: now,
      session: {
        id: "session_1",
        romId: "rom_1",
        hostId: "user_1",
        saveStateId: null,
        status: "ACTIVE",
        expiresAt: new Date(Date.now() + 10_000),
        lastActivityAt: now,
        createdAt: now,
        updatedAt: now,
        participants: [
          {
            id: "participant_1",
            userId: "user_1",
            role: "HOST",
            status: "CONNECTED",
            lastHeartbeatAt: now,
            connectedAt: now,
            disconnectedAt: null,
            createdAt: now,
            updatedAt: now,
          },
          {
            id: "participant_2",
            userId: "user_2",
            role: "PLAYER",
            status: "CONNECTED",
            lastHeartbeatAt: now,
            connectedAt: now,
            disconnectedAt: null,
            createdAt: now,
            updatedAt: now,
          },
        ],
      },
    };

    prismaMock.netplayParticipant.findUnique.mockResolvedValue(participant);

    const token = app.jwt.sign({ sub: "user_2", role: "USER" });
    const response = await request(app)
      .post("/netplay/sessions/session_1/heartbeat")
      .set("authorization", `Bearer ${token}`)
      .send({ peerToken: "peer-token", status: "connected" });

    expect(response.status).toBe(204);
    expect(prismaMock.netplayParticipant.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { sessionId_userId: { sessionId: "session_1", userId: "user_2" } },
      }),
    );
    expect(prismaMock.netplaySession.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "session_1" } }),
    );
  });

  it("allows the host to close a session", async () => {
    prismaMock.netplaySession.findUnique.mockResolvedValue({
      id: "session_1",
      hostId: "user_1",
      status: "ACTIVE",
      romId: "rom_1",
      saveStateId: null,
      expiresAt: new Date(Date.now() + 10_000),
      lastActivityAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const token = app.jwt.sign({ sub: "user_1", role: "ADMIN" });
    const response = await request(app)
      .delete("/netplay/sessions/session_1")
      .set("authorization", `Bearer ${token}`);

    expect(response.status).toBe(204);
    expect(prismaMock.netplayParticipant.updateMany).toHaveBeenCalledWith({
      where: { sessionId: "session_1" },
      data: expect.objectContaining({ status: "DISCONNECTED" }),
    });
    expect(prismaMock.netplaySession.update).toHaveBeenCalledWith({
      where: { id: "session_1" },
      data: expect.objectContaining({ status: "CLOSED" }),
    });
  });

  it("rejects signal connections without authentication", async () => {
    const address = await app.listen({ port: 0 });
    const socket = createSocketClient(address, {
      path: "/netplay/signal",
      transports: ["websocket"],
      auth: { sessionId: "session_1" },
      extraHeaders: { origin: "https://trusted.example" },
    });

    const error = await new Promise<Error>((resolve) => {
      socket.on("connect", () => {
        resolve(new Error("unexpected connection"));
      });
      socket.on("connect_error", (err) => {
        resolve(err instanceof Error ? err : new Error(String(err)));
      });
    });

    expect(error.message).toMatch(/authentication/i);
    socket.close();
  });

  it("rejects signal connections from untrusted origins", async () => {
    const address = await app.listen({ port: 0 });
    const token = app.jwt.sign({ sub: "user_1", role: "USER" });

    const socket = createSocketClient(address, {
      path: "/netplay/signal",
      transports: ["websocket"],
      auth: { sessionId: "session_1", token },
      extraHeaders: { origin: "https://evil.example" },
    });

    const error = await new Promise<Error>((resolve) => {
      socket.on("connect", () => resolve(new Error("unexpected connection")));
      socket.on("connect_error", (err) => {
        resolve(err instanceof Error ? err : new Error(String(err)));
      });
    });

    expect(error.message).toMatch(/origin/i);
    socket.close();
  });

  it("allows signal connections from approved origins", async () => {
    const address = await app.listen({ port: 0 });
    const token = app.jwt.sign({ sub: "user_1", role: "USER" });

    const now = new Date();
    const participantRecord = {
      id: "participant_1",
      sessionId: "session_1",
      userId: "user_1",
      role: "HOST",
      status: "CONNECTED",
      peerTokenHash: null,
      lastHeartbeatAt: now,
      connectedAt: now,
      disconnectedAt: null,
      createdAt: now,
      updatedAt: now,
    } as const;
    const sessionRecord = {
      id: "session_1",
      romId: "rom_1",
      hostId: "user_1",
      saveStateId: null,
      status: "OPEN",
      expiresAt: new Date(now.getTime() + 60_000),
      lastActivityAt: now,
      createdAt: now,
      updatedAt: now,
      participants: [{ ...participantRecord }],
    } as const;

    prismaMock.netplayParticipant.findUnique.mockResolvedValue({
      ...participantRecord,
      session: { ...sessionRecord },
    });
    prismaMock.netplaySession.findUnique.mockResolvedValue({
      ...sessionRecord,
      participants: [{ ...participantRecord }],
    });

    const socket = createSocketClient(address, {
      path: "/netplay/signal",
      transports: ["websocket"],
      auth: { sessionId: "session_1", token },
      extraHeaders: { origin: "https://trusted.example" },
    });

    await new Promise<void>((resolve, reject) => {
      socket.on("connect", () => resolve());
      socket.on("connect_error", (err) => {
        reject(err instanceof Error ? err : new Error(String(err)));
      });
    });

    expect(socket.connected).toBe(true);
    socket.close();
  });

  it("persists and relays signalling payloads", async () => {
    const now = new Date();
    const futureExpiry = new Date(Date.now() + 5 * 60_000);
    const hostPeerToken = "host-token";
    const guestPeerToken = "guest-token";

    const hostParticipant = {
      id: "participant_1",
      sessionId: "session_1",
      userId: "user_1",
      role: "HOST",
      status: "CONNECTED",
      peerTokenHash: createHash("sha256").update(hostPeerToken).digest("hex"),
      lastHeartbeatAt: now,
      connectedAt: now,
      disconnectedAt: null,
      createdAt: now,
      updatedAt: now,
    };

    const guestParticipant = {
      id: "participant_2",
      sessionId: "session_1",
      userId: "user_2",
      role: "PLAYER",
      status: "CONNECTED",
      peerTokenHash: createHash("sha256").update(guestPeerToken).digest("hex"),
      lastHeartbeatAt: now,
      connectedAt: now,
      disconnectedAt: null,
      createdAt: now,
      updatedAt: now,
    };

    const sessionRecord = {
      id: "session_1",
      romId: "rom_1",
      hostId: "user_1",
      saveStateId: null,
      status: "ACTIVE",
      expiresAt: futureExpiry,
      lastActivityAt: now,
      createdAt: now,
      updatedAt: now,
      participants: [hostParticipant, guestParticipant],
    };

    prismaMock.netplayParticipant.findUnique.mockImplementation(
      async ({ where }: { where: { sessionId_userId: { userId: string } } }) => {
        const { userId } = where.sessionId_userId;
        if (userId === "user_1") {
          return { ...hostParticipant, session: { ...sessionRecord } };
        }
        if (userId === "user_2") {
          return { ...guestParticipant, session: { ...sessionRecord } };
        }
        return null;
      },
    );

    prismaMock.netplaySession.findUnique.mockImplementation(async () => ({
      ...sessionRecord,
      participants: [
        { ...hostParticipant },
        { ...guestParticipant },
      ],
    }));

    prismaMock.netplaySignalMessage.create.mockResolvedValueOnce({
      id: "signal_1",
      sessionId: "session_1",
      senderId: hostParticipant.id,
      senderTokenHash: hostParticipant.peerTokenHash!,
      recipientId: guestParticipant.id,
      recipientTokenHash: guestParticipant.peerTokenHash,
      messageType: "offer",
      payload: { sdp: "test" },
      createdAt: now,
    });

    const address = await app.listen({ port: 0 });

    const hostToken = app.jwt.sign({ sub: "user_1", role: "ADMIN" });
    const guestToken = app.jwt.sign({ sub: "user_2", role: "ADMIN" });

    const hostSocket = createSocketClient(address, {
      path: "/netplay/signal",
      transports: ["websocket"],
      auth: {
        token: hostToken,
        sessionId: "session_1",
        peerToken: hostPeerToken,
      },
      extraHeaders: { origin: "https://trusted.example" },
    });

    await new Promise<void>((resolve, reject) => {
      hostSocket.on("connect", () => resolve());
      hostSocket.on("connect_error", reject);
    });

    const guestSocket = createSocketClient(address, {
      path: "/netplay/signal",
      transports: ["websocket"],
      auth: {
        token: guestToken,
        sessionId: "session_1",
        peerToken: guestPeerToken,
      },
      extraHeaders: { origin: "https://trusted.example" },
    });

    await new Promise<void>((resolve, reject) => {
      guestSocket.on("connect", () => resolve());
      guestSocket.on("connect_error", reject);
    });

    const messagePromise = new Promise<unknown>((resolve) => {
      guestSocket.on("signal:message", resolve);
    });

    const ack = await new Promise<{ status: string; id?: string; message?: string }>(
      (resolve) => {
        hostSocket.emit(
          "signal:message",
          {
            type: "offer",
            payload: { sdp: "test" },
            targetUserId: "user_2",
          },
          resolve,
        );
      },
    );

    expect(ack.status).toBe("ok");
    expect(prismaMock.netplaySignalMessage.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        senderTokenHash: hostParticipant.peerTokenHash,
        recipientTokenHash: guestParticipant.peerTokenHash,
        messageType: "offer",
      }),
    });

    const delivered = (await messagePromise) as {
      type: string;
      sender: { userId: string; participantId: string };
      recipient?: { userId: string; participantId: string };
    };

    expect(delivered.type).toBe("offer");
    expect(delivered.sender.userId).toBe("user_1");
    expect(delivered.recipient?.userId).toBe("user_2");

    hostSocket.close();
    guestSocket.close();
  });
});
