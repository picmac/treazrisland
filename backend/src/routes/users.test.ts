import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import type { FastifyInstance } from "fastify";
import type { Prisma } from "@prisma/client";
import { Prisma as PrismaNamespace } from "@prisma/client";
import { Readable } from "node:stream";

process.env.NODE_ENV = "test";
process.env.PORT = "0";
process.env.JWT_SECRET = "this-is-a-test-secret-at-least-32";
process.env.JWT_ACCESS_TTL = "15m";
process.env.JWT_REFRESH_TTL = "30d";
process.env.USER_INVITE_EXPIRY_HOURS = "24";
process.env.STORAGE_DRIVER = "filesystem";
process.env.STORAGE_BUCKET_ASSETS = "assets";
process.env.STORAGE_BUCKET_ROMS = "roms";
process.env.STORAGE_BUCKET_BIOS = "bios";
process.env.ROM_UPLOAD_MAX_BYTES = `${1024 * 1024}`;
process.env.USER_AVATAR_MAX_BYTES = `${5 * 1024 * 1024}`;

let buildServer: typeof import("../server.js").buildServer;

type PrismaMock = {
  user: {
    findUnique: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  mfaSecret: {
    findFirst: ReturnType<typeof vi.fn>;
  };
};

type StorageMock = {
  uploadUserAvatar: ReturnType<typeof vi.fn>;
  deleteAssetObject: ReturnType<typeof vi.fn>;
  getAssetObjectSignedUrl: ReturnType<typeof vi.fn>;
  getAssetObjectStream: ReturnType<typeof vi.fn>;
};

describe("user profile routes", () => {
  let app: FastifyInstance;
  let prisma: PrismaMock;
  let storage: StorageMock;

  beforeAll(async () => {
    ({ buildServer } = await import("../server.js"));
  });

  beforeEach(async () => {
    prisma = {
      user: {
        findUnique: vi.fn(),
        update: vi.fn(),
      },
      mfaSecret: {
        findFirst: vi.fn(),
      },
    } satisfies PrismaMock;

    storage = {
      uploadUserAvatar: vi.fn().mockImplementation(async (options: unknown) => {
        const { stream, contentType } =
          (options as { stream?: AsyncIterable<unknown>; contentType?: string }) ?? {};
        if (stream && typeof (stream as AsyncIterable<unknown>)[Symbol.asyncIterator] === "function") {
          for await (const chunk of stream as AsyncIterable<unknown>) {
            void chunk;
          }
        }
        return {
          storageKey: "avatars/user/mock.png",
          size: 0,
          contentType: contentType ?? "application/octet-stream",
          checksumSha256: "mock",
        } satisfies import("../services/storage/storage.js").AvatarUploadResult;
      }),
      deleteAssetObject: vi.fn().mockResolvedValue(undefined),
      getAssetObjectSignedUrl: vi.fn().mockResolvedValue(null),
      getAssetObjectStream: vi.fn(),
    } satisfies StorageMock;

    app = buildServer({ registerPrisma: false });
    app.decorate("prisma", prisma as unknown as Prisma.PrismaClient);
    await app.ready();
    (app as unknown as { storage: unknown }).storage =
      storage as unknown as import("../services/storage/storage.js").StorageService;
  });

  afterEach(async () => {
    await app.close();
    vi.clearAllMocks();
  });

  it("requires authentication for profile queries", async () => {
    const response = await request(app).get("/users/me");
    expect(response.status).toBe(401);
  });

  it("returns the authenticated user's profile", async () => {
    const now = new Date("2025-01-01T00:00:00Z");
    prisma.user.findUnique.mockResolvedValueOnce({
      id: "user_1",
      email: "player@example.com",
      nickname: "pirate",
      displayName: "Pirate",
      role: "USER",
      avatarStorageKey: null,
      avatarMimeType: null,
      avatarFileSize: null,
      avatarUpdatedAt: null,
    });
    prisma.mfaSecret.findFirst.mockResolvedValueOnce(null);

    const token = app.jwt.sign({ sub: "user_1", role: "USER" });
    const response = await request(app)
      .get("/users/me")
      .set("authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      user: {
        id: "user_1",
        email: "player@example.com",
        nickname: "pirate",
        displayName: "Pirate",
        role: "USER",
        avatar: null,
        mfaEnabled: false,
      },
    });
    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: "user_1" },
      select: expect.any(Object),
    });
  });

  it("includes avatar metadata when present", async () => {
    const updatedAt = new Date("2025-02-01T00:00:00Z");
    prisma.user.findUnique.mockResolvedValueOnce({
      id: "user_1",
      email: "player@example.com",
      nickname: "pirate",
      displayName: "Pirate",
      role: "USER",
      avatarStorageKey: "avatars/user_1/avatar.png",
      avatarMimeType: "image/png",
      avatarFileSize: 1234,
      avatarUpdatedAt: updatedAt,
    });
    storage.getAssetObjectSignedUrl.mockResolvedValueOnce({
      url: "https://cdn.example.com/avatar.png",
      expiresAt: new Date("2025-02-01T01:00:00Z"),
    });
    prisma.mfaSecret.findFirst.mockResolvedValueOnce({
      id: "secret-1",
      userId: "user_1",
      secret: "secret",
      recoveryCodes: "",
      confirmedAt: new Date(),
      disabledAt: null,
    });

    const token = app.jwt.sign({ sub: "user_1", role: "USER" });
    const response = await request(app)
      .get("/users/me")
      .set("authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.user.avatar).toMatchObject({
      storageKey: "avatars/user_1/avatar.png",
      mimeType: "image/png",
      fileSize: 1234,
      updatedAt: updatedAt.toISOString(),
      url: "https://cdn.example.com/avatar.png",
      fallbackPath: `/users/me/avatar?v=${updatedAt.getTime()}`,
    });
    expect(response.body.user.mfaEnabled).toBe(true);
  });

  it("updates nickname and display name", async () => {
    prisma.user.findUnique.mockResolvedValueOnce({
      id: "user_1",
      email: "player@example.com",
      nickname: "pirate",
      displayName: "Pirate",
      role: "USER",
      avatarStorageKey: null,
      avatarMimeType: null,
      avatarFileSize: null,
      avatarUpdatedAt: null,
    });
    prisma.user.update.mockResolvedValueOnce({
      id: "user_1",
      email: "player@example.com",
      nickname: "captain",
      displayName: "Captain",
      role: "USER",
      avatarStorageKey: null,
      avatarMimeType: null,
      avatarFileSize: null,
      avatarUpdatedAt: null,
    });
    prisma.mfaSecret.findFirst.mockResolvedValueOnce(null);

    const token = app.jwt.sign({ sub: "user_1", role: "USER" });
    const response = await request(app)
      .patch("/users/me")
      .set("authorization", `Bearer ${token}`)
      .send({ nickname: "captain ", displayName: " Captain " });

    expect(response.status).toBe(200);
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: "user_1" },
      data: {
        nickname: "captain",
        displayName: "Captain",
      },
      select: expect.any(Object),
    });
    expect(response.body.user.nickname).toBe("captain");
    expect(response.body.user.mfaEnabled).toBe(false);
    expect(storage.uploadUserAvatar).not.toHaveBeenCalled();
  });

  it("returns 409 when nickname is already taken", async () => {
    prisma.user.findUnique.mockResolvedValueOnce({
      id: "user_1",
      email: "player@example.com",
      nickname: "pirate",
      displayName: "Pirate",
      role: "USER",
      avatarStorageKey: null,
      avatarMimeType: null,
      avatarFileSize: null,
      avatarUpdatedAt: null,
    });
    prisma.user.update.mockRejectedValueOnce(
      new PrismaNamespace.PrismaClientKnownRequestError("duplicate", {
        code: "P2002",
        clientVersion: "test",
      }),
    );

    const token = app.jwt.sign({ sub: "user_1", role: "USER" });
    const response = await request(app)
      .patch("/users/me")
      .set("authorization", `Bearer ${token}`)
      .send({ nickname: "taken" });

    expect(response.status).toBe(409);
    expect(storage.uploadUserAvatar).not.toHaveBeenCalled();
  });

  it("accepts avatar uploads and cleans up the previous key", async () => {
    prisma.user.findUnique.mockResolvedValueOnce({
      id: "user_1",
      email: "player@example.com",
      nickname: "pirate",
      displayName: "Pirate",
      role: "USER",
      avatarStorageKey: "avatars/user_1/old.png",
      avatarMimeType: "image/png",
      avatarFileSize: 123,
      avatarUpdatedAt: new Date("2024-01-01T00:00:00Z"),
    });
    prisma.user.update.mockResolvedValueOnce({
      id: "user_1",
      email: "player@example.com",
      nickname: "pirate",
      displayName: "Pirate",
      role: "USER",
      avatarStorageKey: "avatars/user_1/new.png",
      avatarMimeType: "image/png",
      avatarFileSize: 321,
      avatarUpdatedAt: new Date("2025-01-01T00:00:00Z"),
    });
    storage.uploadUserAvatar.mockImplementationOnce(async (payload: unknown) => {
      const { stream } =
        (payload as { stream?: AsyncIterable<unknown> }) ?? {};
      if (stream && typeof stream[Symbol.asyncIterator] === "function") {
        for await (const chunk of stream) {
          void chunk;
        }
      }
      return {
        storageKey: "avatars/user_1/new.png",
        size: 321,
        contentType: "image/png",
        checksumSha256: "abc",
      } satisfies import("../services/storage/storage.js").AvatarUploadResult;
    });

    const token = app.jwt.sign({ sub: "user_1", role: "USER" });

    const response = await request(app)
      .patch("/users/me")
      .set("authorization", `Bearer ${token}`)
      .field("displayName", "Pirate")
      .attach(
        "avatar",
        Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0]),
        { filename: "avatar.png", contentType: "image/png" },
      );

    expect(response.status).toBe(200);
    expect(storage.uploadUserAvatar).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user_1",
        maxBytes: expect.any(Number),
        contentType: "image/png",
      }),
    );
    expect(storage.deleteAssetObject).toHaveBeenCalledWith("avatars/user_1/old.png");
  });

  it("removes the avatar when requested", async () => {
    prisma.user.findUnique.mockResolvedValueOnce({
      id: "user_1",
      email: "player@example.com",
      nickname: "pirate",
      displayName: "Pirate",
      role: "USER",
      avatarStorageKey: "avatars/user_1/old.png",
      avatarMimeType: "image/png",
      avatarFileSize: 123,
      avatarUpdatedAt: new Date("2024-01-01T00:00:00Z"),
    });
    prisma.user.update.mockResolvedValueOnce({
      id: "user_1",
      email: "player@example.com",
      nickname: "pirate",
      displayName: "Pirate",
      role: "USER",
      avatarStorageKey: null,
      avatarMimeType: null,
      avatarFileSize: null,
      avatarUpdatedAt: null,
    });

    const token = app.jwt.sign({ sub: "user_1", role: "USER" });
    const response = await request(app)
      .patch("/users/me")
      .set("authorization", `Bearer ${token}`)
      .send({ removeAvatar: true });

    expect(response.status).toBe(200);
    expect(storage.deleteAssetObject).toHaveBeenCalledWith(
      "avatars/user_1/old.png",
    );
  });

  it("redirects to signed avatar URL when available", async () => {
    const expiresAt = new Date("2025-01-02T00:00:00Z");
    prisma.user.findUnique.mockResolvedValueOnce({
      id: "user_1",
      email: "player@example.com",
      nickname: "pirate",
      displayName: "Pirate",
      role: "USER",
      avatarStorageKey: "avatars/user_1/avatar.png",
      avatarMimeType: "image/png",
      avatarFileSize: 120,
      avatarUpdatedAt: new Date("2025-01-01T00:00:00Z"),
    });
    storage.getAssetObjectSignedUrl.mockResolvedValueOnce({
      url: "https://cdn.example.com/avatar.png",
      expiresAt,
    });

    const token = app.jwt.sign({ sub: "user_1", role: "USER" });
    const response = await request(app)
      .get("/users/me/avatar")
      .set("authorization", `Bearer ${token}`);

    expect(response.status).toBe(302);
    expect(response.headers.location).toBe("https://cdn.example.com/avatar.png");
  });

  it("streams the avatar when signed URLs are unavailable", async () => {
    prisma.user.findUnique.mockResolvedValueOnce({
      id: "user_1",
      email: "player@example.com",
      nickname: "pirate",
      displayName: "Pirate",
      role: "USER",
      avatarStorageKey: "avatars/user_1/avatar.png",
      avatarMimeType: "image/png",
      avatarFileSize: 6,
      avatarUpdatedAt: new Date("2025-01-01T00:00:00Z"),
    });
    storage.getAssetObjectSignedUrl.mockResolvedValueOnce(null);
    storage.getAssetObjectStream.mockResolvedValueOnce({
      stream: Readable.from("avatar"),
      contentLength: 6,
      contentType: "image/png",
    });

    const token = app.jwt.sign({ sub: "user_1", role: "USER" });
    const response = await request(app)
      .get("/users/me/avatar")
      .set("authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toBe("image/png");
    expect(response.text).toBe("avatar");
  });
});
