export type HeaderGetter = Pick<Headers, "get"> | null | undefined;

const DEFAULT_DEV_API_PORT = "3001";

const DEV_PORT_ENV_CANDIDATES = [
  "NEXT_PUBLIC_DEV_API_PORT",
  "NEXT_PUBLIC_BACKEND_PORT",
  "NEXT_PUBLIC_API_PORT",
] as const;

function sanitizePort(port: string | undefined | null): string | undefined {
  if (!port) {
    return undefined;
  }

  const trimmed = port.trim();
  if (trimmed.length === 0) {
    return undefined;
  }

  return /^\d+$/.test(trimmed) ? trimmed : undefined;
}

function selectDevPortOverride(): string | undefined {
  for (const key of DEV_PORT_ENV_CANDIDATES) {
    const value = sanitizePort(process.env[key]);
    if (value) {
      return value;
    }
  }

  return undefined;
}

function isLoopbackHost(host?: string | null): boolean {
  if (!host) {
    return false;
  }

  const normalized = host.replace(/^\[|\]$/g, "").trim().toLowerCase();
  if (!normalized) {
    return false;
  }

  if (normalized === "localhost" || normalized === "::1") {
    return true;
  }

  if (normalized === "127.0.0.1") {
    return true;
  }

  if (normalized.startsWith("127.")) {
    return true;
  }

  return false;
}

function chooseEffectivePort(port?: string | null): string | undefined {
  const sanitizedPort = sanitizePort(port);
  const overridePort = selectDevPortOverride();
  if (sanitizedPort === "3000") {
    return overridePort ?? DEFAULT_DEV_API_PORT;
  }

  if (sanitizedPort) {
    return sanitizedPort;
  }

  return overridePort;
}

function dropDefaultPort(protocol: string, port?: string): string | undefined {
  if (!port) {
    return undefined;
  }

  const normalizedProtocol = protocol.replace(/:$/, "").toLowerCase();
  if ((normalizedProtocol === "http" && port === "80") || (normalizedProtocol === "https" && port === "443")) {
    return undefined;
  }

  return port;
}

function extractProtocol(candidate?: string | null): string {
  const fallback = process.env.NODE_ENV === "production" ? "https" : "http";
  if (!candidate) {
    return fallback;
  }

  const first = candidate.split(",")[0]?.trim();
  if (!first) {
    return fallback;
  }

  const normalized = first.replace(/:$/, "").toLowerCase();
  if (normalized === "http" || normalized === "https") {
    return normalized;
  }

  return fallback;
}

function splitHostAndPort(host: string): { host: string; port?: string } {
  const trimmed = host.trim();
  if (!trimmed) {
    return { host: trimmed };
  }

  if (trimmed.startsWith("[")) {
    const closing = trimmed.indexOf("]");
    if (closing !== -1) {
      const address = trimmed.slice(0, closing + 1);
      const remainder = trimmed.slice(closing + 1);
      if (remainder.startsWith(":")) {
        const portCandidate = remainder.slice(1);
        const sanitized = sanitizePort(portCandidate);
        if (sanitized) {
          return { host: address, port: sanitized };
        }
      }
      return { host: address };
    }
  }

  const colonCount = (trimmed.match(/:/g) ?? []).length;
  if (colonCount > 1) {
    return { host: trimmed };
  }

  const lastColon = trimmed.lastIndexOf(":");
  if (lastColon === -1) {
    return { host: trimmed };
  }

  const portCandidate = trimmed.slice(lastColon + 1);
  const sanitized = sanitizePort(portCandidate);
  if (!sanitized) {
    return { host: trimmed };
  }

  return { host: trimmed.slice(0, lastColon), port: sanitized };
}

function normalizeHeaderValue(value?: string | null): string | undefined {
  if (!value) {
    return undefined;
  }

  const first = value.split(",")[0]?.trim();
  return first ? first : undefined;
}

function pickPreferredHost(
  forwardedHost?: string | null,
  fallbackHost?: string | null
): string | undefined {
  const forwarded = normalizeHeaderValue(forwardedHost);
  const fallback = normalizeHeaderValue(fallbackHost);

  if (forwarded && fallback) {
    const forwardedParts = splitHostAndPort(forwarded);
    const fallbackParts = splitHostAndPort(fallback);

    if (
      forwardedParts.host &&
      fallbackParts.host &&
      isLoopbackHost(forwardedParts.host) &&
      !isLoopbackHost(fallbackParts.host)
    ) {
      return fallback;
    }
  }

  return forwarded ?? fallback;
}

function normalizeHost(host: string): string {
  const trimmed = host.trim();
  if (trimmed.startsWith("[") || !trimmed.includes(":")) {
    return trimmed;
  }

  return `[${trimmed}]`;
}

function buildOrigin(protocol: string, host: string, port?: string): string {
  const effectivePort = dropDefaultPort(protocol, port);
  const normalizedHost = normalizeHost(host);
  return `${protocol.replace(/:$/, "")}://${normalizedHost}${effectivePort ? `:${effectivePort}` : ""}`;
}

