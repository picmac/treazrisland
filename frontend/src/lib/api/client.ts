export type HeaderGetter = Pick<Headers, "get"> | null | undefined;

const DEFAULT_DEV_API_PORT = "3001";
const DEFAULT_DEV_API_BASE = "http://localhost:3001";
const DEFAULT_PROD_API_BASE = "http://api.internal.svc";

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

function normalizeHostCandidate(host?: string | null): string | undefined {
  if (!host) {
    return undefined;
  }

  const normalized = host.replace(/^\[|\]$/g, "").trim().toLowerCase();
  return normalized.length > 0 ? normalized : undefined;
}

function isLoopbackHost(host?: string | null): boolean {
  const normalized = normalizeHostCandidate(host);
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

function isPrivateNetworkHost(host?: string | null): boolean {
  const normalized = normalizeHostCandidate(host);
  if (!normalized) {
    return false;
  }

  if (/^10\./.test(normalized)) {
    return true;
  }

  if (/^192\.168\./.test(normalized)) {
    return true;
  }

  if (/^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(normalized)) {
    return true;
  }

  if (/^169\.254\./.test(normalized)) {
    return true;
  }

  if (normalized.startsWith("fc") || normalized.startsWith("fd")) {
    return normalized.includes(":");
  }

  return false;
}

function chooseEffectivePort(host?: string, port?: string | null): string | undefined {
  const sanitizedPort = sanitizePort(port);
  const overridePort = selectDevPortOverride();
  if (sanitizedPort === "3000") {
    if (overridePort) {
      return overridePort;
    }

    const devLikeEnvironment = process.env.NODE_ENV !== "production";
    const loopbackHost = host ? isLoopbackHost(host) : false;
    const privateNetworkHost = host ? isPrivateNetworkHost(host) : false;

    if (!loopbackHost && (devLikeEnvironment || privateNetworkHost)) {
      return DEFAULT_DEV_API_PORT;
    }

    return sanitizedPort;
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
  const effectivePort = chooseEffectivePort(host, port);

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
      const effectivePort = chooseEffectivePort(host, locationLike.port ?? port);
      return buildOrigin(protocol, host, effectivePort);
    }
  }

  const hostname = normalizeHeaderValue(locationLike.hostname);
  if (hostname) {
    const effectivePort = chooseEffectivePort(hostname, locationLike.port);
    return buildOrigin(protocol, hostname, effectivePort);
  }

  return locationLike.origin ?? undefined;
}

const INTERNAL_HOST_SUFFIXES = [
  "localhost",
  "local",
  "lan",
  "internal",
  "svc",
  "cluster.local",
  "consul",
  "localdomain",
  "home",
  "home.arpa",
  "test",
  "invalid"
] as const;

function stripTrailingDot(host: string): string {
  return host.endsWith(".") ? host.slice(0, -1) : host;
}

function isInternalHostSuffix(host: string): boolean {
  const normalized = stripTrailingDot(host.toLowerCase());
  for (const suffix of INTERNAL_HOST_SUFFIXES) {
    if (normalized === suffix) {
      return true;
    }

    if (normalized.endsWith(`.${suffix}`)) {
      return true;
    }
  }

  return false;
}

function isLikelyPrivateHost(host?: string | null): boolean {
  if (!host) {
    return false;
  }

  if (isLoopbackHost(host)) {
    return true;
  }

  if (isPrivateNetworkHost(host)) {
    return true;
  }

  const normalized = normalizeHostCandidate(host);
  if (!normalized) {
    return false;
  }

  if (!normalized.includes(".")) {
    return true;
  }

  return isInternalHostSuffix(normalized);
}

type ApiBaseVisibility = "private" | "public" | "unknown";

function classifyBaseUrl(url: string): ApiBaseVisibility {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return "unknown";
    }

    if (!parsed.hostname) {
      return "unknown";
    }

    return isLikelyPrivateHost(parsed.hostname) ? "private" : "public";
  } catch {
    return "unknown";
  }
}

export class ApiConfigurationError extends Error {
  constructor(message: string, readonly details?: Record<string, unknown>) {
    super(message);
    this.name = "ApiConfigurationError";
  }
}

const apiHealthChecks = new Map<string, Promise<void>>();

function joinUrl(base: string, path: string): string {
  const normalizedBase = base.endsWith("/") ? base : `${base}/`;
  const trimmedPath = path.startsWith("/") ? path.slice(1) : path;

  return new URL(trimmedPath, normalizedBase).toString();
}

