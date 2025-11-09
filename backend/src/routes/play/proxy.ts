import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

type ProxyOptions = {
  method: "GET" | "POST" | "PATCH" | "DELETE";
  url: string;
  payload?: unknown;
  contentType?: string;
};

const HEADER_WHITELIST = new Set([
  "authorization",
  "cookie",
  "user-agent",
  "accept",
  "content-type",
  "range",
  "if-match",
  "if-none-match",
  "if-modified-since",
  "if-unmodified-since",
  "if-range",
  "cache-control",
  "x-forwarded-for",
]);

function cloneHeaders(
  request: FastifyRequest,
  overrides: Record<string, string> = {},
): Record<string, string> {
  const headers: Record<string, string> = {};
  for (const [key, value] of Object.entries(request.headers)) {
    const lower = key.toLowerCase();
    if (!HEADER_WHITELIST.has(lower)) {
      continue;
    }
    if (Array.isArray(value)) {
      headers[lower] = value.find((entry) => typeof entry === "string") ?? "";
    } else if (typeof value === "string") {
      headers[lower] = value;
    }
  }

  for (const [key, value] of Object.entries(overrides)) {
    headers[key.toLowerCase()] = value;
  }

  return headers;
}

export async function forwardPlayerRequest(
  app: FastifyInstance,
  request: FastifyRequest,
  reply: FastifyReply,
  options: ProxyOptions,
) {
  const headers = cloneHeaders(request, {
    ...(options.contentType ? { "content-type": options.contentType } : {}),
  });

  const upstream = await app.inject({
    method: options.method,
    url: options.url,
    payload: options.payload,
    headers,
    remoteAddress: request.ip,
  });

  reply.status(upstream.statusCode);

  for (const [key, value] of Object.entries(upstream.headers)) {
    const lower = key.toLowerCase();
    if (lower === "content-length" || lower === "content-type") {
      if (Array.isArray(value)) {
        const first = value.find((entry) => typeof entry === "string");
        if (first) {
          reply.header(key, first);
        }
      } else if (typeof value === "string") {
        reply.header(key, value);
      }
      continue;
    }
    if (lower === "connection" || lower === "transfer-encoding") {
      continue;
    }
    if (Array.isArray(value)) {
      for (const entry of value) {
        if (typeof entry === "string") {
          reply.header(key, entry);
        }
      }
    } else if (typeof value === "string") {
      reply.header(key, value);
    }
  }

  const payload = upstream.rawPayload ?? upstream.body;
  return reply.send(payload);
}

export function appendQueryString(
  url: string,
  request: FastifyRequest,
): string {
  const rawUrl = request.raw.url ?? "";
  const queryIndex = rawUrl.indexOf("?");
  if (queryIndex === -1) {
    return url;
  }
  const query = rawUrl.slice(queryIndex + 1);
  if (!query) {
    return url;
  }
  return `${url}?${query}`;
}

