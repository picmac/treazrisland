import fp from "fastify-plugin";
import cors from "@fastify/cors";
import type { FastifyCorsOptions } from "@fastify/cors";
import ipaddr from "ipaddr.js";
import { env } from "../config/env.js";

const normalizeOrigin = (origin: string): string => {
  const trimmed = origin.trim();
  return trimmed.endsWith("/") ? trimmed.slice(0, -1) : trimmed;
};

enum OriginDecision {
  Allow = "allow",
  Reject = "reject",
}

const DEFAULT_PORTS = new Map<string, number>([
  ["http:", 80],
  ["https:", 443],
]);

type LanAllowance = {
  protocol: string;
  port: number | undefined;
};

const LOCAL_IP_RANGES = new Set([
  "loopback",
  "private",
  "linkLocal",
  "uniqueLocal",
  "carrierGradeNat",
]);

const parseOrigin = (candidate: string): URL | undefined => {
  try {
    return new URL(candidate);
  } catch {
    return undefined;
  }
};

const resolvePort = (origin: URL): number | undefined => {
  if (origin.port) {
    const parsed = Number(origin.port);
    return Number.isNaN(parsed) ? undefined : parsed;
  }

  return DEFAULT_PORTS.get(origin.protocol);
};

const isLoopbackHostname = (hostname: string): boolean => {
  if (hostname === "localhost") {
    return true;
  }

  if (!ipaddr.isValid(hostname)) {
    return false;
  }

  try {
    return ipaddr.parse(hostname).range() === "loopback";
  } catch {
    return false;
  }
};

const isPrivateNetworkHostname = (hostname: string): boolean => {
  if (hostname === "localhost") {
    return true;
  }

  if (!ipaddr.isValid(hostname)) {
    return false;
  }

  try {
    const range = ipaddr.parse(hostname).range();
    return LOCAL_IP_RANGES.has(range);
  } catch {
    return false;
  }
};

const computeLanAllowances = (allowedOrigins: string[]): LanAllowance[] =>
  allowedOrigins
    .map((candidate) => parseOrigin(candidate))
    .filter((candidate): candidate is URL => Boolean(candidate))
    .filter((candidate) => isLoopbackHostname(candidate.hostname))
    .map((candidate) => ({
      protocol: candidate.protocol,
      port: resolvePort(candidate),
    }));

const shouldAllowLanOrigin = (
  origin: string,
  lanAllowances: LanAllowance[],
): boolean => {
  if (lanAllowances.length === 0) {
    return false;
  }

  const parsedOrigin = parseOrigin(origin);
  if (!parsedOrigin) {
    return false;
  }

  if (!isPrivateNetworkHostname(parsedOrigin.hostname)) {
    return false;
  }

  const originPort = resolvePort(parsedOrigin);
  return lanAllowances.some(
    (allowance) =>
      allowance.protocol === parsedOrigin.protocol &&
      allowance.port === originPort,
  );
};

const evaluateOrigin = (
  origin: string | undefined,
  allowedOrigins: string[],
  allowAll: boolean,
  lanAllowances: LanAllowance[],
  lanAllowanceEnabled: boolean,
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

  if (matches) {
    return OriginDecision.Allow;
  }

  if (lanAllowanceEnabled && shouldAllowLanOrigin(origin, lanAllowances)) {
    return OriginDecision.Allow;
  }

  return OriginDecision.Reject;
};

export default fp(async (app) => {
  const allowedOrigins = env.CORS_ALLOWED_ORIGINS;
  const allowAll = allowedOrigins.includes("*");
  const lanAllowances = computeLanAllowances(allowedOrigins);
  const lanAllowanceEnabled = env.RUNTIME_STAGE !== "production";

  await app.register(cors, {
    credentials: true,
    origin(origin, callback) {
      const decision = evaluateOrigin(
        origin,
        allowedOrigins,
        allowAll,
        lanAllowances,
        lanAllowanceEnabled,
      );

      if (decision === OriginDecision.Allow) {
        callback(null, true);
        return;
      }

      app.log.warn({ origin }, "CORS origin rejected");
      callback(null, false);
    },
  } satisfies FastifyCorsOptions);
});
