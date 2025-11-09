import type { NextRequest } from "next/server";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001";

type RouteParams = {
  params: Promise<{
    stateId: string;
  }>;
};

type SignedUrlPayload = {
  type: "signed-url";
  url: string;
  contentType?: string;
  size?: number;
};

export async function GET(request: NextRequest, { params }: RouteParams) {
  const { stateId } = await params;
  const backendPath = `/play-states/${encodeURIComponent(stateId)}/binary`;
  return proxyBinaryRequest(request, backendPath);
}

async function proxyBinaryRequest(
  request: NextRequest,
  backendPath: string
): Promise<Response> {
  const cookieHeader = request.headers.get("cookie");
  const headers = new Headers();
  headers.set("accept", request.headers.get("accept") ?? "application/octet-stream");
  if (cookieHeader) {
    headers.set("cookie", cookieHeader);
  }

  const backendUrl = `${API_BASE}${backendPath}`;

  let backendResponse: Response;
  try {
    backendResponse = await fetch(backendUrl, {
      headers,
      cache: "no-store"
    });
  } catch (error) {
    console.error("Failed to reach backend for play-state binary", error);
    return new Response(null, { status: 502 });
  }

  const contentType = backendResponse.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    let payload: unknown = null;
    try {
      payload = await backendResponse.json();
    } catch (error) {
      console.error("Failed to parse backend JSON response", error);
    }

    if (isSignedUrlPayload(payload)) {
      try {
        const signedResponse = await fetch(payload.url);
        if (!signedResponse.ok || !signedResponse.body) {
          return new Response(null, { status: signedResponse.status });
        }
        const headers = new Headers();
        headers.set(
          "content-type",
          payload.contentType ?? signedResponse.headers.get("content-type") ?? "application/octet-stream"
        );
        if (payload.size) {
          headers.set("content-length", String(payload.size));
        } else {
          const signedLength = signedResponse.headers.get("content-length");
          if (signedLength) {
            headers.set("content-length", signedLength);
          }
        }
        headers.set("cache-control", "no-store");
        return new Response(signedResponse.body, { status: 200, headers });
      } catch (error) {
        console.error("Failed to download play state via signed URL", error);
        return new Response(null, { status: 502 });
      }
    }

    return new Response(JSON.stringify(payload ?? {}), {
      status: backendResponse.status,
      headers: { "content-type": "application/json" }
    });
  }

  const proxiedHeaders = new Headers();
  const forwardHeaders = ["content-type", "content-length", "cache-control", "content-disposition"];
  for (const header of forwardHeaders) {
    const value = backendResponse.headers.get(header);
    if (value) {
      proxiedHeaders.set(header, value);
    }
  }
  if (!proxiedHeaders.has("cache-control")) {
    proxiedHeaders.set("cache-control", "no-store");
  }

  return new Response(backendResponse.body, {
    status: backendResponse.status,
    headers: proxiedHeaders
  });
}

function isSignedUrlPayload(payload: unknown): payload is SignedUrlPayload {
  if (payload && typeof payload === "object") {
    const candidate = payload as Record<string, unknown>;
    return candidate.type === "signed-url" && typeof candidate.url === "string";
  }

  return false;
}

