import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { buildSecurityHeaders } from "./security-headers";

const INLINE_SCRIPT_MATCHERS = [/^\/play\//, /^\/admin(?:\/|$)/];

const BASE64_ALPHABET =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

function encodeBase64(bytes: Uint8Array): string {
  let output = "";

  let i = 0;
  for (; i + 2 < bytes.length; i += 3) {
    output += BASE64_ALPHABET[bytes[i] >> 2];
    output += BASE64_ALPHABET[((bytes[i] & 0x03) << 4) | (bytes[i + 1] >> 4)];
    output += BASE64_ALPHABET[((bytes[i + 1] & 0x0f) << 2) | (bytes[i + 2] >> 6)];
    output += BASE64_ALPHABET[bytes[i + 2] & 0x3f];
  }

  const remaining = bytes.length - i;
  if (remaining === 1) {
    output += BASE64_ALPHABET[bytes[i] >> 2];
    output += BASE64_ALPHABET[(bytes[i] & 0x03) << 4];
    output += "==";
  } else if (remaining === 2) {
    output += BASE64_ALPHABET[bytes[i] >> 2];
    output += BASE64_ALPHABET[((bytes[i] & 0x03) << 4) | (bytes[i + 1] >> 4)];
    output += BASE64_ALPHABET[(bytes[i + 1] & 0x0f) << 2];
    output += "=";
  }

  return output;
}

function generateNonce(): string {
  const bytes = new Uint8Array(16);

  if (!globalThis.crypto?.getRandomValues) {
    throw new Error("Secure random number generation is not available");
  }

  globalThis.crypto.getRandomValues(bytes);
  return encodeBase64(bytes);
}

function needsNonce(pathname: string): boolean {
  return INLINE_SCRIPT_MATCHERS.some((regex) => regex.test(pathname));
}

export function proxy(request: NextRequest) {
  if (!needsNonce(request.nextUrl.pathname)) {
    return NextResponse.next();
  }

  const nonce = generateNonce();
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
  matcher: ["/play/:path*", "/admin/:path*"]
};
