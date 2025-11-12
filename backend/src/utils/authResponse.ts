import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

import { clearRefreshCookie, readRefreshCsrfHeader, readRefreshCsrfTokenFromRequest, setRefreshCookie } from "./cookies.js";
import { LoginAuditEvent } from "./prisma-enums.js";
import type { SessionTokensResult } from "./tokens.js";

type LoginAuditEventValue = (typeof LoginAuditEvent)[keyof typeof LoginAuditEvent];

export interface LoginAuditPayload {
  userId?: string;
  emailAttempted?: string;
  event: LoginAuditEventValue;
  reason?: string;
}

export const recordLoginAudit = async (
  app: FastifyInstance,
  request: FastifyRequest,
  payload: LoginAuditPayload
): Promise<void> => {
  try {
    await app.prisma.loginAudit.create({
      data: {
        userId: payload.userId,
        emailAttempted: payload.emailAttempted,
        event: payload.event,
        reason: payload.reason ?? null,
        ipAddress: request.ip,
        userAgent: request.headers["user-agent"] ?? null
      }
    });
  } catch (error) {
    request.log.warn({ err: error }, "Failed to record login audit event");
  }
};

export const verifyRefreshCsrf = (
  request: FastifyRequest,
  reply: FastifyReply
): boolean => {
  const csrfCookie = readRefreshCsrfTokenFromRequest(request);
  const csrfHeader = readRefreshCsrfHeader(request);
  if (!csrfCookie || !csrfHeader || csrfCookie !== csrfHeader) {
    clearRefreshCookie(reply);
    return false;
  }
  return true;
};

export const applySessionTokens = (
  reply: FastifyReply,
  tokens: SessionTokensResult
): void => {
  setRefreshCookie(reply, tokens.refreshToken, tokens.refreshExpiresAt);
};
