export const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001";

export class ApiError extends Error {
  constructor(message: string, readonly status: number, readonly body?: unknown) {
    super(message);
  }
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    cache: "no-store",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {})
    }
  });

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

  return (await response.json()) as T;
}
