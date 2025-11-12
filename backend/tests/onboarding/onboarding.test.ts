import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import type { FastifyInstance } from "fastify";
import type { Role } from "@prisma/client";
import type {
  SettingsManager,
  ResolvedSystemSettings,
} from "../../src/plugins/settings.js";

vi.mock("argon2", () => {
  const hashMock = vi.fn().mockImplementation(async (value: string) => `hashed-${value}`);
  const verifyMock = vi
    .fn()
    .mockImplementation(async (hash: string, value: string) => hash === `hashed-${value}`);
  return {
    __esModule: true,
    default: {
      hash: hashMock,
      verify: verifyMock,
    },
  };
});

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
delete process.env.TREAZ_BOOTSTRAP_ADMIN_EMAIL;
delete process.env.TREAZ_BOOTSTRAP_ADMIN_NICKNAME;
delete process.env.TREAZ_BOOTSTRAP_ADMIN_PASSWORD;

let buildServer: typeof import("../../src/server.js").buildServer;

type MockFn = ReturnType<typeof vi.fn>;

type SetupStateRow = {
  id: number;
  setupComplete: boolean;
  steps: Record<string, unknown>;
};

type PrismaMock = {
  user: {
    count: MockFn;
    create: MockFn;
    findFirst: MockFn;
  };
  refreshTokenFamily: {
    create: MockFn;
  };
  refreshToken: {
    create: MockFn;
  };
  setupState: {
    findUnique: MockFn;
    create: MockFn;
    upsert: MockFn;
  };
  loginAudit: {
    create: MockFn;
  };
  mfaSecret: {
    update: MockFn;
  };
};

const createPrismaMock = () => {
  let storedSetupState: SetupStateRow | null = null;
  let refreshFamilyCounter = 0;
  let refreshTokenCounter = 0;

  const prisma: PrismaMock = {
    user: {
      count: vi.fn(),
      create: vi.fn(),
      findFirst: vi.fn(),
    },
    refreshTokenFamily: {
      create: vi.fn(),
    },
    refreshToken: {
      create: vi.fn(),
    },
    setupState: {
      findUnique: vi.fn().mockImplementation(async () => storedSetupState),
      create: vi
        .fn()
        .mockImplementation(async ({ data }: { data: SetupStateRow }) => {
          storedSetupState = {
            id: data.id,
            setupComplete: data.setupComplete,
            steps: data.steps,
          };
          return storedSetupState;
        }),
      upsert: vi
        .fn()
        .mockImplementation(
          async ({
            create,
            update,
          }: {
            create: SetupStateRow;
            update: { setupComplete?: boolean; steps?: Record<string, unknown> };
          }) => {
            if (!storedSetupState) {
              storedSetupState = {
                id: create.id,
                setupComplete: create.setupComplete,
                steps: create.steps,
              };
            } else {
              storedSetupState = {
                id: storedSetupState.id,
                setupComplete:
                  typeof update.setupComplete === "boolean"
                    ? update.setupComplete
                    : storedSetupState.setupComplete,
                steps: update.steps ?? storedSetupState.steps,
              };
            }
            return storedSetupState;
          },
        ),
    },
    loginAudit: {
      create: vi.fn().mockResolvedValue(undefined),
    },
    mfaSecret: {
      update: vi.fn(),
    },
  } satisfies PrismaMock;

  prisma.refreshTokenFamily.create.mockImplementation(async ({ data }: { data: { userId: string } }) => ({
    id: `family_${data.userId}_${refreshFamilyCounter += 1}`,
    userId: data.userId,
  }));

  prisma.refreshToken.create.mockImplementation(
    async ({ data }: { data: { userId: string; familyId: string; expiresAt: Date } }) => ({
      id: `refresh_${refreshTokenCounter += 1}`,
      userId: data.userId,
      familyId: data.familyId,
      tokenHash: "hash",
      createdAt: new Date(),
      expiresAt: data.expiresAt,
      revokedAt: null,
      revokedReason: null,
    }),
  );

  return prisma;
};

