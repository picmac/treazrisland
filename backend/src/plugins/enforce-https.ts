import fp from "fastify-plugin";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { env } from "../config/env.js";

const LOCAL_HOSTNAMES = new Set([
  "localhost",
  "127.0.0.1",
  "::1",
]);

function isLocalRequest(request: FastifyRequest): boolean {
  if (LOCAL_HOSTNAMES.has(request.hostname ?? "")) {
    return true;
  }

  if (LOCAL_HOSTNAMES.has(request.ip)) {
    return true;
  }

  const hostHeader = request.headers.host;
  if (typeof hostHeader === "string") {
    const host = hostHeader.split(":")[0];
    if (LOCAL_HOSTNAMES.has(host)) {
      return true;
    }
  }

  return false;
}

function resolveForwardedProtocol(request: FastifyRequest): string | null {
  const header = request.headers["x-forwarded-proto"] ?? request.headers["x-forwarded-protocol"];
  if (Array.isArray(header)) {
    return header[0] ?? null;
  }

  if (typeof header === "string" && header.trim().length > 0) {
    return header.trim().toLowerCase();
  }

  return null;
}

export default fp(async (app: FastifyInstance) => {
  if (env.TREAZ_TLS_MODE !== "https") {
    return;
  }

  app.addHook("onRequest", async (request, reply) => {
    if (isLocalRequest(request)) {
      return;
    }

    const forwardedProto = resolveForwardedProtocol(request);
    if (forwardedProto === "https") {
      return;
    }

    if (request.raw.socket?.encrypted) {
      return;
    }

    request.log.warn(
      {
        event: "tls.enforcement",
        host: request.headers.host ?? null,
        forwardedProto,
        remoteAddress: request.ip,
      },
      "Rejected insecure request",
    );

    await reply.status(403).send({ message: "HTTPS is required for this endpoint" });
  });
});
