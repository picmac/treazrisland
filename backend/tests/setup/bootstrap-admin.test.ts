import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { FastifyInstance } from "fastify";
import type { SetupStateView } from "../../src/services/setup/state.js";

vi.mock("argon2", () => {
  const hashMock = vi.fn().mockImplementation(async (value: string) => `hashed-${value}`);
  return {
    __esModule: true,
    default: {
      hash: hashMock,
      argon2id: "argon2id",
    },
  };
});

const ensureBaseEnv = () => {
  process.env.NODE_ENV = "test";
  process.env.PORT = process.env.PORT ?? "0";
  process.env.JWT_SECRET = "this-is-a-test-secret-at-least-32";
  process.env.JWT_ACCESS_TTL = "15m";
  process.env.JWT_REFRESH_TTL = "30d";
  process.env.USER_INVITE_EXPIRY_HOURS = "24";
  process.env.STORAGE_DRIVER = "filesystem";
  process.env.STORAGE_BUCKET_ASSETS = "assets";
  process.env.STORAGE_BUCKET_ROMS = "roms";
  process.env.STORAGE_BUCKET_BIOS = "bios";
  process.env.ROM_UPLOAD_MAX_BYTES = `${1024 * 1024}`;
};

describe("bootstrap admin automation", () => {
  let app: FastifyInstance | null = null;

  beforeEach(() => {
    vi.resetModules();
    ensureBaseEnv();
    delete process.env.TREAZ_BOOTSTRAP_ADMIN_EMAIL;
    delete process.env.TREAZ_BOOTSTRAP_ADMIN_NICKNAME;
    delete process.env.TREAZ_BOOTSTRAP_ADMIN_PASSWORD;
  });

  afterEach(async () => {
    if (app) {
      await app.close();
      app = null;
    }
    vi.clearAllMocks();
    delete process.env.TREAZ_BOOTSTRAP_ADMIN_EMAIL;
    delete process.env.TREAZ_BOOTSTRAP_ADMIN_NICKNAME;
    delete process.env.TREAZ_BOOTSTRAP_ADMIN_PASSWORD;
  });

  it("creates the initial admin when credentials are configured", async () => {
    process.env.TREAZ_BOOTSTRAP_ADMIN_EMAIL = "captain@example.com";
    process.env.TREAZ_BOOTSTRAP_ADMIN_NICKNAME = "captain";
    process.env.TREAZ_BOOTSTRAP_ADMIN_PASSWORD = "Secret1234";

    const stateModule = await import("../../src/services/setup/state.js");
    const updateSetupStepSpy = vi
      .spyOn(stateModule, "updateSetupStep")
      .mockResolvedValue({
        setupComplete: false,
        steps: {} as SetupStateView["steps"],
      });

    const { buildServer } = await import("../../src/server.js");
    const server = buildServer({ registerPrisma: false });
    app = server;

    const childLogger = {
      info: vi.fn(),
      debug: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
    };
    const childSpy = vi
      .spyOn(
        server.log as unknown as {
          child: (bindings: Record<string, unknown>) => unknown;
        },
        "child",
      )
      .mockReturnValue(
        childLogger as unknown as ReturnType<typeof server.log.child>,
      );

    const prismaMock = {
      user: {
        count: vi.fn().mockResolvedValueOnce(0).mockResolvedValue(1),
        create: vi.fn().mockResolvedValue({
          id: "user_1",
          email: "captain@example.com",
          nickname: "captain",
          role: "ADMIN",
        }),
      },
    } as const;

    server.decorate("prisma", prismaMock as never);

    await server.ready();

    expect(prismaMock.user.count).toHaveBeenCalledTimes(1);
    expect(prismaMock.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          email: "captain@example.com",
          nickname: "captain",
          passwordHash: "hashed-Secret1234",
          role: "ADMIN",
        }),
      }),
    );
    const updateArgs = updateSetupStepSpy.mock.calls[0];
    expect(updateArgs?.[0]).toBe(prismaMock);
    expect(updateArgs?.[1]).toBe("first-admin");
    expect(updateArgs?.[2]).toBe("COMPLETED");
    expect(updateArgs?.[3]).toMatchObject({ userId: "user_1", source: "bootstrap" });
    expect(childSpy).toHaveBeenCalledWith({ context: "bootstrap-admin" });
    expect(childLogger.info).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "user_1" }),
      "Initial admin account bootstrapped from environment credentials",
    );
  });

  it("skips bootstrapping when credentials are absent", async () => {
    const stateModule = await import("../../src/services/setup/state.js");
    const updateSetupStepSpy = vi.spyOn(stateModule, "updateSetupStep");

    const { buildServer } = await import("../../src/server.js");
    const server = buildServer({ registerPrisma: false });
    app = server;

    const childLogger = {
      info: vi.fn(),
      debug: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
    };
    const childSpy = vi
      .spyOn(
        server.log as unknown as {
          child: (bindings: Record<string, unknown>) => unknown;
        },
        "child",
      )
      .mockReturnValue(
        childLogger as unknown as ReturnType<typeof server.log.child>,
      );

    const prismaMock = {
      user: {
        count: vi.fn(),
        create: vi.fn(),
      },
    } as const;

    server.decorate("prisma", prismaMock as never);

    await server.ready();

    expect(prismaMock.user.count).not.toHaveBeenCalled();
    expect(prismaMock.user.create).not.toHaveBeenCalled();
    expect(updateSetupStepSpy).not.toHaveBeenCalled();
    expect(childSpy).toHaveBeenCalledWith({ context: "bootstrap-admin" });
    expect(childLogger.debug).toHaveBeenCalledWith(
      "Skipping admin bootstrap: TREAZ_BOOTSTRAP_ADMIN_* variables are not configured",
    );
  });
});

