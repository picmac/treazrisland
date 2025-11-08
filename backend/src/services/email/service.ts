import type { FastifyBaseLogger } from "fastify";
import nodemailer, { type Transporter } from "nodemailer";
import type SMTPTransport from "nodemailer/lib/smtp-transport";
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

const RETRYABLE_SMTP_CODES = new Set([421, 450, 451, 452, 454]);
const RETRYABLE_NETWORK_CODES = new Set([
  "ETIMEDOUT",
  "ESOCKET",
  "ECONNRESET",
  "EAI_AGAIN",
  "ETIME",
]);
const MAX_ATTEMPTS = 3;

const sleep = (durationMs: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, durationMs));

const errorForLog = (error: unknown) => {
  if (error instanceof Error) {
    const statusCode = (error as { statusCode?: number; StatusCode?: number })
      .statusCode ?? (error as { StatusCode?: number }).StatusCode;
    const code = (error as { code?: number | string; Code?: number | string })
      .code ?? (error as { Code?: number | string }).Code;
    const responseCode = (error as { responseCode?: number }).responseCode;
    const command = (error as { command?: string }).command;

    return {
      name: error.name,
      message: error.message,
      statusCode,
      code,
      responseCode,
      command,
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

  if (typeof statusCode === "number" && statusCode >= 500) {
    return true;
  }

  const responseCode = (error as { responseCode?: number }).responseCode;
  if (typeof responseCode === "number") {
    if (responseCode >= 500) {
      return true;
    }

    if (RETRYABLE_SMTP_CODES.has(responseCode)) {
      return true;
    }
  }

  const code = (error as { code?: string }).code;
  if (typeof code === "string" && RETRYABLE_NETWORK_CODES.has(code)) {
    return true;
  }

  const name = (error as { name?: string }).name;
  return name === "TimeoutError";
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

class SmtpEmailService implements EmailService {
  constructor(
    private readonly transporter: Transporter<SMTPTransport.SentMessageInfo>,
    private readonly logger: FastifyBaseLogger,
    private readonly from: { address: string; name?: string },
  ) {}

  async sendPasswordReset(payload: PasswordResetPayload): Promise<void> {
    const { htmlBody, textBody } = buildPasswordResetBodies(payload);

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
      try {
        await this.transporter.sendMail({
          from: this.from,
          to: payload.to,
          subject: passwordResetSubject,
          html: htmlBody,
          text: textBody,
        });

        this.logger.info(
          {
            event: "email.password_reset.sent",
            provider: "smtp",
            to: payload.to,
            attempt,
          },
          "Password reset email sent",
        );

        return;
      } catch (error) {
        const shouldRetry = attempt < MAX_ATTEMPTS && isRetryableError(error);

        this.logger.error(
          {
            event: "email.password_reset.failed",
            provider: "smtp",
            to: payload.to,
            attempt,
            retryable: shouldRetry,
            error: errorForLog(error),
          },
          "Failed to send password reset email",
        );

        if (!shouldRetry) {
          throw new EmailDeliveryError("Unable to send password reset email", {
            cause: error,
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

  if (env.EMAIL_PROVIDER === "smtp") {
    return {
      provider: "smtp",
      smtp: {
        host: env.SMTP_HOST!,
        port: env.SMTP_PORT,
        secure: env.SMTP_SECURE,
        fromEmail: env.SMTP_FROM_EMAIL!,
        fromName: env.SMTP_FROM_NAME ?? undefined,
        allowInvalidCerts: env.SMTP_ALLOW_INVALID_CERTS,
        auth:
          env.SMTP_USERNAME && env.SMTP_PASSWORD
            ? {
                username: env.SMTP_USERNAME,
                password: env.SMTP_PASSWORD,
              }
            : undefined,
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

  if (effectiveSettings.provider !== "smtp" || !effectiveSettings.smtp) {
    return {
      async sendPasswordReset() {
        throw new EmailDeliveryError(
          "Email provider is not configured for password resets",
        );
      },
    };
  }

  const { smtp } = effectiveSettings;
  const transportOptions: SMTPTransport.Options = {
    host: smtp.host,
    port: smtp.port,
    secure: smtp.secure === "implicit",
    tls: { rejectUnauthorized: !smtp.allowInvalidCerts },
  };

  if (smtp.secure === "starttls") {
    transportOptions.secure = false;
    transportOptions.requireTLS = true;
  }

  if (smtp.secure === "none") {
    transportOptions.secure = false;
    transportOptions.requireTLS = false;
  }

  if (smtp.auth) {
    transportOptions.auth = {
      user: smtp.auth.username,
      pass: smtp.auth.password,
    };
  }

  const transporter = nodemailer.createTransport(transportOptions);
  const serviceLogger = logger.child({ service: "email", provider: "smtp" });

  return new SmtpEmailService(transporter, serviceLogger, {
    address: smtp.fromEmail,
    name: smtp.fromName ?? undefined,
  });
};
