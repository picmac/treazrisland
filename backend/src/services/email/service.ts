import type { FastifyBaseLogger } from "fastify";

export interface PasswordResetPayload {
  to: string;
  nickname: string;
  token: string;
  expiresAt: Date;
}

export interface EmailService {
  sendPasswordReset(payload: PasswordResetPayload): Promise<void>;
}

class LoggingEmailService implements EmailService {
  constructor(private readonly logger: FastifyBaseLogger) {}

  async sendPasswordReset(payload: PasswordResetPayload): Promise<void> {
    this.logger.info(
      {
        to: payload.to,
        nickname: payload.nickname,
        expiresAt: payload.expiresAt.toISOString()
      },
      "Password reset email queued"
    );
  }
}

export const createEmailService = (logger: FastifyBaseLogger): EmailService =>
  new LoggingEmailService(logger);
