"use server";

import { cookies, headers } from "next/headers";
import type { RomDetail } from "@lib/api/roms";
import { resolveApiBase } from "@lib/api/client";

export async function getRomMetadata(romId: string): Promise<RomDetail | null> {
  if (!romId) {
    return null;
  }

  const cookieStore = await cookies();
  const cookieHeader = cookieStore
    .getAll()
    .map((entry) => `${entry.name}=${entry.value}`)
    .join("; ");

  const headerStore = headers();
  const apiBase = resolveApiBase(headerStore);

  const response = await fetch(`${apiBase}/roms/${encodeURIComponent(romId)}`, {
    headers: {
      Accept: "application/json",
      ...(cookieHeader.length > 0 ? { cookie: cookieHeader } : {})
    },
    cache: "no-store"
  });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error(`Failed to load ROM metadata: ${response.status}`);
  }

  return (await response.json()) as RomDetail;
}
