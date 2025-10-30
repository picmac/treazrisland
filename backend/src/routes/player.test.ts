import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { FastifyInstance } from "fastify";
import request from "supertest";
import { promises as fs } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import type { PrismaClient } from "@prisma/client";
import { RomBinaryStatus } from "@prisma/client";

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
  };
  romPlaybackAudit: { create: ReturnType<typeof vi.fn> };
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
      findFirst: vi.fn()
    },
    romPlaybackAudit: { create: vi.fn() }
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
