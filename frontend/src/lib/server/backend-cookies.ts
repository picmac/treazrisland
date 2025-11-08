"use server";

import { cookies } from "next/headers";

type SameSite = "lax" | "strict" | "none";

type ParsedCookie = {
  name: string;
  value: string;
  path?: string;
  domain?: string;
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: SameSite;
  maxAge?: number;
  expires?: Date;
};

function parseSetCookie(header: string): ParsedCookie | null {
  const segments = header.split(/;\s*/).filter(Boolean);
  if (segments.length === 0) {
    return null;
  }

  const [nameValue, ...attributes] = segments;
  const [rawName, ...rawValueParts] = nameValue.split("=");
  if (!rawName) {
    return null;
  }

  const name = rawName.trim();
  const value = rawValueParts.join("=");
  const cookie: ParsedCookie = { name, value };

  for (const attribute of attributes) {
    const [rawKey, ...rawAttrValueParts] = attribute.split("=");
    const key = rawKey.trim().toLowerCase();
    const attrValue = rawAttrValueParts.join("=").trim();

    switch (key) {
      case "path":
        cookie.path = attrValue || undefined;
        break;
      case "domain":
        cookie.domain = attrValue || undefined;
        break;
      case "secure":
        cookie.secure = true;
        break;
      case "httponly":
        cookie.httpOnly = true;
        break;
      case "samesite": {
        const normalized = attrValue.toLowerCase() as SameSite;
        if (normalized === "lax" || normalized === "strict" || normalized === "none") {
          cookie.sameSite = normalized;
        }
        break;
      }
      case "max-age": {
        const parsed = Number(attrValue);
        if (!Number.isNaN(parsed)) {
          cookie.maxAge = parsed;
        }
        break;
      }
      case "expires": {
        const date = new Date(attrValue);
        if (!Number.isNaN(date.valueOf())) {
          cookie.expires = date;
        }
        break;
      }
      default:
        break;
    }
  }

  return cookie;
}

export function applyBackendCookies(setCookieHeaders: readonly string[]) {
  const store = cookies();
  for (const header of setCookieHeaders) {
    const parsed = parseSetCookie(header);
    if (!parsed) {
      continue;
    }
    const { name, value, ...options } = parsed;
    store.set({ name, value, ...options });
  }
}

export function buildCookieHeaderFromStore(): string | undefined {
  const store = cookies();
  const all = store.getAll();
  if (all.length === 0) {
    return undefined;
  }
  return all.map(({ name, value }) => `${name}=${value}`).join("; ");
}
