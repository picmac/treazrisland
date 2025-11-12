import Fastify from "fastify";
import request from "supertest";
import { describe, beforeAll, beforeEach, afterEach, it, expect, vi } from "vitest";
import argon2 from "argon2";
import type { FastifyInstance } from "fastify";

import { registerAuthRoutes } from "../auth.js";
import { LoginAuditEvent } from "../../utils/prisma-enums.js";
import * as tokens from "../../utils/tokens.js";

describe("POST /auth/login", () => {
  let app: FastifyInstance;
  let prismaMock: {
    user: { findFirst: ReturnType<typeof vi.fn> };
    loginAudit: { create: ReturnType<typeof vi.fn> };
    mfaSecret: { update: ReturnType<typeof vi.fn> };
  };
  let mfaServiceMock: {
    decryptSecret: ReturnType<typeof vi.fn>;
    verifyTotp: ReturnType<typeof vi.fn>;
    findMatchingRecoveryCode: ReturnType<typeof vi.fn>;
    encryptSecret: ReturnType<typeof vi.fn>;
  };
  let passwordHash: string;

  beforeAll(async () => {
    passwordHash = await argon2.hash("password123", { type: argon2.argon2id });
  });

  beforeEach(async () => {
    app = Fastify();

    prismaMock = {
      user: { findFirst: vi.fn() },
      loginAudit: { create: vi.fn().mockResolvedValue({}) },
      mfaSecret: { update: vi.fn().mockResolvedValue({}) }
    };

    mfaServiceMock = {
      decryptSecret: vi.fn(),
      verifyTotp: vi.fn(),
      findMatchingRecoveryCode: vi.fn(),
      encryptSecret: vi.fn()
    };

    app.decorate("prisma", prismaMock as unknown);
    app.decorate("mfaService", mfaServiceMock as unknown);
    app.decorate("jwt", { sign: vi.fn().mockReturnValue("access-token") });

    await registerAuthRoutes(app);
  });

  afterEach(async () => {
    await app.close();
    vi.restoreAllMocks();
  });

  it("returns 401 when credentials do not match a user", async () => {
    prismaMock.user.findFirst.mockResolvedValue(null);

    const response = await request(app)
      .post("/auth/login")
      .send({ identifier: "missing@example.com", password: "password123" });

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ message: "Invalid credentials" });
    expect(prismaMock.loginAudit.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          emailAttempted: "missing@example.com",
          event: LoginAuditEvent.FAILURE,
          reason: "user_not_found"
        })
      })
    );
  });

  it("prompts for MFA when an active secret exists", async () => {
    prismaMock.user.findFirst.mockResolvedValue({
      id: "user-1",
      email: "user@example.com",
      nickname: "pirate",
      role: "PLAYER",
      passwordHash,
      mfaSecrets: [
        {
          id: "secret-1",
          secret: "encrypted",
          recoveryCodes: "",
          disabledAt: null,
          confirmedAt: new Date()
        }
      ]
    });

    const response = await request(app)
      .post("/auth/login")
      .send({ identifier: "user@example.com", password: "password123" });

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      message: "MFA challenge required",
      mfaRequired: true
    });
    expect(prismaMock.loginAudit.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          event: LoginAuditEvent.MFA_REQUIRED,
          reason: "challenge"
        })
      })
    );
    expect(mfaServiceMock.decryptSecret).not.toHaveBeenCalled();
  });

  it("issues tokens and rotates MFA secret when TOTP succeeds", async () => {
    const expiresAt = new Date("2030-01-01T00:00:00.000Z");
    const issueSpy = vi
      .spyOn(tokens, "issueSessionTokens")
      .mockResolvedValue({
        accessToken: "issued-access",
        refreshToken: "refresh-token",
        refreshExpiresAt: expiresAt,
        familyId: "family-1"
      });

    prismaMock.user.findFirst.mockResolvedValue({
      id: "user-2",
      email: "totp@example.com",
      nickname: "totp-user",
      role: "PLAYER",
      passwordHash,
      mfaSecrets: [
        {
          id: "secret-2",
          secret: "encrypted-secret",
          recoveryCodes: "",
          disabledAt: null,
          confirmedAt: new Date()
        }
      ]
    });

    mfaServiceMock.decryptSecret.mockReturnValue({
      secret: "PLAIN-OTP",
      needsRotation: true
    });
    mfaServiceMock.verifyTotp.mockResolvedValue(true);
    mfaServiceMock.encryptSecret.mockReturnValue("ROTATED");

    const response = await request(app)
      .post("/auth/login")
      .send({ identifier: "totp-user", password: "password123", mfaCode: "123456" });

    expect(response.status).toBe(200);
    expect(issueSpy).toHaveBeenCalled();
    expect(prismaMock.loginAudit.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ event: LoginAuditEvent.SUCCESS })
      })
    );
    expect(prismaMock.mfaSecret.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "secret-2" },
        data: expect.objectContaining({
          secret: "ROTATED",
          rotatedAt: expect.any(Date)
        })
      })
    );
    expect(response.body).toMatchObject({
      user: {
        id: "user-2",
        email: "totp@example.com",
        nickname: "totp-user",
        role: "PLAYER"
      },
      accessToken: "issued-access",
      refreshExpiresAt: expiresAt.toISOString()
    });
    expect(response.headers["set-cookie"]).toEqual(
      expect.arrayContaining([expect.stringContaining("treaz_refresh=refresh-token")])
    );
  });
});
