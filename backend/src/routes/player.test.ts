import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { FastifyInstance } from "fastify";
import request from "supertest";
import { promises as fs } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import type { Socket } from "node:net";
import type { PrismaClient } from "@prisma/client";
import {
  RomAssetSource,
  RomAssetType,
  RomBinaryStatus,
} from "../utils/prisma-enums.js";

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
process.env.PLAY_STATE_MAX_BYTES = `${512 * 1024}`;
process.env.PLAY_STATE_MAX_PER_ROM = "3";
process.env.CORS_ALLOWED_ORIGINS = "https://trusted.example";

const STORAGE_ROOT = resolve(join(tmpdir(), "treaz-player-tests"));
process.env.STORAGE_LOCAL_ROOT = STORAGE_ROOT;

let buildServer: typeof import("../server.js").buildServer;
let registerPlayerRoutes: typeof import("./player.js").registerPlayerRoutes;

type PrismaMock = {
  rom: { findUnique: ReturnType<typeof vi.fn> };
  romAsset: { findUnique: ReturnType<typeof vi.fn> };
  playState: {
    findMany: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
    findFirst: ReturnType<typeof vi.fn>;
    deleteMany: ReturnType<typeof vi.fn>;
  };
  romPlaybackAudit: { create: ReturnType<typeof vi.fn> };
  $transaction: ReturnType<typeof vi.fn>;
};

