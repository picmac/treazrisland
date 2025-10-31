import { randomBytes } from "node:crypto";

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { buildSecurityHeaders } from "./security-headers";

const INLINE_SCRIPT_MATCHERS = [/^\/play\//];

function needsNonce(pathname: string): boolean {
  return INLINE_SCRIPT_MATCHERS.some((regex) => regex.test(pathname));
}

export function middleware(request: NextRequest) {
  if (!needsNonce(request.nextUrl.pathname)) {
    return NextResponse.next();
  }

  const nonce = randomBytes(16).toString("base64");
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-csp-nonce", nonce);

  const response = NextResponse.next({
    request: {
      headers: requestHeaders
    }
  });

  for (const header of buildSecurityHeaders({ nonce })) {
    response.headers.set(header.key, header.value);
  }

  response.headers.set("x-csp-nonce", nonce);

  return response;
}

export const config = {
  matcher: ["/play/:path*"]
};