async function ensureInternalApiReachable(baseUrl: string): Promise<void> {
  if (typeof window !== "undefined") {
    return;
  }

  if (classifyBaseUrl(baseUrl) !== "private") {
    throw new ApiConfigurationError(
      `API base ${baseUrl} is not considered private. Configure AUTH_API_BASE_URL with an internal service address (for example ${DEFAULT_PROD_API_BASE}).`
    );
  }

  const existingProbe = apiHealthChecks.get(baseUrl);
  if (existingProbe) {
    await existingProbe;
    return;
  }

  const probe = (async () => {
    const healthUrl = new URL(joinUrl(baseUrl, "/health/ready"));

    let response: Response;
    try {
      response = await fetch(healthUrl.toString(), {
        method: "GET",
        headers: {
          "x-treaz-frontend-probe": "api-health"
        },
        cache: "no-store",
        credentials: "include"
      });
    } catch (error) {
      const cause =
        error instanceof Error
          ? { name: error.name, message: error.message }
          : { message: "Unknown error" };

      throw new ApiConfigurationError(
        `Unable to reach the internal API at ${baseUrl}. Confirm the DNS record resolves inside the private network and that network policies allow the frontend to contact the backend.`,
        { cause }
      );
    }

    if (!response.ok) {
      throw new ApiConfigurationError(
        `Internal API health check at ${healthUrl.toString()} responded with ${response.status} ${response.statusText}. Verify the backend is running and exposing /health/ready internally.`,
        { status: response.status }
      );
    }
  })();

  apiHealthChecks.set(
    baseUrl,
    probe.catch((error) => {
      apiHealthChecks.delete(baseUrl);
      throw error;
    })
  );

  await apiHealthChecks.get(baseUrl);
}

function readConfiguredBase(): string | undefined {
  const isServer = typeof window === "undefined";
  if (isServer) {
    return process.env.AUTH_API_BASE_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL;
  }

  return process.env.NEXT_PUBLIC_API_BASE_URL ?? process.env.AUTH_API_BASE_URL;
}

export interface ResolveApiBaseOptions {
  requirePrivate?: boolean;
}

function buildDefaultBase(): string {
  return process.env.NODE_ENV === "production" ? DEFAULT_PROD_API_BASE : DEFAULT_DEV_API_BASE;
}

function resolveFromCandidates(
  candidates: Array<{ value: string; source: string }>,
  requirePrivate: boolean
): string {
  let lastPublicCandidate: { value: string; source: string } | null = null;

  for (const candidate of candidates) {
    const classification = classifyBaseUrl(candidate.value);
    if (!requirePrivate) {
      return candidate.value;
    }

    if (classification === "private") {
      return candidate.value;
    }

    if (classification === "public") {
      lastPublicCandidate = candidate;
    }
  }

  if (requirePrivate) {
    if (lastPublicCandidate) {
      throw new ApiConfigurationError(
        `Refusing to use public API base ${lastPublicCandidate.value} derived from ${lastPublicCandidate.source}. Set AUTH_API_BASE_URL to an internal service address (for example ${DEFAULT_PROD_API_BASE}).`
      );
    }

    throw new ApiConfigurationError(
      `Unable to resolve an internal API base URL. Define AUTH_API_BASE_URL with a private hostname (for example ${DEFAULT_PROD_API_BASE}).`
    );
  }

  throw new ApiConfigurationError("Unable to resolve API base URL");
}

export function resolveApiBase(
  requestHeaders?: HeaderGetter,
  options?: ResolveApiBaseOptions
): string {
  const requirePrivate = options?.requirePrivate ?? typeof window === "undefined";

  const configuredBase = readConfiguredBase();
  if (configuredBase) {
    const classification = classifyBaseUrl(configuredBase);
    if (requirePrivate && classification !== "private") {
      throw new ApiConfigurationError(
        `Configured API base ${configuredBase} is not private. Point AUTH_API_BASE_URL at an internal service (for example ${DEFAULT_PROD_API_BASE}).`
      );
    }
    return configuredBase;
  }

  const candidates: Array<{ value: string; source: string }> = [];

  const inferredFromHeaders = inferOriginFromHeaders(requestHeaders);
  if (inferredFromHeaders) {
    candidates.push({ value: inferredFromHeaders, source: "request headers" });
  }

  const inferredFromRuntime = inferOriginFromRuntime();
  if (inferredFromRuntime) {
    candidates.push({ value: inferredFromRuntime, source: "runtime location" });
  }

  const inferredFromEnv = inferOriginFromProcessEnv();
  if (inferredFromEnv) {
    candidates.push({ value: inferredFromEnv, source: "process environment" });
  }

  candidates.push({ value: buildDefaultBase(), source: "default" });

  return resolveFromCandidates(candidates, requirePrivate);
}

export const API_BASE = resolveApiBase(undefined, { requirePrivate: typeof window === "undefined" });

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

  const hasBody = typeof fetchInit.body !== "undefined";

  if (isFormData) {
    headers.delete("Content-Type");
  } else if (hasBody && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  } else if (!hasBody && headers.get("Content-Type") === "application/json") {
    headers.delete("Content-Type");
  }

  let response: Response;
  try {
    const resolvedBase = baseUrl ?? (requestHeaders ? resolveApiBase(requestHeaders) : API_BASE);

    await ensureInternalApiReachable(resolvedBase);

    const targetUrl = joinUrl(resolvedBase, path);

    response = await fetch(targetUrl, {
      ...fetchInit,
      cache: fetchInit.cache ?? "no-store",
      credentials: fetchInit.credentials ?? "include",
      headers
    });
  } catch (error) {
    if (error instanceof ApiConfigurationError) {
      throw new ApiError(error.message, 503, error.details);
    }

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
