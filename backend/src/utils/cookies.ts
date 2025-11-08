import { randomBytes } from "node:crypto";
import type { FastifyReply, FastifyRequest } from "fastify";

import { REFRESH_COOKIE_NAME, REFRESH_CSRF_COOKIE_NAME } from "./tokens.js";
import { env } from "../config/env.js";

const secureAttribute = env.NODE_ENV === "production" ? "; Secure" : "";
const refreshCookieSuffix = `; HttpOnly; Path=/; SameSite=Strict${secureAttribute}`;
const csrfCookieSuffix = `; Path=/; SameSite=Strict${secureAttribute}`;

export const buildRefreshCookie = (token: string, expiresAt: Date): string =>
  `${REFRESH_COOKIE_NAME}=${token}; Expires=${expiresAt.toUTCString()}${refreshCookieSuffix}`;

const buildRefreshCsrfCookie = (token: string, expiresAt: Date): string =>
  `${REFRESH_CSRF_COOKIE_NAME}=${token}; Expires=${expiresAt.toUTCString()}${csrfCookieSuffix}`;

const buildClearRefreshCookie = (): string => `${REFRESH_COOKIE_NAME}=; Max-Age=0${refreshCookieSuffix}`;
const buildClearRefreshCsrfCookie = (): string => `${REFRESH_CSRF_COOKIE_NAME}=; Max-Age=0${csrfCookieSuffix}`;

export const setRefreshCookie = (reply: FastifyReply, token: string, expiresAt: Date): void => {
  const csrfToken = randomBytes(32).toString("hex");
  reply.header("Set-Cookie", [
    buildRefreshCookie(token, expiresAt),
    buildRefreshCsrfCookie(csrfToken, expiresAt)
  ]);
};

export const clearRefreshCookie = (reply: FastifyReply): void => {
  reply.header("Set-Cookie", [buildClearRefreshCookie(), buildClearRefreshCsrfCookie()]);
};

const parseCookies = (header: string | undefined): Record<string, string> => {
  if (!header) {
    return {};
  }

  return header.split(";").reduce<Record<string, string>>((acc, part) => {
    const [name, ...rest] = part.split("=");
    if (!name || rest.length === 0) {
      return acc;
    }

    const key = name.trim();
    const value = rest.join("=").trim();
    if (key.length > 0) {
      acc[key] = decodeURIComponent(value);
    }
    return acc;
  }, {});
};

export const readRefreshTokenFromRequest = (request: FastifyRequest): string | null => {
  const cookies = parseCookies(request.headers.cookie);
  return cookies[REFRESH_COOKIE_NAME] ?? null;
};

export const readRefreshCsrfTokenFromRequest = (request: FastifyRequest): string | null => {
  const cookies = parseCookies(request.headers.cookie);
  return cookies[REFRESH_CSRF_COOKIE_NAME] ?? null;
};

export const readRefreshCsrfHeader = (request: FastifyRequest): string | null => {
  const header = request.headers["x-refresh-csrf"];
  if (!header) {
    return null;
  }
  if (Array.isArray(header)) {
    return header[0] ?? null;
  }
  if (typeof header === "string") {
    return header;
  }
  return String(header);
};
