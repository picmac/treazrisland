import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { FastifyInstance } from "fastify";
import type { PrismaClient } from "@prisma/client";

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
process.env.STORAGE_LOCAL_ROOT = "/tmp/treazrisland-test-storage";
process.env.ROM_UPLOAD_MAX_BYTES = `${1024 * 1024}`;

let buildServer: typeof import("../../server.js").buildServer;
let registerRomUploadRoutes: typeof import("./romUploads.js").registerRomUploadRoutes;

type PrismaMock = {
  platform: { findUnique: ReturnType<typeof vi.fn> };
  romBinary: { findFirst: ReturnType<typeof vi.fn>; upsert: ReturnType<typeof vi.fn> };
  rom: {
    findFirst: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  romUploadAudit: { create: ReturnType<typeof vi.fn> };
  emulatorBios: { upsert: ReturnType<typeof vi.fn> };
  $transaction: ReturnType<typeof vi.fn>;
};

const createTransactionShim = (mock: PrismaMock) =>
  async <T>(callback: (tx: PrismaClient) => Promise<T>): Promise<T> => {
    const tx = {
      rom: {
        findFirst: mock.rom.findFirst,
        create: mock.rom.create,
        update: mock.rom.update
      },
      romBinary: {
        upsert: mock.romBinary.upsert
      },
      romUploadAudit: {
        create: mock.romUploadAudit.create
      },
      emulatorBios: {
        upsert: mock.emulatorBios.upsert
      }
    } as unknown as PrismaClient;

    return callback(tx);
  };

describe("admin rom upload routes", () => {
  let app: FastifyInstance;
  const prismaMock: PrismaMock = {
    platform: { findUnique: vi.fn() },
    romBinary: { findFirst: vi.fn(), upsert: vi.fn() },
    rom: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn()
    },
    romUploadAudit: { create: vi.fn() },
    emulatorBios: { upsert: vi.fn() },
    $transaction: vi.fn()
  };

  beforeAll(async () => {
    ({ buildServer } = await import("../../server.js"));
    ({ registerRomUploadRoutes } = await import("./romUploads.js"));
  });

  beforeEach(async () => {
    vi.resetAllMocks();
    app = buildServer({ registerPrisma: false });

    prismaMock.$transaction.mockImplementation(createTransactionShim(prismaMock));

    app.decorate("prisma", prismaMock as unknown as PrismaClient);

    await app.register(async (instance) => {
      instance.addHook("preHandler", async (request, reply) => {
        await instance.requireAdmin(request, reply);
      });
      await registerRomUploadRoutes(instance);
    }, { prefix: "/admin" });

    await app.ready();

    // Silence metrics side effects in tests
    app.metrics.enabled = false;

    const storage = app.storage as unknown as {
      putRomObject: ReturnType<typeof vi.fn>;
      putBiosObject: ReturnType<typeof vi.fn>;
    };
    storage.putRomObject = vi.fn().mockResolvedValue(undefined);
    storage.putBiosObject = vi.fn().mockResolvedValue(undefined);
  });

  afterEach(async () => {
    await app.close();
  });

  it("stores new ROM uploads, metadata, and audit trail", async () => {
    prismaMock.platform.findUnique.mockResolvedValueOnce({
      id: "platform_snes",
      slug: "snes",
      name: "Super Nintendo",
      shortName: "SNES"
    });
    prismaMock.romBinary.findFirst.mockResolvedValueOnce(null);
    prismaMock.rom.findFirst.mockResolvedValueOnce(null);
    prismaMock.rom.create.mockResolvedValueOnce({
      id: "rom_1",
      platformId: "platform_snes",
      title: "Chrono Trigger"
    });
    prismaMock.romBinary.upsert.mockResolvedValueOnce({
      id: "binary_1",
      romId: "rom_1"
    });
    prismaMock.romUploadAudit.create.mockResolvedValueOnce({ id: "audit_success" });

    const token = app.jwt.sign({ sub: "admin-1", role: "ADMIN" });
    const body = Buffer.from("pretend rom archive");

    const response = await app.inject({
      method: "POST",
      url: "/admin/roms/uploads",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/octet-stream",
        "x-treaz-upload-metadata": JSON.stringify({
          clientId: "test-1",
          type: "rom",
          originalFilename: "chrono-trigger.zip",
          platformSlug: "snes",
          romTitle: "Chrono Trigger"
        })
      },
      payload: body
    });

    expect(response.statusCode).toBe(201);
    const payload = await response.json();
    expect(payload.result).toMatchObject({
      status: "success",
      romId: "rom_1",
      platformSlug: "snes",
      uploadAuditId: "audit_success",
      storageKey: "roms/snes/chrono-trigger.zip"
    });

    expect(prismaMock.platform.findUnique).toHaveBeenCalledWith({ where: { slug: "snes" } });
    expect(prismaMock.romBinary.findFirst).toHaveBeenCalled();
    expect(prismaMock.rom.create).toHaveBeenCalled();
    expect(prismaMock.romBinary.upsert).toHaveBeenCalled();
    expect(prismaMock.romUploadAudit.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        kind: "ROM",
        status: "SUCCEEDED",
        romId: "rom_1",
        platformId: "platform_snes"
      })
    });

    const storage = app.storage as unknown as { putRomObject: ReturnType<typeof vi.fn> };
    expect(storage.putRomObject).toHaveBeenCalledWith("roms/snes/chrono-trigger.zip", expect.any(Object));
  });

  it("returns duplicate status when ROM checksum already exists", async () => {
    prismaMock.platform.findUnique.mockResolvedValueOnce({
      id: "platform_snes",
      slug: "snes",
      name: "Super Nintendo",
      shortName: "SNES"
    });
    prismaMock.romBinary.findFirst.mockResolvedValueOnce({
      id: "binary_1",
      romId: "rom_existing",
      rom: { id: "rom_existing", title: "Chrono Trigger" }
    });
    prismaMock.romUploadAudit.create.mockResolvedValueOnce({ id: "audit_duplicate" });

    const token = app.jwt.sign({ sub: "admin-1", role: "ADMIN" });
    const body = Buffer.from("duplicate data");

    const response = await app.inject({
      method: "POST",
      url: "/admin/roms/uploads",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/octet-stream",
        "x-treaz-upload-metadata": JSON.stringify({
          clientId: "test-2",
          type: "rom",
          originalFilename: "chrono-trigger.zip",
          platformSlug: "snes"
        })
      },
      payload: body
    });

    expect(response.statusCode).toBe(200);
    const payload = await response.json();
    expect(payload.result).toMatchObject({
      status: "duplicate",
      romId: "rom_existing",
      uploadAuditId: "audit_duplicate",
      reason: "Duplicate ROM binary"
    });

    const storage = app.storage as unknown as { putRomObject: ReturnType<typeof vi.fn> };
    expect(storage.putRomObject).not.toHaveBeenCalled();
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
    expect(prismaMock.romUploadAudit.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        status: "FAILED",
        errorMessage: expect.stringContaining("Duplicate ROM detected"),
        romId: "rom_existing"
      })
    });
  });
});
