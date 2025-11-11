import fp from "fastify-plugin";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { env } from "../config/env.js";
import type { Socket } from "net";
import type { TLSSocket } from "tls";
import ipaddr from "ipaddr.js";

const LOCAL_HOSTNAMES = new Set([
  "localhost",
  "127.0.0.1",
  "::1",
]);

type IpRange =
  | "loopback"
  | "linkLocal"
  | "private"
  | "uniqueLocal"
  | "carrierGradeNat";

function isTrustedRange(range: string): range is IpRange {
  return (
    range === "loopback" ||
    range === "linkLocal" ||
    range === "private" ||
    range === "uniqueLocal" ||
    range === "carrierGradeNat"
  );
}

function stripPort(host: string): string {
  if (host.startsWith("[") && host.includes("]")) {
    return host.slice(1, host.indexOf("]"));
  }

  const segments = host.split(":");
  if (segments.length === 2) {
    return segments[0];
  }

  return host;
}

function isTrustedAddress(value: string | undefined): boolean {
  if (!value) {
    return false;
  }

  const normalized = value.toLowerCase();
  if (LOCAL_HOSTNAMES.has(normalized)) {
    return true;
  }

  const candidate = stripPort(normalized);

  if (LOCAL_HOSTNAMES.has(candidate)) {
    return true;
  }

  try {
    let parsed = ipaddr.parse(candidate);

    if (parsed.kind() === "ipv6" && parsed.isIPv4MappedAddress()) {
      parsed = parsed.toIPv4Address();
    }

    return isTrustedRange(parsed.range());
  } catch {
    return false;
  }
}

function isLocalRequest(request: FastifyRequest): boolean {
  if (isTrustedAddress(request.hostname)) {
    return true;
  }

  if (isTrustedAddress(request.ip)) {
    return true;
  }

  const hostHeader = request.headers.host;
  if (typeof hostHeader === "string") {
    if (isTrustedAddress(hostHeader)) {
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

function isEncryptedSocket(socket: Socket | undefined): socket is TLSSocket {
  return Boolean(socket && (socket as TLSSocket).encrypted === true);
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

    if (isEncryptedSocket(request.raw.socket)) {
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
