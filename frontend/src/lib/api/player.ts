import { apiFetch, ApiError, API_BASE } from "./client";
import type { AssetSummary } from "./library";

export type PlayState = {
  id: string;
  romId: string;
  label: string | null;
  slot: number | null;
  size: number;
  checksumSha256: string;
  createdAt: string;
  updatedAt: string;
  downloadUrl: string;
};

export async function listPlayStates(romId: string): Promise<PlayState[]> {
  const params = new URLSearchParams({ romId });
  const response = await apiFetch<{ playStates: PlayState[] }>(
    `/play-states?${params.toString()}`
  );
  return response.playStates;
}

export type RecentPlayState = {
  playState: PlayState;
  rom: {
    id: string;
    title: string;
    platform: {
      id: string;
      name: string;
      slug: string;
      shortName: string | null;
    } | null;
    assetSummary: AssetSummary;
  } | null;
};

export async function listRecentPlayStates(): Promise<RecentPlayState[]> {
  const response = await apiFetch<{ recent: RecentPlayState[] }>(
    "/play-states/recent"
  );
  return response.recent;
}

export async function createPlayState(payload: {
  romId: string;
  data: ArrayBuffer;
  label?: string;
  slot?: number;
}): Promise<PlayState> {
  const base64Data = arrayBufferToBase64(payload.data);
  const body: Record<string, unknown> = {
    romId: payload.romId,
    data: base64Data
  };

  if (payload.label) {
    body.label = payload.label;
  }
  if (typeof payload.slot === "number") {
    body.slot = payload.slot;
  }

  return apiFetch<PlayState>("/play-states", {
    method: "POST",
    body: JSON.stringify(body)
  });
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  if (typeof globalThis.btoa === "function") {
    return globalThis.btoa(binary);
  }
  throw new Error("Base64 encoding is not supported in this environment");
}

export type RomBinaryDescriptor =
  | {
      type: "signed-url";
      url: string;
      contentType?: string;
      size?: number;
    }
  | {
      type: "inline";
      data: ArrayBuffer;
      contentType: string | null;
    };

type RequestRomBinaryOptions = {
  authToken?: string;
};

export async function requestRomBinary(
  romId: string,
  options: RequestRomBinaryOptions = {}
): Promise<RomBinaryDescriptor> {
  if (!romId) {
    throw new Error("romId is required to request a ROM binary");
  }

  const headers = new Headers();
  headers.set("Accept", "application/json");
  if (options.authToken) {
    headers.set("Authorization", `Bearer ${options.authToken}`);
  }

  const response = await fetch(
    `${API_BASE}/play/roms/${encodeURIComponent(romId)}/download`,
    {
      credentials: "include",
      headers
    }
  );

  const contentType = response.headers.get("content-type") ?? "";

  if (!response.ok) {
    let parsed: unknown = null;
    if (contentType.includes("application/json")) {
      try {
        parsed = await response.json();
      } catch {
        parsed = await response.text();
      }
    } else {
      parsed = await response.text();
    }

    const message =
      (typeof parsed === "string" && parsed.length > 0
        ? parsed
        : typeof parsed === "object" && parsed && "message" in parsed
          ? String((parsed as { message: unknown }).message)
          : response.statusText) || response.statusText;

    throw new ApiError(message, response.status, parsed);
  }

  if (contentType.includes("application/json")) {
    const payload: unknown = await response.json();
    if (
      payload &&
      typeof payload === "object" &&
      (payload as { type?: unknown }).type === "signed-url" &&
      typeof (payload as { url?: unknown }).url === "string"
    ) {
      const { url, contentType: payloadType, size } = payload as {
        url: string;
        contentType?: string;
        size?: number;
      };
      return {
        type: "signed-url",
        url,
        contentType: payloadType,
        size,
      };
    }

    throw new Error("Unexpected JSON payload while requesting ROM binary");
  }

  const buffer = await response.arrayBuffer();
  return {
    type: "inline",
    data: buffer,
    contentType: contentType.length > 0 ? contentType : null,
  };
}
