type HeaderGetter = Pick<Headers, "get"> | null | undefined;

function inferOriginFromHeaders(requestHeaders?: HeaderGetter): string | undefined {
  if (!requestHeaders) {
    return undefined;
  }

  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  if (!host) {
    return undefined;
  }

  const protocol =
    requestHeaders.get("x-forwarded-proto") ??
    (process.env.NODE_ENV === "production" ? "https" : "http");

  return `${protocol}://${host}`;
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

  const locationLike = (globalThis as { location?: { origin?: string } }).location;
  if (locationLike?.origin) {
    return locationLike.origin;
  }

  return undefined;
}

export function resolveApiBase(requestHeaders?: HeaderGetter): string {
  const configuredBase = process.env.AUTH_API_BASE_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL;
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

export class ApiError extends Error {
  constructor(message: string, readonly status: number, readonly body?: unknown) {
    super(message);
  }
}

export async function apiRequest(path: string, init?: RequestInit): Promise<Response> {
  const headers = new Headers(init?.headers ?? {});
  const isFormData =
    typeof FormData !== "undefined" && init?.body instanceof FormData;

  if (isFormData) {
    headers.delete("Content-Type");
  } else if (!headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...init,
      cache: "no-store",
      credentials: "include",
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

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
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