describe("onboarding routes", () => {
  let app: FastifyInstance;
  let prisma: PrismaMock;
  let createdUser: {
    id: string;
    email: string;
    nickname: string;
    passwordHash: string;
    role: Role;
  } | null;
  let settingsManager: SettingsManager;
  let settingsUpdateMock: MockFn;
  let currentSettings: ResolvedSystemSettings;

  beforeAll(async () => {
    ({ buildServer } = await import("../../src/server.js"));
  });

  beforeEach(async () => {
    createdUser = null;
    prisma = createPrismaMock();

    prisma.user.count.mockImplementation(async () => (createdUser ? 1 : 0));

    prisma.user.create.mockImplementation(
      async ({ data }: { data: { email: string; nickname: string; passwordHash: string; role: Role } }) => {
        createdUser = {
          id: "user_1",
          email: data.email,
          nickname: data.nickname,
          passwordHash: data.passwordHash,
          role: data.role,
        };
        const now = new Date();
        return {
          ...createdUser,
          displayName: data.nickname,
          createdAt: now,
          updatedAt: now,
        };
      },
    );

    prisma.user.findFirst.mockImplementation(
      async ({ where }: { where: { OR: Array<{ email?: string; nickname?: string }> } }) => {
        if (!createdUser) {
          return null;
        }
        const matches = where.OR.some(
          (condition) =>
            (condition.email && condition.email.toLowerCase() === createdUser!.email.toLowerCase()) ||
            (condition.nickname && condition.nickname === createdUser!.nickname),
        );
        if (!matches) {
          return null;
        }
        const now = new Date();
        return {
          ...createdUser,
          createdAt: now,
          updatedAt: now,
          displayName: createdUser.nickname,
          mfaSecrets: [],
        };
      },
    );

    app = buildServer({ registerPrisma: false });
    app.decorate("prisma", prisma as unknown as typeof app.prisma);

    await app.ready();

    (app.authenticate as unknown) = vi.fn(async (request) => {
      request.user = { sub: createdUser?.id ?? "user_1", role: "ADMIN" };
    });
    (app.requireAdmin as unknown) = vi.fn(async () => {});

    app.mfaService = {
      generateSecret: vi.fn(),
      buildOtpAuthUri: vi.fn(),
      verifyTotp: vi.fn(),
      findMatchingRecoveryCode: vi.fn().mockResolvedValue(null),
      encryptSecret: vi.fn((value: string) => value),
      decryptSecret: vi.fn().mockReturnValue({ secret: "secret", needsRotation: false }),
    };

    currentSettings = {
      systemProfile: {
        instanceName: "TREAZRISLAND",
        timezone: "UTC",
      },
      storage: {
        driver: "filesystem",
        localRoot: "/var/treaz/storage",
        bucketAssets: "assets",
        bucketRoms: "roms",
        bucketBios: "bios",
      },
      email: { provider: "none" },
      metrics: { enabled: false, allowedCidrs: [], token: undefined },
      screenscraper: {},
      personalization: {},
    };

    settingsUpdateMock = vi.fn().mockResolvedValue(currentSettings);

    settingsManager = {
      get: () => currentSettings,
      reload: async () => currentSettings,
      update: settingsUpdateMock,
    } satisfies SettingsManager;

    (app.settings as SettingsManager) = settingsManager;
  });

  afterEach(async () => {
    await app.close();
    vi.clearAllMocks();
  });

  it("walks through onboarding and authentication lifecycle", async () => {
    const agent = request(app);

    const statusResponse = await agent.get("/onboarding/status");
    expect(statusResponse.status).toBe(200);
    expect(statusResponse.body.needsSetup).toBe(true);
    expect(statusResponse.body.pendingSteps).toContain("first-admin");

    const adminResponse = await agent.post("/onboarding/admin").send({
      email: "admin@example.com",
      nickname: "captain",
      password: "Secret1234",
    });

    expect(adminResponse.status).toBe(201);
    expect(adminResponse.body.user).toMatchObject({
      id: "user_1",
      email: "admin@example.com",
      nickname: "captain",
      role: "ADMIN",
    });
    expect(typeof adminResponse.body.accessToken).toBe("string");
    const adminCookies = adminResponse.headers["set-cookie"];
    const adminCookieValue = Array.isArray(adminCookies)
      ? adminCookies.join(";")
      : typeof adminCookies === "string"
        ? adminCookies
        : "";
    expect(adminCookieValue).toContain("HttpOnly");

    const postAdminStatus = await agent.get("/onboarding/status");
    expect(postAdminStatus.status).toBe(200);
    expect(postAdminStatus.body.pendingSteps).not.toContain("first-admin");
    expect(postAdminStatus.body.pendingSteps).toContain("system-profile");

    const systemProfileResponse = await agent
      .patch("/onboarding/steps/system-profile")
      .set("authorization", "Bearer token")
      .send({
        status: "COMPLETED",
        settings: {
          systemProfile: { instanceName: "Vault of Wonders", timezone: "America/New_York" },
          storage: {
            driver: "filesystem",
            localRoot: "/srv/treaz",
            bucketAssets: "assets",
            bucketRoms: "roms",
          },
        },
      });

    expect(systemProfileResponse.status).toBe(200);
    expect(systemProfileResponse.body.setupComplete).toBe(false);
    expect(systemProfileResponse.body.steps["system-profile"].status).toBe("COMPLETED");
    expect(settingsUpdateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        systemProfile: expect.objectContaining({ instanceName: "Vault of Wonders" }),
        storage: expect.objectContaining({ localRoot: "/srv/treaz" }),
      }),
      expect.objectContaining({ actorId: "user_1" }),
    );

    const integrationsResponse = await agent
      .patch("/onboarding/steps/integrations")
      .set("authorization", "Bearer token")
      .send({ status: "SKIPPED" });

    expect(integrationsResponse.status).toBe(200);
    expect(integrationsResponse.body.steps.integrations.status).toBe("SKIPPED");
    expect(integrationsResponse.body.setupComplete).toBe(false);

    const personalizationResponse = await agent
      .patch("/onboarding/steps/personalization")
      .set("authorization", "Bearer token")
      .send({
        status: "COMPLETED",
        settings: { personalization: { theme: "midnight-harbor" } },
      });

    expect(personalizationResponse.status).toBe(200);
    expect(personalizationResponse.body.steps.personalization.status).toBe("COMPLETED");
    expect(personalizationResponse.body.setupComplete).toBe(true);

    const finalStatus = await agent.get("/onboarding/status");
    expect(finalStatus.status).toBe(200);
    expect(finalStatus.body.needsSetup).toBe(false);
    expect(finalStatus.body.setupComplete).toBe(true);

    const loginResponse = await agent.post("/auth/login").send({
      identifier: "captain",
      password: "Secret1234",
    });

    expect(loginResponse.status).toBe(200);
    expect(loginResponse.body.user).toMatchObject({
      id: "user_1",
      email: "admin@example.com",
      nickname: "captain",
    });
    const loginCookies = loginResponse.headers["set-cookie"];
    const loginCookieValue = Array.isArray(loginCookies)
      ? loginCookies.join(";")
      : typeof loginCookies === "string"
        ? loginCookies
        : "";
    expect(loginCookieValue).toContain("treaz_refresh");
  });
});
