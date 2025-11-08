import type { FastifyBaseLogger } from "fastify";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const sendMailMock = vi.fn();
  const createTransportMock = vi.fn(() => ({ sendMail: sendMailMock }));
  const mockEnv = {
    EMAIL_PROVIDER: "smtp" as const,
    SMTP_HOST: "smtp.example.com",
    SMTP_PORT: 587,
    SMTP_SECURE: "starttls" as const,
    SMTP_USERNAME: "mailer",
    SMTP_PASSWORD: "secret",
    SMTP_FROM_EMAIL: "no-reply@example.com",
    SMTP_FROM_NAME: "TREAZRISLAND Crew",
    SMTP_ALLOW_INVALID_CERTS: false,
    PASSWORD_RESET_TTL_MS: 3_600_000,
  };

  return { sendMailMock, createTransportMock, mockEnv };
});

vi.mock("nodemailer", () => ({
  default: { createTransport: mocks.createTransportMock },
  createTransport: mocks.createTransportMock,
}));

vi.mock("../../config/env.js", () => ({
  env: mocks.mockEnv,
}));

import { createEmailService, EmailDeliveryError } from "./service.js";

describe("createEmailService", () => {
  let logger: FastifyBaseLogger & {
    info: ReturnType<typeof vi.fn>;
    error: ReturnType<typeof vi.fn>;
    child: ReturnType<typeof vi.fn>;
  };
  let childLogger: { info: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    mocks.sendMailMock.mockReset();
    mocks.createTransportMock.mockClear();

    childLogger = {
      info: vi.fn(),
      error: vi.fn(),
    };

    logger = {
      info: vi.fn(),
      error: vi.fn(),
      child: vi.fn().mockReturnValue(childLogger),
    } as unknown as FastifyBaseLogger & {
      info: ReturnType<typeof vi.fn>;
      error: ReturnType<typeof vi.fn>;
      child: ReturnType<typeof vi.fn>;
    };
  });

  it("sends password reset email via SMTP", async () => {
    mocks.sendMailMock.mockResolvedValueOnce(undefined);

    const service = createEmailService(logger);

    await service.sendPasswordReset({
      to: "pirate@example.com",
      nickname: "Mighty Pirate",
      token: "reset-token",
      expiresAt: new Date("2024-01-01T12:00:00.000Z"),
    });

    expect(mocks.createTransportMock).toHaveBeenCalledWith({
      host: "smtp.example.com",
      port: 587,
      secure: false,
      tls: { rejectUnauthorized: true },
      requireTLS: true,
      auth: { user: "mailer", pass: "secret" },
    });
    expect(mocks.sendMailMock).toHaveBeenCalledWith({
      from: { address: "no-reply@example.com", name: "TREAZRISLAND Crew" },
      to: "pirate@example.com",
      subject: "Reset your TREAZRISLAND password",
      html: expect.stringContaining("reset-token"),
      text: expect.stringContaining("reset-token"),
    });
    expect(logger.child).toHaveBeenCalledWith({
      service: "email",
      provider: "smtp",
    });
    expect(childLogger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "email.password_reset.sent",
        attempt: 1,
        to: "pirate@example.com",
      }),
      "Password reset email sent",
    );
  });

  it("retries transient failures", async () => {
    const transientError = Object.assign(new Error("timeout"), {
      responseCode: 451,
    });

    mocks.sendMailMock
      .mockRejectedValueOnce(transientError)
      .mockResolvedValueOnce(undefined);

    vi.useFakeTimers();

    const service = createEmailService(logger);

    const promise = service.sendPasswordReset({
      to: "deckhand@example.com",
      nickname: "Deckhand",
      token: "retry-token",
      expiresAt: new Date("2024-01-01T15:00:00.000Z"),
    });

    await vi.runAllTimersAsync();
    await promise;

    vi.useRealTimers();

    expect(mocks.sendMailMock).toHaveBeenCalledTimes(2);
    expect(childLogger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "email.password_reset.failed",
        retryable: true,
        attempt: 1,
      }),
      "Failed to send password reset email",
    );
    expect(childLogger.info).toHaveBeenCalledWith(
      expect.objectContaining({ attempt: 2 }),
      expect.any(String),
    );
  });

  it("throws EmailDeliveryError for non-retryable failure", async () => {
    const fatalError = Object.assign(new Error("bad credentials"), {
      code: "EAUTH",
    });

    mocks.sendMailMock.mockRejectedValueOnce(fatalError);

    const service = createEmailService(logger);

    await expect(
      service.sendPasswordReset({
        to: "captain@example.com",
        nickname: "Captain",
        token: "fatal-token",
        expiresAt: new Date("2024-01-02T00:00:00.000Z"),
      }),
    ).rejects.toBeInstanceOf(EmailDeliveryError);

    expect(mocks.sendMailMock).toHaveBeenCalledTimes(1);
    expect(childLogger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        retryable: false,
        attempt: 1,
      }),
      "Failed to send password reset email",
    );
  });
});
