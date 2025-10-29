"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { loadEmulatorBundle } from "@/lib/emulator/loadBundle";
import MobileControls from "@/components/MobileControls";
import { createPlayState, listPlayStates, type PlayState } from "@/src/lib/api/player";

const ROM_ENDPOINT = "/api/player/roms";

const PLATFORM_CORE_MAP: Record<string, string[]> = {
  nes: ["nestopia", "fceumm"],
  snes: ["snes9x", "bsnes"],
  gba: ["mgba"],
  gbc: ["gambatte"],
  gb: ["gambatte"],
  genesis: ["genesis-plus-gx"],
  n64: ["mupen64plus"],
  psx: ["pcsx-rearmed"],
  sms: ["genesis-plus-gx"],
  gg: ["genesis-plus-gx"],
  atari2600: ["stella"],
  atari7800: ["prosystem"],
  sega32x: ["picodrive"],
  segaCD: ["picodrive"],
  ngp: ["mednafen-ngp"],
  wonderswan: ["mednafen-ws"],
  neoGeo: ["fbneo"],
  arcade: ["fbneo"],
  virtualboy: ["mednafen-vb"],
  nintendoDS: ["melonds"]
};

type EmulatorPlayerProps = {
  romId: string;
  romName: string;
  platform: string;
  authToken?: string;
  onSaveState?: (payload: ArrayBuffer) => Promise<void> | void;
};

type EmulatorWindow = typeof window & {
  EJS_player?: (config: EmulatorLaunchConfig) => void;
};

type EmulatorLaunchConfig = {
  gameUrl: string;
  gameName: string;
  system: string;
  patchUrl?: string | null;
  loadStateUrl?: string | null;
  onSaveState?: (payload: ArrayBuffer) => void;
  customOptions?: Record<string, unknown>;
};

const DEFAULT_CORE = "snes9x";

async function fetchRomBinary(romId: string, authToken?: string) {
  const response = await fetch(`${ROM_ENDPOINT}/${encodeURIComponent(romId)}/binary`, {
    headers: {
      Accept: "application/octet-stream",
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {})
    },
    credentials: "include"
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch ROM: ${response.status}`);
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    const payload = await response.json();
    if (payload?.type === "signed-url" && typeof payload.url === "string") {
      const signedResponse = await fetch(payload.url);
      if (!signedResponse.ok) {
        throw new Error(`Failed to fetch ROM from signed URL: ${signedResponse.status}`);
      }
      return await signedResponse.arrayBuffer();
    }
    throw new Error("Unexpected response while fetching ROM binary");
  }

  const buffer = await response.arrayBuffer();
  return buffer;
}

function selectCore(platform: string) {
  const normalized = platform.toLowerCase();
  const candidates = PLATFORM_CORE_MAP[normalized];
  if (!candidates || candidates.length === 0) {
    return DEFAULT_CORE;
  }

  return candidates[0];
}

export default function EmulatorPlayer({
  romId,
  romName,
  platform,
  authToken,
  onSaveState
}: EmulatorPlayerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [playStates, setPlayStates] = useState<PlayState[]>([]);

  const core = useMemo(() => selectCore(platform), [platform]);

  const handleSaveState = useCallback(
    async (payload: ArrayBuffer) => {
      try {
        const savedState = await createPlayState({ romId, data: payload });
        setPlayStates((previous) => {
          const filtered = previous.filter((state) => state.id !== savedState.id);
          return [savedState, ...filtered];
        });
        await onSaveState?.(payload);
      } catch (err) {
        console.error("Failed to persist save state", err);
      }
    },
    [onSaveState, romId]
  );

  const emitVirtualKey = useCallback((key: string, pressed: boolean) => {
    if (typeof window === "undefined") {
      return;
    }

    const eventType = pressed ? "keydown" : "keyup";
    const event = new KeyboardEvent(eventType, {
      key,
      bubbles: true
    });
    window.dispatchEvent(event);
  }, []);

  useEffect(() => {
    let isCancelled = false;

    async function boot() {
      setStatus("loading");
      setError(null);

      try {
        await loadEmulatorBundle();
        const [romBinary, loadedStates] = await Promise.all([
          fetchRomBinary(romId, authToken),
          listPlayStates(romId).catch((err) => {
            console.error("Failed to load play states", err);
            return [] as PlayState[];
          })
        ]);
        if (isCancelled) {
          return;
        }

        setPlayStates(loadedStates);
        const romBlob = new Blob([romBinary], { type: "application/octet-stream" });
        const romUrl = URL.createObjectURL(romBlob);
        const initialStateUrl = loadedStates[0]?.downloadUrl
          ? `/api${loadedStates[0].downloadUrl}`
          : null;

        (window as EmulatorWindow).EJS_player?.({
          gameUrl: romUrl,
          gameName: romName,
          system: core,
          onSaveState: handleSaveState,
          loadStateUrl: initialStateUrl,
          customOptions: {
            container: containerRef.current ?? undefined,
            romId,
            romName,
            preferredCores: PLATFORM_CORE_MAP[platform.toLowerCase()] ?? [core]
          }
        });

        setStatus("ready");
      } catch (err) {
        console.error(err);
        setError(err instanceof Error ? err.message : "Unknown error");
        setStatus("error");
      }
    }

    boot();

    return () => {
      isCancelled = true;
    };
  }, [authToken, core, handleSaveState, platform, romId, romName]);

  return (
    <div className="flex flex-1 flex-col gap-4">
      <div
        ref={containerRef}
        className="relative flex aspect-video w-full items-center justify-center overflow-hidden rounded-pixel border border-ink/80 bg-night"
      >
        {status === "loading" && (
          <span className="text-sm uppercase tracking-widest text-parchment/70">Preparing emulator…</span>
        )}
        {status === "error" && error && (
          <span className="text-sm text-coral">{error}</span>
        )}
        <canvas className="h-full w-full" data-testid="emulator-canvas" />
      </div>
      <MobileControls onVirtualKey={emitVirtualKey} />
    </div>
  );
}
