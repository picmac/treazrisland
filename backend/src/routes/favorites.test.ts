import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import type { FastifyInstance } from "fastify";
import type { PrismaClient } from "@prisma/client";
import prisma from "@prisma/client";

const { Prisma } = prisma;

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

let buildServer: typeof import("../server.js").buildServer;
let registerFavoriteRoutes: typeof import("./favorites.js").registerFavoriteRoutes;

type PrismaMock = {
  userRomFavorite: {
    findMany: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    deleteMany: ReturnType<typeof vi.fn>;
  };
};

beforeAll(async () => {
  ({ buildServer } = await import("../server.js"));
  ({ registerFavoriteRoutes } = await import("./favorites.js"));
});

describe("favorites routes", () => {
  let app: FastifyInstance;
  const prismaMock: PrismaMock = {
    userRomFavorite: {
      findMany: vi.fn(),
      create: vi.fn(),
      deleteMany: vi.fn()
    }
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    app = buildServer({ registerPrisma: false });
    prismaMock.userRomFavorite.findMany.mockResolvedValue([]);
    prismaMock.userRomFavorite.create.mockResolvedValue({
      userId: "user_1",
      romId: "rom_1",
      createdAt: new Date()
    });
    prismaMock.userRomFavorite.deleteMany.mockResolvedValue({ count: 1 });
    app.decorate("prisma", prismaMock as unknown as PrismaClient);
    await app.register(async (instance) => {
      await registerFavoriteRoutes(instance);
    });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  it("requires authentication", async () => {
    const response = await request(app).get("/favorites");
    expect(response.status).toBe(401);
  });

  it("returns the caller's favorites", async () => {
    const createdAt = new Date("2025-01-01T00:00:00Z");
    prismaMock.userRomFavorite.findMany.mockResolvedValueOnce([
      { userId: "user_1", romId: "rom_2", createdAt }
    ]);

    const token = app.jwt.sign({ sub: "user_1", role: "USER" });
    const response = await request(app)
      .get("/favorites")
      .set("authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      favorites: [{ romId: "rom_2", createdAt: createdAt.toISOString() }]
    });
    expect(prismaMock.userRomFavorite.findMany).toHaveBeenCalledWith({
      where: { userId: "user_1" },
      orderBy: { createdAt: "desc" }
    });
  });

  it("validates rom identifier on create", async () => {
    const token = app.jwt.sign({ sub: "user_1", role: "USER" });
    const response = await request(app)
      .post("/favorites/%20")
      .set("authorization", `Bearer ${token}`);

    expect(response.status).toBe(400);
  });

  it("creates a favorite entry", async () => {
    const token = app.jwt.sign({ sub: "user_1", role: "USER" });
    const response = await request(app)
      .post("/favorites/rom_1")
      .set("authorization", `Bearer ${token}`);

    expect(response.status).toBe(201);
    expect(prismaMock.userRomFavorite.create).toHaveBeenCalledWith({
      data: { userId: "user_1", romId: "rom_1" }
    });
  });

  it("silently accepts duplicates", async () => {
    prismaMock.userRomFavorite.create.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError("duplicate", {
        code: "P2002",
        clientVersion: "test"
      })
    );

    const token = app.jwt.sign({ sub: "user_1", role: "USER" });
    const response = await request(app)
      .post("/favorites/rom_1")
      .set("authorization", `Bearer ${token}`);

    expect(response.status).toBe(204);
  });

  it("returns 404 when rom is missing", async () => {
    prismaMock.userRomFavorite.create.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError("missing", {
        code: "P2003",
        clientVersion: "test"
      })
    );

    const token = app.jwt.sign({ sub: "user_1", role: "USER" });
    const response = await request(app)
      .post("/favorites/rom_missing")
      .set("authorization", `Bearer ${token}`);

    expect(response.status).toBe(404);
  });

  it("validates rom identifier on delete", async () => {
    const token = app.jwt.sign({ sub: "user_1", role: "USER" });
    const response = await app.inject({
      method: "DELETE",
      url: "/favorites/%20",
      headers: { authorization: `Bearer ${token}` }
    });

    expect(response.statusCode).toBe(400);
  });

  it("removes a favorite entry", async () => {
    const token = app.jwt.sign({ sub: "user_1", role: "USER" });
    const response = await app.inject({
      method: "DELETE",
      url: "/favorites/rom_1",
      headers: { authorization: `Bearer ${token}` }
    });

    expect(response.statusCode).toBe(204);
    expect(prismaMock.userRomFavorite.deleteMany).toHaveBeenCalledWith({
      where: { userId: "user_1", romId: "rom_1" }
    });
  });
});
