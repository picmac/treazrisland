import { headers } from "next/headers";
import { redirect } from "next/navigation";

import type { UserProfileResponse } from "@/src/lib/api/user";
import { resolveApiBase } from "@/src/lib/api/client";
import {
  applyBackendCookies,
  extractSetCookieHeaders,
} from "@/src/lib/server/backend-cookies";
import { refreshAccessTokenFromCookies } from "@/src/lib/server/session";

export async function fetchProfile(): Promise<UserProfileResponse> {
  const headerStore = headers();
  const apiBase = resolveApiBase(headerStore);

  let accessToken: string | null = null;
  try {
    const session = await refreshAccessTokenFromCookies();
    accessToken = session.accessToken;

  } catch {
    redirect("/login");
  }

  if (!accessToken) {
    redirect("/login");
  }

  const response = await fetch(`${apiBase}/users/me`, {
    method: "GET",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    cache: "no-store",
  });

  const profileCookies = extractSetCookieHeaders(response);
  if (profileCookies.length > 0) {
    await applyBackendCookies(profileCookies);
  }

  if (response.status === 401) {
    redirect("/login");
  }

  if (!response.ok) {
    throw new Error(`Failed to load profile: ${response.status}`);
  }

  return (await response.json()) as UserProfileResponse;
}
