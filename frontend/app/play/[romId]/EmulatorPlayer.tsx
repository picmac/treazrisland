"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { loadEmulatorBundle } from "@/lib/emulator/loadBundle";
import { getPlatformConfig, type EmulatorPlatformConfig } from "@/lib/emulator/platforms";
import MobileControls from "@/components/MobileControls";
import {
  createPlayState,
  listPlayStates,
  requestRomBinary,
  type PlayState,
} from "@lib/api/player";

const FALLBACK_PLATFORM_CONFIG: EmulatorPlatformConfig =
  getPlatformConfig("snes") ?? {
    systemId: "snes",
    defaultCore: "snes9x",
    preferredCores: ["snes9x", "bsnes"]
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
  const [, setPlayStates] = useState<PlayState[]>([]);
  const objectUrlRef = useRef<string | null>(null);
  const platformConfig = useMemo(() => getPlatformConfig(platform), [platform]);
  const activePlatformConfig = platformConfig ?? FALLBACK_PLATFORM_CONFIG;
  const { defaultCore, preferredCores, systemId } = activePlatformConfig;

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
      code: key,
      bubbles: true
    });
    window.dispatchEvent(event);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.navigator === "undefined") {
      return;
    }

    const { navigator } = window;
    if (typeof navigator.getGamepads !== "function") {
      return;
    }

    const gamepadMappings: Array<{ button: number; key: string }> = [
      { button: 12, key: "ArrowUp" },
      { button: 13, key: "ArrowDown" },
      { button: 14, key: "ArrowLeft" },
      { button: 15, key: "ArrowRight" },
      { button: 0, key: "KeyX" },
      { button: 1, key: "KeyZ" },
      { button: 2, key: "KeyA" },
      { button: 3, key: "KeyS" },
      { button: 9, key: "Enter" },
      { button: 8, key: "ShiftRight" }
    ];

    let isUnmounted = false;
    let animationFrameId: number | null = null;
    let loopActive = false;
    const buttonStates = new Map<string, boolean>();

    const releaseKeysForGamepad = (gamepadIndex: number | null) => {
      for (const [stateKey, wasPressed] of buttonStates.entries()) {
        const [indexPart, key] = stateKey.split(":", 2);
        const index = Number.parseInt(indexPart, 10);
        if (Number.isNaN(index)) {
          continue;
        }

        if (gamepadIndex === null || index === gamepadIndex) {
          if (wasPressed) {
            emitVirtualKey(key, false);
          }
          buttonStates.delete(stateKey);
        }
      }
    };

    const pollGamepads = () => {
      if (isUnmounted) {
        return;
      }

      const connectedIndices = new Set<number>();
      const gamepads = navigator.getGamepads?.() ?? [];

      for (const gamepad of gamepads) {
        if (!gamepad) {
          continue;
        }

        connectedIndices.add(gamepad.index);

        for (const mapping of gamepadMappings) {
          const buttonStateKey = `${gamepad.index}:${mapping.key}`;
          const button = gamepad.buttons?.[mapping.button];
          const pressed = Boolean(button?.pressed);
          const previouslyPressed = buttonStates.get(buttonStateKey) ?? false;

          if (pressed !== previouslyPressed) {
            emitVirtualKey(mapping.key, pressed);
            buttonStates.set(buttonStateKey, pressed);
          }
        }
      }

      for (const [stateKey, wasPressed] of buttonStates.entries()) {
        const [indexPart, key] = stateKey.split(":", 2);
        const index = Number.parseInt(indexPart, 10);
        if (!connectedIndices.has(index)) {
          if (wasPressed) {
            emitVirtualKey(key, false);
          }
          buttonStates.delete(stateKey);
        }
      }

      if (connectedIndices.size === 0) {
        loopActive = false;
        animationFrameId = null;
        return;
      }

      animationFrameId = window.requestAnimationFrame(pollGamepads);
    };

    const ensureLoop = () => {
      if (loopActive) {
        return;
      }

      loopActive = true;
      animationFrameId = window.requestAnimationFrame(pollGamepads);
    };

    const handleGamepadConnected = () => {
      ensureLoop();
    };

    const handleGamepadDisconnected = (event: GamepadEvent) => {
      releaseKeysForGamepad(event.gamepad.index);
    };

    window.addEventListener("gamepadconnected", handleGamepadConnected);
    window.addEventListener("gamepaddisconnected", handleGamepadDisconnected);

    const hasConnectedGamepads = () => {
      const gamepads = navigator.getGamepads?.() ?? [];
      return gamepads.some((gamepad) => gamepad?.connected);
    };

    if (hasConnectedGamepads()) {
      ensureLoop();
    }

    return () => {
      isUnmounted = true;
      loopActive = false;
      if (animationFrameId !== null) {
        window.cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
      }
      window.removeEventListener("gamepadconnected", handleGamepadConnected);
      window.removeEventListener("gamepaddisconnected", handleGamepadDisconnected);
      releaseKeysForGamepad(null);
    };
  }, [emitVirtualKey]);

  useEffect(() => {
    let isCancelled = false;

    async function boot() {
      setStatus("loading");
      setError(null);

      if (!platformConfig) {
        const normalized = platform.trim().length > 0 ? platform : "unknown";
        const message = `Platform "${normalized}" is not supported by the bundled EmulatorJS cores yet.`;
        console.warn(message);
        setError(message);
        setStatus("error");
        return;
      }

      try {
        await loadEmulatorBundle();
        const [romBinary, loadedStates] = await Promise.all([
          requestRomBinary(romId, authToken ? { authToken } : undefined),
          listPlayStates(romId).catch((err) => {
            console.error("Failed to load play states", err);
            return [] as PlayState[];
          })
        ]);
        if (isCancelled) {
          return;
        }

        setPlayStates(loadedStates);
        if (objectUrlRef.current) {
          URL.revokeObjectURL(objectUrlRef.current);
          objectUrlRef.current = null;
        }
        let romUrl = romBinary.type === "signed-url" ? romBinary.url : null;
        if (romBinary.type === "inline") {
          const romBlob = new Blob([romBinary.data], {
            type: romBinary.contentType ?? "application/octet-stream"
          });
          romUrl = URL.createObjectURL(romBlob);
          objectUrlRef.current = romUrl;
        }
        if (!romUrl) {
          throw new Error("ROM source could not be prepared");
        }
        const initialStateUrl = loadedStates[0]?.downloadUrl
          ? `/api${loadedStates[0].downloadUrl}`
          : null;

        (window as EmulatorWindow).EJS_player?.({
          gameUrl: romUrl,
          gameName: romName,
          system: defaultCore,
          onSaveState: handleSaveState,
          loadStateUrl: initialStateUrl,
          customOptions: {
            container: containerRef.current ?? undefined,
            romId,
            romName,
            systemId,
            preferredCores
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
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
    };
  }, [authToken, defaultCore, handleSaveState, platform, platformConfig, preferredCores, romId, romName, systemId]);

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
