import type { FastifyBaseLogger } from "fastify";
import { ServerClient } from "postmark";
import type { EmailSettings } from "../../plugins/settings.js";
import { env } from "../../config/env.js";

export interface PasswordResetPayload {
  to: string;
  nickname: string;
  token: string;
  expiresAt: Date;
}

export interface EmailService {
  sendPasswordReset(payload: PasswordResetPayload): Promise<void>;
}

export class EmailDeliveryError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message);
    this.name = "EmailDeliveryError";
    if (options?.cause !== undefined) {
      (this as Error & { cause?: unknown }).cause = options.cause;
    }
  }
}

const RETRYABLE_STATUS_CODES = new Set([408, 409, 429, 500, 502, 503, 504]);
const MAX_ATTEMPTS = 3;

const sleep = (durationMs: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, durationMs));

const errorForLog = (error: unknown) => {
  if (error instanceof Error) {
    const statusCode = (error as { statusCode?: number; StatusCode?: number })
      .statusCode ?? (error as { StatusCode?: number }).StatusCode;
    const code = (error as { code?: number | string; Code?: number | string })
      .code ?? (error as { Code?: number | string }).Code;

    return {
      name: error.name,
      message: error.message,
      statusCode,
      code
    };
  }

  return { value: error };
};

const isRetryableError = (error: unknown): boolean => {
  if (!error || typeof error !== "object") {
    return false;
  }

  const statusCode = (error as { statusCode?: number; StatusCode?: number })
    .statusCode ?? (error as { StatusCode?: number }).StatusCode;

  if (typeof statusCode === "number") {
    return RETRYABLE_STATUS_CODES.has(statusCode);
  }

  const isTimeout =
    (error as { code?: string }).code === "ETIMEDOUT" ||
    (error as { name?: string }).name === "TimeoutError";

  return isTimeout;
};

const passwordResetSubject = "Reset your TREAZRISLAND password";

const buildPasswordResetBodies = (payload: PasswordResetPayload) => {
  const ttlMinutes = Math.round(env.PASSWORD_RESET_TTL_MS / 60000);
  const htmlBody = `
    <p>Ahoy ${payload.nickname},</p>
    <p>A password reset was requested for your TREAZRISLAND account.</p>
    <p>Use the token below to reset your password. It expires at <strong>${payload.expiresAt.toISOString()}</strong>.</p>
    <p style="font-family: monospace; font-size: 16px;">${payload.token}</p>
    <p>If you didn't ask for this, you can ignore this message. The token will expire in approximately ${ttlMinutes} minutes.</p>
    <p>Stay sharp,<br/>The TREAZRISLAND crew</p>
  `;

  const textBody = [
    `Ahoy ${payload.nickname},`,
    "",
    "A password reset was requested for your TREAZRISLAND account.",
    "Use the token below to reset your password.",
    `Token: ${payload.token}`,
    `Expires at: ${payload.expiresAt.toISOString()} (about ${ttlMinutes} minutes)`,
    "",
    "If you didn't ask for this, ignore this message and the token will expire.",
    "",
    "Stay sharp,",
    "The TREAZRISLAND crew"
  ].join("\n");

  return { htmlBody, textBody };
};

class PostmarkEmailService implements EmailService {
  constructor(
    private readonly client: ServerClient,
    private readonly logger: FastifyBaseLogger,
    private readonly fromEmail: string,
    private readonly messageStream?: string
  ) {}

  async sendPasswordReset(payload: PasswordResetPayload): Promise<void> {
    const { htmlBody, textBody } = buildPasswordResetBodies(payload);

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
      try {
        await this.client.sendEmail({
          From: this.fromEmail,
          To: payload.to,
          Subject: passwordResetSubject,
          HtmlBody: htmlBody,
          TextBody: textBody,
          MessageStream: this.messageStream
        });

        this.logger.info(
          {
            event: "email.password_reset.sent",
            provider: "postmark",
            to: payload.to,
            attempt
          },
          "Password reset email sent"
        );

        return;
      } catch (error) {
        const shouldRetry = attempt < MAX_ATTEMPTS && isRetryableError(error);

        this.logger.error(
          {
            event: "email.password_reset.failed",
            provider: "postmark",
            to: payload.to,
            attempt,
            retryable: shouldRetry,
            error: errorForLog(error)
          },
          "Failed to send password reset email"
        );

        if (!shouldRetry) {
          throw new EmailDeliveryError("Unable to send password reset email", {
            cause: error
          });
        }

        await sleep(200 * 2 ** (attempt - 1));
      }
    }

    throw new EmailDeliveryError("Unable to send password reset email");
  }
}

const resolveEmailSettings = (settings?: EmailSettings): EmailSettings => {
  if (settings) {
    return settings;
  }

  if (env.EMAIL_PROVIDER === "postmark") {
    return {
      provider: "postmark",
      postmark: {
        serverToken: env.POSTMARK_SERVER_TOKEN!,
        fromEmail: env.POSTMARK_FROM_EMAIL!,
        messageStream: env.POSTMARK_MESSAGE_STREAM ?? undefined,
      },
    };
  }

  return { provider: "none" };
};

export const createEmailService = (
  logger: FastifyBaseLogger,
  settings?: EmailSettings,
): EmailService => {
  const effectiveSettings = resolveEmailSettings(settings);

  if (
    effectiveSettings.provider !== "postmark" ||
    !effectiveSettings.postmark
  ) {
    return {
      async sendPasswordReset() {
        throw new EmailDeliveryError(
          "Email provider is not configured for password resets",
        );
      },
    };
  }

  const client = new ServerClient(effectiveSettings.postmark.serverToken);
  const serviceLogger = logger.child({ service: "email", provider: "postmark" });

  return new PostmarkEmailService(
    client,
    serviceLogger,
    effectiveSettings.postmark.fromEmail,
    effectiveSettings.postmark.messageStream,
  );
};
