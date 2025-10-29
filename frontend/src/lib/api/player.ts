import { apiFetch } from "./client";

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
    `/player/play-states?${params.toString()}`
  );
  return response.playStates;
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

  return apiFetch<PlayState>("/player/play-states", {
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
