"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { loadEmulatorBundle } from "@/lib/emulator/loadBundle";
import { getPlatformConfig, type EmulatorPlatformConfig } from "@/lib/emulator/platforms";
import MobileControls from "@/components/MobileControls";
import EmulatorCanvas from "@/components/player/EmulatorCanvas";
import { useSession } from "@auth/session-provider";
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
  const [playStates, setPlayStates] = useState<PlayState[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<number>(0);
  const selectedSlotRef = useRef<number>(0);
  const [pendingSlots, setPendingSlots] = useState<number[]>([]);
  const objectUrlRef = useRef<string | null>(null);
  const { accessToken } = useSession();
  const platformConfig = useMemo(() => getPlatformConfig(platform), [platform]);
  const activePlatformConfig = platformConfig ?? FALLBACK_PLATFORM_CONFIG;
  const { defaultCore, preferredCores, systemId } = activePlatformConfig;
  const effectiveToken = authToken ?? accessToken ?? undefined;
  const slotOptions = useMemo(() => Array.from({ length: 4 }, (_, index) => index), []);

  useEffect(() => {
    selectedSlotRef.current = selectedSlot;
  }, [selectedSlot]);

  const handleSaveState = useCallback(
    async (payload: ArrayBuffer) => {
      const slotToUse = selectedSlotRef.current;
      if (typeof slotToUse === "number") {
        setPendingSlots((previous) =>
          previous.includes(slotToUse) ? previous : [...previous, slotToUse]
        );
      }
      try {
        const savedState = await createPlayState({
          romId,
          data: payload,
          slot: typeof slotToUse === "number" ? slotToUse : undefined,
        });
        setPlayStates((previous) => {
          const filtered = previous.filter((state) => {
            if (state.id === savedState.id) {
              return false;
            }
            if (
              typeof savedState.slot === "number" &&
              typeof state.slot === "number" &&
              state.slot === savedState.slot
            ) {
              return false;
            }
            return true;
          });
          return [savedState, ...filtered].sort(
            (a, b) =>
              new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
          );
        });
        if (typeof slotToUse === "number") {
          setPendingSlots((previous) =>
            previous.filter((slot) => slot !== slotToUse),
          );
        }
        await onSaveState?.(payload);
      } catch (err) {
        if (typeof slotToUse === "number") {
          setPendingSlots((previous) =>
            previous.filter((slot) => slot !== slotToUse),
          );
        }
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
          requestRomBinary(
            romId,
            effectiveToken ? { authToken: effectiveToken } : undefined
          ),
          listPlayStates(romId).catch((err) => {
            console.error("Failed to load play states", err);
            return [] as PlayState[];
          })
        ]);
        if (isCancelled) {
          return;
        }

        const sortedStates = [...loadedStates].sort(
          (a, b) =>
            new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        );
        setPlayStates(sortedStates);
        const defaultSlotValue =
          sortedStates.find((state) => typeof state.slot === "number")?.slot ?? 0;
        setSelectedSlot(defaultSlotValue);
        setPendingSlots([]);
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
  }, [defaultCore, effectiveToken, handleSaveState, platform, platformConfig, preferredCores, romId, romName, systemId]);

  return (
    <div className="flex flex-1 flex-col gap-4">
      <EmulatorCanvas ref={containerRef} status={status} error={error} />
      <section className="rounded-pixel border border-ink/60 bg-night/60 p-4">
        <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-semibold uppercase tracking-widest text-parchment">
              Save-state slots
            </h2>
            <p className="text-xs text-parchment/60">
              Choose an active slot before saving. Uploads replace any existing save in the same slot.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {slotOptions.map((slot) => {
              const isSelected = selectedSlot === slot;
              const isPending = pendingSlots.includes(slot);
              return (
                <button
                  key={slot}
                  type="button"
                  onClick={() => setSelectedSlot(slot)}
                  className={`rounded-pixel border px-3 py-2 text-xs font-semibold uppercase tracking-widest transition focus:outline-none focus:ring-2 focus:ring-lagoon ${
                    isSelected
                      ? "border-lagoon bg-lagoon/15 text-lagoon"
                      : "border-ink/50 text-parchment/70 hover:border-lagoon hover:text-lagoon"
                  }`}
                  disabled={isPending}
                >
                  {isPending ? `Slot ${slot} · Saving…` : `Slot ${slot}`}
                </button>
              );
            })}
          </div>
        </header>
        <ul className="mt-4 flex flex-col gap-2">
          {playStates.length === 0 && (
            <li className="rounded-pixel border border-dashed border-ink/40 bg-night/40 px-3 py-2 text-sm text-parchment/60">
              Cloud saves will appear here once you create your first snapshot.
            </li>
          )}
          {playStates.map((state) => {
            const isSaving =
              typeof state.slot === "number" && pendingSlots.includes(state.slot);
            const sizeKb = Math.max(1, Math.round(state.size / 1024));
            return (
              <li
                key={state.id}
                className="flex items-center justify-between rounded-pixel border border-ink/40 bg-night/40 px-3 py-2 text-sm text-parchment"
              >
                <div className="flex flex-col">
                  <span className="font-semibold text-lagoon">
                    {state.label ??
                      (typeof state.slot === "number"
                        ? `Slot ${state.slot}`
                        : "Quick save")}
                    {isSaving ? " · Saving…" : ""}
                  </span>
                  <span className="text-xs text-parchment/60">
                    Updated {new Date(state.updatedAt).toLocaleString()}
                  </span>
                </div>
                <span className="text-xs text-parchment/60">{sizeKb} KB</span>
              </li>
            );
          })}
        </ul>
      </section>
      <MobileControls onVirtualKey={emitVirtualKey} />
    </div>
  );
}
