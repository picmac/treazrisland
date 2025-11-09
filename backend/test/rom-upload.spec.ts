import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { FastifyInstance } from "fastify";
import request from "supertest";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

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
process.env.ROM_UPLOAD_MAX_BYTES = `${8 * 1024 * 1024}`;

type MockFn = ReturnType<typeof vi.fn>;

type PrismaMock = {
  platform: { findUnique: MockFn };
  romBinary: { findFirst: MockFn; upsert: MockFn };
  rom: { findFirst: MockFn; create: MockFn; update: MockFn };
  romUploadAudit: { create: MockFn };
  $transaction: MockFn;
};

describe("player rom upload route", () => {
  let buildServer: typeof import("../src/server.js").buildServer;
  let app: FastifyInstance;
  let prisma: PrismaMock;
  let storageRoot: string;

  beforeAll(async () => {
    ({ buildServer } = await import("../src/server.js"));
  });

  beforeEach(async () => {
    storageRoot = await mkdtemp(join(tmpdir(), "rom-upload-test-"));
    process.env.STORAGE_LOCAL_ROOT = storageRoot;

    prisma = {
      platform: { findUnique: vi.fn() },
      romBinary: { findFirst: vi.fn(), upsert: vi.fn() },
      rom: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
      romUploadAudit: { create: vi.fn() },
      $transaction: vi.fn(async (callback: (client: PrismaMock) => Promise<any>) =>
        callback(prisma as PrismaMock),
      ),
    } as PrismaMock;

    app = buildServer({ registerPrisma: false });
    app.decorate("prisma", prisma);
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    vi.resetAllMocks();
    await rm(storageRoot, { recursive: true, force: true });
  });

  it("accepts multipart uploads and persists rom metadata", async () => {
    prisma.platform.findUnique.mockResolvedValueOnce({
      id: "platform-1",
      slug: "snes",
      name: "Super Nintendo",
      shortName: "SNES",
    });

    prisma.romBinary.findFirst.mockResolvedValueOnce(null);

    prisma.rom.findFirst.mockResolvedValueOnce(null);
    prisma.rom.create.mockResolvedValueOnce({
      id: "rom-1",
      title: "Demo",
      platformId: "platform-1",
      romHash: null,
      romSize: null,
    });

    prisma.romBinary.upsert.mockResolvedValueOnce({
      id: "binary-1",
      romId: "rom-1",
      storageKey: "roms/snes/demo.zip",
    });

    prisma.romUploadAudit.create.mockResolvedValueOnce({ id: "audit-1" });

    const token = app.jwt.sign({ sub: "user-1", role: "USER" });

    const response = await request(app)
      .post("/roms/uploads")
      .set("Authorization", `Bearer ${token}`)
      .field("platformSlug", "snes")
      .field("title", "Super Demo")
      .attach("file", Buffer.from("rom-payload"), {
        filename: "demo.zip",
        contentType: "application/zip",
      });

    expect(response.status).toBe(201);
    expect(response.body.upload).toBeDefined();
    expect(response.body.upload.romId).toBe("rom-1");
    expect(response.body.upload.platform.slug).toBe("snes");
    expect(prisma.romBinary.upsert).toHaveBeenCalled();
    expect(prisma.romUploadAudit.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          kind: "ROM",
          status: "SUCCEEDED",
          platformId: "platform-1",
        }),
      }),
    );
  });
});
