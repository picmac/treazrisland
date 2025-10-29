import type { FastifyReply, FastifyRequest } from "fastify";
import { REFRESH_COOKIE_NAME } from "./tokens.js";
import { env } from "../config/env.js";

const secureAttribute = env.NODE_ENV === "production" ? "; Secure" : "";
const cookieSuffix = `; HttpOnly; Path=/; SameSite=Lax${secureAttribute}`;

export const buildRefreshCookie = (token: string, expiresAt: Date): string =>
  `${REFRESH_COOKIE_NAME}=${token}; Expires=${expiresAt.toUTCString()}${cookieSuffix}`;

export const buildClearCookie = (): string => `${REFRESH_COOKIE_NAME}=; Max-Age=0${cookieSuffix}`;

export const setRefreshCookie = (reply: FastifyReply, token: string, expiresAt: Date): void => {
  reply.header("Set-Cookie", buildRefreshCookie(token, expiresAt));
};

export const clearRefreshCookie = (reply: FastifyReply): void => {
  reply.header("Set-Cookie", buildClearCookie());
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
