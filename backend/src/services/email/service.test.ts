import type { FastifyBaseLogger } from "fastify";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const sendEmailMock = vi.fn();
  const serverClientCtor = vi.fn(() => ({ sendEmail: sendEmailMock }));
  const mockEnv = {
    EMAIL_PROVIDER: "postmark" as const,
    POSTMARK_SERVER_TOKEN: "server-token",
    POSTMARK_FROM_EMAIL: "no-reply@example.com",
    POSTMARK_MESSAGE_STREAM: "outbound",
    PASSWORD_RESET_TTL_MS: 3600000
  };

  return { sendEmailMock, serverClientCtor, mockEnv };
});

vi.mock("postmark", () => ({
  ServerClient: mocks.serverClientCtor
}));

vi.mock("../../config/env.js", () => ({
  env: mocks.mockEnv
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
    mocks.sendEmailMock.mockReset();
    mocks.serverClientCtor.mockClear();

    childLogger = {
      info: vi.fn(),
      error: vi.fn()
    };

    logger = {
      info: vi.fn(),
      error: vi.fn(),
      child: vi.fn().mockReturnValue(childLogger)
    } as unknown as FastifyBaseLogger & {
      info: ReturnType<typeof vi.fn>;
      error: ReturnType<typeof vi.fn>;
      child: ReturnType<typeof vi.fn>;
    };
  });

  it("sends password reset email via Postmark", async () => {
    mocks.sendEmailMock.mockResolvedValueOnce(undefined);

    const service = createEmailService(logger);

    await service.sendPasswordReset({
      to: "pirate@example.com",
      nickname: "Mighty Pirate",
      token: "reset-token",
      expiresAt: new Date("2024-01-01T12:00:00.000Z")
    });

    expect(mocks.serverClientCtor).toHaveBeenCalledWith("server-token");
    expect(mocks.sendEmailMock).toHaveBeenCalledWith({
      From: "no-reply@example.com",
      To: "pirate@example.com",
      Subject: "Reset your TREAZRISLAND password",
      HtmlBody: expect.stringContaining("reset-token"),
      TextBody: expect.stringContaining("reset-token"),
      MessageStream: "outbound"
    });
    expect(logger.child).toHaveBeenCalledWith({
      service: "email",
      provider: "postmark"
    });
    expect(childLogger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "email.password_reset.sent",
        attempt: 1,
        to: "pirate@example.com"
      }),
      "Password reset email sent"
    );
  });

  it("retries transient failures", async () => {
    const transientError = Object.assign(new Error("timeout"), {
      statusCode: 500
    });

    mocks.sendEmailMock
      .mockRejectedValueOnce(transientError)
      .mockResolvedValueOnce(undefined);

    vi.useFakeTimers();

    const service = createEmailService(logger);

    const promise = service.sendPasswordReset({
      to: "deckhand@example.com",
      nickname: "Deckhand",
      token: "retry-token",
      expiresAt: new Date("2024-01-01T15:00:00.000Z")
    });

    await vi.runAllTimersAsync();
    await promise;

    vi.useRealTimers();

    expect(mocks.sendEmailMock).toHaveBeenCalledTimes(2);
    expect(childLogger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "email.password_reset.failed",
        retryable: true,
        attempt: 1
      }),
      "Failed to send password reset email"
    );
    expect(childLogger.info).toHaveBeenCalledWith(
      expect.objectContaining({ attempt: 2 }),
      expect.any(String)
    );
  });

  it("throws EmailDeliveryError for non-retryable failure", async () => {
    const fatalError = Object.assign(new Error("bad request"), {
      statusCode: 400
    });

    mocks.sendEmailMock.mockRejectedValueOnce(fatalError);

    const service = createEmailService(logger);

    await expect(
      service.sendPasswordReset({
        to: "captain@example.com",
        nickname: "Captain",
        token: "fatal-token",
        expiresAt: new Date("2024-01-02T00:00:00.000Z")
      })
    ).rejects.toBeInstanceOf(EmailDeliveryError);

    expect(mocks.sendEmailMock).toHaveBeenCalledTimes(1);
    expect(childLogger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        retryable: false,
        attempt: 1
      }),
      "Failed to send password reset email"
    );
  });
});
