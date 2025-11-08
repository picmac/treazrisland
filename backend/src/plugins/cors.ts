import fp from "fastify-plugin";
import cors from "@fastify/cors";
import type { FastifyCorsOptions } from "@fastify/cors";
import { env } from "../config/env.js";

const normalizeOrigin = (origin: string): string => {
  const trimmed = origin.trim();
  return trimmed.endsWith("/") ? trimmed.slice(0, -1) : trimmed;
};

enum OriginDecision {
  Allow = "allow",
  Reject = "reject",
}

const evaluateOrigin = (
  origin: string | undefined,
  allowedOrigins: string[],
  allowAll: boolean,
): OriginDecision => {
  if (!origin) {
    return OriginDecision.Allow;
  }

  if (allowAll) {
    return OriginDecision.Allow;
  }

  const normalized = normalizeOrigin(origin).toLowerCase();
  const matches = allowedOrigins.some(
    (candidate) => normalizeOrigin(candidate).toLowerCase() === normalized,
  );

  return matches ? OriginDecision.Allow : OriginDecision.Reject;
};

export default fp(async (app) => {
  const allowedOrigins = env.CORS_ALLOWED_ORIGINS;
  const allowAll = allowedOrigins.includes("*");

  await app.register(cors, {
    credentials: true,
    origin(origin, callback) {
      const decision = evaluateOrigin(origin, allowedOrigins, allowAll);

      if (decision === OriginDecision.Allow) {
        callback(null, true);
        return;
      }

      app.log.warn({ origin }, "CORS origin rejected");
      callback(null, false);
    },
  } satisfies FastifyCorsOptions);
});