function inferOriginFromHeaders(requestHeaders?: HeaderGetter): string | undefined {
  if (!requestHeaders) {
    return undefined;
  }

  const rawHost = pickPreferredHost(
    requestHeaders.get("x-forwarded-host"),
    requestHeaders.get("host")
  );
  if (!rawHost) {
    return undefined;
  }

  const { host, port } = splitHostAndPort(rawHost);
  if (!host) {
    return undefined;
  }

  const protocol = extractProtocol(requestHeaders.get("x-forwarded-proto"));
  const effectivePort = chooseEffectivePort(port);

  return buildOrigin(protocol, host, effectivePort);
}

function inferOriginFromProcessEnv(): string | undefined {
  const vercelUrl = process.env.VERCEL_URL ?? process.env.NEXT_PUBLIC_SITE_URL;
  if (!vercelUrl) {
    return undefined;
  }

  if (/^https?:\/\//i.test(vercelUrl)) {
    return vercelUrl;
  }

  const protocol = process.env.NODE_ENV === "production" ? "https" : "http";
  return `${protocol}://${vercelUrl}`;
}

function inferOriginFromRuntime(): string | undefined {
  if (typeof globalThis === "undefined") {
    return undefined;
  }

  const locationLike = (globalThis as {
    location?: {
      protocol?: string;
      hostname?: string;
      host?: string;
      port?: string;
    } & { origin?: string };
  }).location;

  if (!locationLike) {
    return undefined;
  }

  const protocol = extractProtocol(locationLike.protocol);

  const explicitHost = normalizeHeaderValue(locationLike.host);
  if (explicitHost) {
    const { host, port } = splitHostAndPort(explicitHost);
    if (host) {
      const effectivePort = chooseEffectivePort(locationLike.port ?? port);
      return buildOrigin(protocol, host, effectivePort);
    }
  }

  const hostname = normalizeHeaderValue(locationLike.hostname);
  if (hostname) {
    const effectivePort = chooseEffectivePort(locationLike.port);
    return buildOrigin(protocol, hostname, effectivePort);
  }

  return locationLike.origin ?? undefined;
}

function readConfiguredBase(): string | undefined {
  const isServer = typeof window === "undefined";
  if (isServer) {
    return process.env.AUTH_API_BASE_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL;
  }

  return process.env.NEXT_PUBLIC_API_BASE_URL;
}

export function resolveApiBase(requestHeaders?: HeaderGetter): string {
  const configuredBase = readConfiguredBase();
  if (configuredBase) {
    return configuredBase;
  }

  const inferredFromHeaders = inferOriginFromHeaders(requestHeaders);
  if (inferredFromHeaders) {
    return inferredFromHeaders;
  }

  const inferredFromRuntime = inferOriginFromRuntime();
  if (inferredFromRuntime) {
    return inferredFromRuntime;
  }

  const inferredFromEnv = inferOriginFromProcessEnv();
  if (inferredFromEnv) {
    return inferredFromEnv;
  }

  return "http://localhost:3001";
}

export const API_BASE = resolveApiBase();

export interface ApiRequestInit extends RequestInit {
  baseUrl?: string;
  requestHeaders?: HeaderGetter;
}

export class ApiError extends Error {
  constructor(message: string, readonly status: number, readonly body?: unknown) {
    super(message);
  }
}

export async function apiRequest(path: string, init?: ApiRequestInit): Promise<Response> {
  const { baseUrl, requestHeaders, ...fetchInit } = init ?? {};
  const headers = new Headers(fetchInit.headers ?? {});
  const isFormData =
    typeof FormData !== "undefined" && fetchInit.body instanceof FormData;

  if (isFormData) {
    headers.delete("Content-Type");
  } else if (!headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  let response: Response;
  try {
    const resolvedBase = baseUrl ?? (requestHeaders ? resolveApiBase(requestHeaders) : API_BASE);
    response = await fetch(`${resolvedBase}${path}`, {
      ...fetchInit,
      cache: fetchInit.cache ?? "no-store",
      credentials: fetchInit.credentials ?? "include",
      headers
    });
  } catch (error) {
    const cause =
      error instanceof Error
        ? { name: error.name, message: error.message }
        : { message: "Unknown error" };

    throw new ApiError(
      "Unable to reach the TREAZRISLAND backend API. Please verify the backend service is running and accessible.",
      503,
      { cause }
    );
  }

  if (!response.ok) {
    let parsedBody: unknown = null;
    const contentType = response.headers.get("content-type") ?? "";

    if (contentType.includes("application/json")) {
      try {
        parsedBody = await response.json();
      } catch {
        parsedBody = await response.text();
      }
    } else {
      parsedBody = await response.text();
    }

    const message =
      (typeof parsedBody === "string" && parsedBody.length > 0
        ? parsedBody
        : typeof parsedBody === "object" && parsedBody && "message" in parsedBody
          ? String((parsedBody as { message: unknown }).message)
          : response.statusText) || response.statusText;

    throw new ApiError(message, response.status, parsedBody);
  }

  return response;
}

export async function apiFetch<T>(path: string, init?: ApiRequestInit): Promise<T> {
  const response = await apiRequest(path, init);

  if (response.status === 204 || response.status === 205) {
    return undefined as T;
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    return (await response.json()) as T;
  }

  const text = await response.text();
  return text as unknown as T;
}