describe("player routes", () => {
  let app: FastifyInstance;
  const prismaMock: PrismaMock = {
    rom: { findUnique: vi.fn() },
    romAsset: { findUnique: vi.fn() },
    playState: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      findFirst: vi.fn(),
      deleteMany: vi.fn()
    },
    romPlaybackAudit: { create: vi.fn() },
    $transaction: vi.fn()
  };

  beforeAll(async () => {
    ({ buildServer } = await import("../server.js"));
    ({ registerPlayerRoutes } = await import("./player.js"));
  });

  beforeEach(async () => {
    await fs.rm(STORAGE_ROOT, { recursive: true, force: true });
    await fs.mkdir(STORAGE_ROOT, { recursive: true });

    vi.clearAllMocks();
    app = buildServer({ registerPrisma: false });
    prismaMock.playState.findMany.mockResolvedValue([]);
    prismaMock.playState.deleteMany.mockResolvedValue({ count: 0 });
    prismaMock.$transaction.mockImplementation(async (callback) =>
      callback(
        {
          playState: {
            create: prismaMock.playState.create,
            findMany: prismaMock.playState.findMany,
            deleteMany: prismaMock.playState.deleteMany,
          },
        } as unknown as PrismaClient,
      ),
    );
    app.decorate("prisma", prismaMock as unknown as PrismaClient);
    await app.register(async (instance) => {
      await registerPlayerRoutes(instance);
    });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  it("streams a ROM binary from filesystem storage", async () => {
    const binaryData = Buffer.from("ROMDATA");
    const romStoragePath = join(STORAGE_ROOT, process.env.STORAGE_BUCKET_ROMS!, "rom-1.bin");
    await fs.mkdir(join(STORAGE_ROOT, process.env.STORAGE_BUCKET_ROMS!), { recursive: true });
    await fs.writeFile(romStoragePath, binaryData);

    prismaMock.rom.findUnique.mockResolvedValue({
      id: "rom-1",
      binary: {
        id: "binary-1",
        storageKey: "rom-1.bin",
        status: RomBinaryStatus.READY,
        archiveSize: binaryData.length,
        archiveMimeType: "application/octet-stream"
      }
    });
    prismaMock.romPlaybackAudit.create.mockResolvedValue({});

    const token = app.jwt.sign({ sub: "user-1", role: "USER" });
    const response = await request(app)
      .get("/player/roms/rom-1/binary")
      .set("authorization", `Bearer ${token}`)
      .expect(200);

    expect(response.headers["content-length"]).toBe(String(binaryData.length));
    const bodyBuffer = Buffer.isBuffer(response.body)
      ? response.body
      : Buffer.from(response.body as string, "binary");
    expect(bodyBuffer).toEqual(binaryData);
    expect(prismaMock.rom.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "rom-1" } })
    );
    expect(prismaMock.romPlaybackAudit.create).toHaveBeenCalled();
  });

  it("returns recent play states with rom context", async () => {
    const now = new Date();
    prismaMock.playState.findMany.mockResolvedValueOnce([
      {
        id: "play-1",
        userId: "user-1",
        romId: "rom-1",
        storageKey: "play-states/user-1/rom-1/play-1.bin",
        label: "Dungeon",
        slot: 1,
        size: 2048,
        checksumSha256: "checksum",
        createdAt: now,
        updatedAt: now,
        rom: {
          id: "rom-1",
          title: "The Legend of Zelda",
          platform: {
            id: "platform-1",
            name: "NES",
            slug: "nes",
            shortName: "NES"
          },
          assets: [
            {
              id: "asset-1",
              type: RomAssetType.COVER,
              source: RomAssetSource.SCREEN_SCRAPER,
              providerId: "provider-1",
              language: "en",
              region: "US",
              width: 400,
              height: 560,
              fileSize: 12345,
              format: "png",
              checksum: "abc",
              storageKey: "covers/rom-1.png",
              externalUrl: null,
              createdAt: now
            }
          ]
        }
      }
    ]);

    const token = app.jwt.sign({ sub: "user-1", role: "USER" });
    const response = await request(app)
      .get("/player/play-states/recent")
      .set("authorization", `Bearer ${token}`)
      .expect(200);

    expect(prismaMock.playState.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: "user-1" },
        orderBy: { updatedAt: "desc" },
        take: 10
      })
    );

    expect(response.body.recent).toHaveLength(1);
    expect(response.body.recent[0].playState).toMatchObject({
      id: "play-1",
      romId: "rom-1",
      downloadUrl: "/player/play-states/play-1/binary"
    });
    expect(response.body.recent[0].rom).toMatchObject({
      id: "rom-1",
      title: "The Legend of Zelda",
      platform: {
        id: "platform-1",
        slug: "nes"
      },
      assetSummary: {
        cover: expect.objectContaining({ id: "asset-1" })
      }
    });
  });

  it("denies EmulatorJS websocket upgrades from untrusted origins", async () => {
    const write = vi.fn();
    const destroy = vi.fn();
    const fakeSocket = { write, destroy } as unknown as Socket;

    app.server.emit(
      "upgrade",
      { url: "/player/emulator/socket", headers: { origin: "https://evil.example" } } as unknown,
      fakeSocket,
      Buffer.alloc(0),
    );

    expect(write).toHaveBeenCalledWith(expect.stringContaining("403 Forbidden"));
    expect(destroy).toHaveBeenCalled();
  });

  it("allows EmulatorJS websocket upgrades from trusted origins", async () => {
    const write = vi.fn();
    const destroy = vi.fn();
    const fakeSocket = { write, destroy } as unknown as Socket;

    app.server.emit(
      "upgrade",
      { url: "/player/emulator/socket", headers: { origin: "https://trusted.example" } } as unknown,
      fakeSocket,
      Buffer.alloc(0),
    );

    expect(write).not.toHaveBeenCalled();
    expect(destroy).not.toHaveBeenCalled();
  });

  it("enforces per-ROM play state limits and records eviction metrics", async () => {
    const token = app.jwt.sign({ sub: "user-1", role: "USER" });
    prismaMock.rom.findUnique.mockResolvedValue({ id: "rom-1" });
    prismaMock.romPlaybackAudit.create.mockResolvedValue({});

    const createdAt = new Date();
    const createdState = {
      id: "state-new",
      userId: "user-1",
      romId: "rom-1",
      storageKey: "play-states/user-1/rom-1/state-new.bin",
      label: null,
      slot: null,
      size: 16,
      checksumSha256: "checksum",
      createdAt,
      updatedAt: createdAt,
    };

    const existingStates = [
      { id: "state-old-1", storageKey: "play-states/user-1/rom-1/state-old-1.bin" },
      { id: "state-old-2", storageKey: "play-states/user-1/rom-1/state-old-2.bin" },
      { id: "state-old-3", storageKey: "play-states/user-1/rom-1/state-old-3.bin" },
    ];

    const transactionCreate = vi.fn().mockResolvedValue(createdState);
    const transactionFindMany = vi
      .fn()
      .mockResolvedValue([...existingStates, createdState]);
    const transactionDeleteMany = vi.fn().mockResolvedValue({ count: 1 });

    prismaMock.$transaction.mockImplementationOnce(async (callback) =>
      callback(
        {
          playState: {
            create: transactionCreate,
            findMany: transactionFindMany,
            deleteMany: transactionDeleteMany,
          },
        } as unknown as PrismaClient,
      ),
    );

    const playbackInc = vi.fn();
    app.metrics.enabled = true;
    app.metrics.playback = { inc: playbackInc } as unknown as typeof app.metrics.playback;

    await request(app)
      .post("/player/play-states")
      .set("authorization", `Bearer ${token}`)
      .send({ romId: "rom-1", data: Buffer.from([1, 2, 3, 4]).toString("base64") })
      .expect(201);

    expect(transactionCreate).toHaveBeenCalled();
    expect(transactionFindMany).toHaveBeenCalled();
    expect(transactionDeleteMany).toHaveBeenCalledWith({
      where: { id: { in: ["state-old-1"] } },
    });

    expect(playbackInc).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "play_state_upload",
        status: "evicted",
        reason: "per_rom_limit",
      }),
      1,
    );
  });

  it("increments the rate limit metric when requests exceed the threshold", async () => {
    prismaMock.rom.findUnique.mockResolvedValue(null);
    const rateLimitInc = vi.fn();
    app.metrics.rateLimit = { inc: rateLimitInc };

    const token = app.jwt.sign({ sub: "user-1", role: "USER" });

    for (let attempt = 0; attempt < 30; attempt += 1) {
      await request(app)
        .get("/player/roms/rom-1/binary")
        .set("authorization", `Bearer ${token}`)
        .expect(404);
    }

    await request(app)
      .get("/player/roms/rom-1/binary")
      .set("authorization", `Bearer ${token}`)
      .expect(429);

    expect(rateLimitInc).toHaveBeenCalledTimes(1);
    expect(rateLimitInc).toHaveBeenCalledWith({
      route: "/player/roms/:id/binary",
      role: "user",
    });
  });
});
