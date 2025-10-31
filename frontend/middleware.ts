import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { buildSecurityHeaders } from "./security-headers";

const BASE64_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

function encodeBase64(bytes: Uint8Array): string {
  if (typeof globalThis.btoa === "function") {
    let binary = "";

    for (const byte of bytes) {
      binary += String.fromCharCode(byte);
    }

    return globalThis.btoa(binary);
  }

  let output = "";

  for (let index = 0; index < bytes.length; index += 3) {
    const firstByte = bytes[index];
    const hasSecondByte = index + 1 < bytes.length;
    const hasThirdByte = index + 2 < bytes.length;
    const secondByte = hasSecondByte ? bytes[index + 1] : 0;
    const thirdByte = hasThirdByte ? bytes[index + 2] : 0;

    output += BASE64_ALPHABET[firstByte >> 2];
    output += BASE64_ALPHABET[((firstByte & 0x03) << 4) | (secondByte >> 4)];
    output += hasSecondByte
      ? BASE64_ALPHABET[((secondByte & 0x0f) << 2) | (thirdByte >> 6)]
      : "=";
    output += hasThirdByte ? BASE64_ALPHABET[thirdByte & 0x3f] : "=";
  }

  return output;
}

function generateNonce(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return encodeBase64(bytes);
}

const INLINE_SCRIPT_MATCHERS = [/^\/play\//];

function needsNonce(pathname: string): boolean {
  return INLINE_SCRIPT_MATCHERS.some((regex) => regex.test(pathname));
}

export function middleware(request: NextRequest) {
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
  matcher: ["/play/:path*"]
};
