"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";
import { loadEmulatorBundle } from "@/lib/emulator/loadBundle";
import { getPlatformConfig, type EmulatorPlatformConfig } from "@/lib/emulator/platforms";
import MobileControls from "@/components/MobileControls";
import EmulatorCanvas from "@/components/player/EmulatorCanvas";
import { useSession } from "@auth/session-provider";
import {
  createPlayState,
  deletePlayState,
  listPlayStates,
  requestRomBinary,
  updatePlayState,
  type PlayState,
} from "@lib/api/player";

const FALLBACK_PLATFORM_CONFIG: EmulatorPlatformConfig =
  getPlatformConfig("snes") ?? {
    systemId: "snes",
    defaultCore: "snes9x",
    preferredCores: ["snes9x", "bsnes"]
  };

function sortPlayStates(states: PlayState[]): PlayState[] {
  return [...states].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );
}

function formatPlayStateName(state: PlayState): string {
  if (state.label && state.label.trim().length > 0) {
    return state.label;
  }

  if (typeof state.slot === "number") {
    return `Slot ${state.slot}`;
  }

  return "Quick save";
}

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
  const [pendingStateIds, setPendingStateIds] = useState<string[]>([]);
  const [editingStateId, setEditingStateId] = useState<string | null>(null);
  const [labelDraft, setLabelDraft] = useState<string>("");
  const [renameError, setRenameError] = useState<string | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const { accessToken } = useSession();
  const platformConfig = useMemo(() => getPlatformConfig(platform), [platform]);
  const activePlatformConfig = platformConfig ?? FALLBACK_PLATFORM_CONFIG;
  const { defaultCore, preferredCores, systemId } = activePlatformConfig;
  const effectiveToken = authToken ?? accessToken ?? undefined;
  const slotOptions = useMemo(() => Array.from({ length: 4 }, (_, index) => index), []);

  const markStatePending = useCallback((id: string) => {
    setPendingStateIds((previous) =>
      previous.includes(id) ? previous : [...previous, id],
    );
  }, []);

  const clearStatePending = useCallback((id: string) => {
    setPendingStateIds((previous) => previous.filter((entry) => entry !== id));
  }, []);

  const integrateUpdatedState = useCallback((updated: PlayState) => {
    setPlayStates((previous) => {
      const filtered = previous.filter(
        (state) =>
          state.id !== updated.id &&
          !(
            typeof updated.slot === "number" &&
            typeof state.slot === "number" &&
            state.slot === updated.slot
          ),
      );
      return sortPlayStates([updated, ...filtered]);
    });
  }, []);

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
        integrateUpdatedState(savedState);
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
    [integrateUpdatedState, onSaveState, romId]
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

        const sortedStates = sortPlayStates(loadedStates);
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
            const isMutating = pendingStateIds.includes(state.id);
            const isPending = isSaving || isMutating;
            const displayName = formatPlayStateName(state);
            const sizeKb = Math.max(1, Math.round(state.size / 1024));
            const isEditing = editingStateId === state.id;

            const handleSlotChange = async (
              event: ChangeEvent<HTMLSelectElement>
            ) => {
              const { value } = event.target;
              if (value === "") {
                return;
              }

              const parsed = Number.parseInt(value, 10);
              if (Number.isNaN(parsed) || parsed === state.slot) {
                return;
              }

              const previousStates = playStates.map((entry) => ({ ...entry }));
              markStatePending(state.id);
              const optimisticTimestamp = new Date().toISOString();

              setPlayStates((previous) => {
                const filtered = previous.filter(
                  (entry) =>
                    entry.id !== state.id &&
                    !(
                      typeof entry.slot === "number" &&
                      entry.slot === parsed
                    )
                );
                const existing = previous.find((entry) => entry.id === state.id);
                const optimisticState = existing
                  ? { ...existing, slot: parsed, updatedAt: optimisticTimestamp }
                  : { ...state, slot: parsed, updatedAt: optimisticTimestamp };
                return sortPlayStates([optimisticState, ...filtered]);
              });

              try {
                const updated = await updatePlayState(state.id, { slot: parsed });
                integrateUpdatedState(updated);
              } catch (err) {
                console.error("Failed to move play state", err);
                setPlayStates(previousStates);
              } finally {
                clearStatePending(state.id);
              }
            };

            const handleRenameSubmit = async (
              event: FormEvent<HTMLFormElement>
            ) => {
              event.preventDefault();
              const trimmed = labelDraft.trim();

              if (trimmed.length === 0) {
                setRenameError("Name must be at least one character");
                return;
              }

              if (trimmed === (state.label ?? "")) {
                setEditingStateId(null);
                setLabelDraft("");
                setRenameError(null);
                return;
              }

              const previousStates = playStates.map((entry) => ({ ...entry }));
              const optimisticTimestamp = new Date().toISOString();
              markStatePending(state.id);
              setRenameError(null);

              setPlayStates((previous) =>
                sortPlayStates(
                  previous.map((entry) =>
                    entry.id === state.id
                      ? { ...entry, label: trimmed, updatedAt: optimisticTimestamp }
                      : entry
                  )
                )
              );

              try {
                const updated = await updatePlayState(state.id, { label: trimmed });
                integrateUpdatedState(updated);
                setEditingStateId(null);
                setLabelDraft("");
                setRenameError(null);
              } catch (err) {
                console.error("Failed to rename play state", err);
                setPlayStates(previousStates);
                const previous = previousStates.find((entry) => entry.id === state.id);
                setLabelDraft(previous?.label ?? "");
                setRenameError("Failed to rename play state. Please try again.");
              } finally {
                clearStatePending(state.id);
              }
            };

            const handleReuploadChange = async (
              event: ChangeEvent<HTMLInputElement>
            ) => {
              const file = event.target.files?.[0];
              if (!file) {
                return;
              }

              const previousStates = playStates.map((entry) => ({ ...entry }));
              markStatePending(state.id);
              const optimisticTimestamp = new Date().toISOString();

              setPlayStates((previous) =>
                sortPlayStates(
                  previous.map((entry) =>
                    entry.id === state.id
                      ? {
                          ...entry,
                          size: file.size,
                          updatedAt: optimisticTimestamp,
                        }
                      : entry
                  )
                )
              );

              try {
                const buffer = await file.arrayBuffer();
                const updated = await updatePlayState(state.id, { data: buffer });
                integrateUpdatedState(updated);
              } catch (err) {
                console.error("Failed to re-upload play state", err);
                setPlayStates(previousStates);
              } finally {
                event.target.value = "";
                clearStatePending(state.id);
              }
            };

            const handleDelete = async () => {
              const previousStates = playStates.map((entry) => ({ ...entry }));
              markStatePending(state.id);
              setPlayStates((previous) =>
                previous.filter((entry) => entry.id !== state.id)
              );

              try {
                await deletePlayState(state.id);
                if (editingStateId === state.id) {
                  setEditingStateId(null);
                  setLabelDraft("");
                  setRenameError(null);
                }
              } catch (err) {
                console.error("Failed to delete play state", err);
                setPlayStates(previousStates);
              } finally {
                clearStatePending(state.id);
              }
            };

            return (
              <li
                key={state.id}
                className="rounded-pixel border border-ink/40 bg-night/40 px-3 py-3 text-sm text-parchment"
              >
                <div className="flex flex-col gap-3">
                  <div className="flex items-start justify-between gap-4 sm:items-center">
                    <div className="flex flex-col">
                      <span className="font-semibold text-lagoon">
                        {displayName}
                        {isPending
                          ? isSaving
                            ? " · Saving…"
                            : " · Updating…"
                          : ""}
                      </span>
                      <span className="text-xs text-parchment/60">
                        Updated {new Date(state.updatedAt).toLocaleString()}
                      </span>
                    </div>
                    <span className="shrink-0 text-xs text-parchment/60">{sizeKb} KB</span>
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-2">
                      <label
                        className="text-xs uppercase tracking-widest text-parchment/60"
                        htmlFor={`slot-${state.id}`}
                      >
                        Slot
                      </label>
                      <select
                        id={`slot-${state.id}`}
                        aria-label={`Assign slot for ${displayName}`}
                        className="rounded-pixel border border-ink/40 bg-night/80 px-2 py-1 text-xs text-parchment focus:outline-none focus:ring-2 focus:ring-lagoon"
                        value={
                          typeof state.slot === "number"
                            ? String(state.slot)
                            : ""
                        }
                        onChange={handleSlotChange}
                        disabled={isMutating}
                      >
                        <option value="">
                          {typeof state.slot === "number"
                            ? "Select slot"
                            : "Quick save"}
                        </option>
                        {slotOptions.map((slot) => (
                          <option key={slot} value={String(slot)}>
                            Slot {slot}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingStateId(state.id);
                          setLabelDraft(state.label ?? "");
                          setRenameError(null);
                        }}
                        className="rounded-pixel border border-ink/40 px-3 py-1 text-xs uppercase tracking-widest text-parchment/80 transition hover:border-lagoon hover:text-lagoon disabled:cursor-not-allowed disabled:border-ink/20 disabled:text-parchment/30"
                        disabled={
                          isMutating ||
                          (editingStateId !== null && editingStateId !== state.id)
                        }
                        aria-label={`Rename ${displayName}`}
                      >
                        Rename
                      </button>
                      <div>
                        <input
                          id={`reupload-${state.id}`}
                          data-testid={`reupload-input-${state.id}`}
                          ref={(element) => {
                            if (element) {
                              fileInputRefs.current[state.id] = element;
                            } else {
                              delete fileInputRefs.current[state.id];
                            }
                          }}
                          type="file"
                          className="hidden"
                          accept=".state,.bin,.sav,.zip,.gz,.bz2,application/octet-stream"
                          onChange={handleReuploadChange}
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const input = fileInputRefs.current[state.id];
                            input?.click();
                          }}
                          className="rounded-pixel border border-ink/40 px-3 py-1 text-xs uppercase tracking-widest text-parchment/80 transition hover:border-lagoon hover:text-lagoon disabled:cursor-not-allowed disabled:border-ink/20 disabled:text-parchment/30"
                          disabled={isMutating}
                          aria-label={`Re-upload ${displayName}`}
                        >
                          Re-upload
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={handleDelete}
                        className="rounded-pixel border border-danger/60 px-3 py-1 text-xs uppercase tracking-widest text-danger/80 transition hover:border-danger hover:text-danger disabled:cursor-not-allowed disabled:border-ink/20 disabled:text-parchment/30"
                        disabled={isMutating}
                        aria-label={`Delete ${displayName}`}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                  {isEditing && (
                    <form
                      className="flex flex-col gap-2 sm:flex-row sm:items-center"
                      onSubmit={handleRenameSubmit}
                    >
                      <label className="sr-only" htmlFor={`rename-${state.id}`}>
                        Rename {displayName}
                      </label>
                      <input
                        id={`rename-${state.id}`}
                        value={labelDraft}
                        onChange={(event) => setLabelDraft(event.target.value)}
                        className="w-full rounded-pixel border border-ink/40 bg-night/80 px-3 py-2 text-sm text-parchment focus:outline-none focus:ring-2 focus:ring-lagoon"
                        placeholder={displayName}
                        disabled={isMutating}
                      />
                      <div className="flex gap-2">
                        <button
                          type="submit"
                          className="rounded-pixel border border-lagoon px-3 py-2 text-xs uppercase tracking-widest text-lagoon transition hover:border-lagoon/80 hover:text-lagoon/80 disabled:cursor-not-allowed disabled:border-ink/20 disabled:text-parchment/30"
                          disabled={isMutating}
                        >
                          Save name
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingStateId(null);
                            setLabelDraft("");
                            setRenameError(null);
                          }}
                          className="rounded-pixel border border-ink/40 px-3 py-2 text-xs uppercase tracking-widest text-parchment/80 transition hover:border-ink/60 hover:text-parchment disabled:cursor-not-allowed disabled:border-ink/20 disabled:text-parchment/30"
                          disabled={isMutating}
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  )}
                  {isEditing && renameError && (
                    <p className="text-xs text-danger/80">{renameError}</p>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </section>
      <MobileControls onVirtualKey={emitVirtualKey} />
    </div>
  );
}
