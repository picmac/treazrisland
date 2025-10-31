import React from "react";
import { act, render, screen, waitFor } from "@testing-library/react";
import EmulatorPlayer from "./EmulatorPlayer";

vi.mock("@/lib/emulator/loadBundle", () => ({
  loadEmulatorBundle: vi.fn(() => Promise.resolve())
}));

const loadEmulatorBundleModule = await import("@/lib/emulator/loadBundle");
const originalFetch = global.fetch;
const navigatorWithGamepads = navigator as Navigator & { getGamepads?: () => (Gamepad | null)[] };
const originalGetGamepads = navigatorWithGamepads.getGamepads;

type EmulatorWindow = Window & {
  EJS_player?: vi.Mock;
};

describe("EmulatorPlayer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi
      .fn((input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === "string" ? input : input.toString();

        if (url.includes("/api/player/roms/") && url.endsWith("/binary")) {
          return Promise.resolve(
            new Response(new Uint8Array([1, 2, 3, 4]), {
              status: 200,
              headers: { "Content-Type": "application/octet-stream" }
            })
          );
        }

        if (url.includes("/player/play-states") && (!init || init.method === undefined)) {
          return Promise.resolve(
            new Response(JSON.stringify({ playStates: [] }), {
              status: 200,
              headers: { "Content-Type": "application/json" }
            })
          );
        }

        if (url.includes("/player/play-states") && init?.method === "POST") {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                id: "state-1",
                romId: "rom-2",
                label: null,
                slot: null,
                size: 8,
                checksumSha256: "abc",
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                downloadUrl: "/player/play-states/state-1/binary"
              }),
              {
                status: 201,
                headers: { "Content-Type": "application/json" }
              }
            )
          );
        }

        return Promise.reject(new Error(`Unexpected fetch call for ${url}`));
      }) as unknown as typeof fetch;

    const emulatorWindow = window as EmulatorWindow;
    emulatorWindow.EJS_player = vi.fn();
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:rom");
  });

  afterEach(() => {
    global.fetch = originalFetch;
    const emulatorWindow = window as EmulatorWindow;
    delete emulatorWindow.EJS_player;
    if (originalGetGamepads) {
      Object.defineProperty(window.navigator, "getGamepads", {
        configurable: true,
        value: originalGetGamepads
      });
    } else {
      delete navigatorWithGamepads.getGamepads;
    }
    vi.restoreAllMocks();
  });

  it("bootstraps the emulator once the bundle and ROM are loaded", async () => {
    const loadSpy = loadEmulatorBundleModule.loadEmulatorBundle as unknown as vi.Mock;

    render(<EmulatorPlayer romId="rom-1" romName="Chrono Trigger" platform="snes" />);

    await waitFor(() => {
      expect(window.EJS_player).toHaveBeenCalled();
    });

    expect(loadSpy).toHaveBeenCalled();
    const config = (window.EJS_player as vi.Mock).mock.calls[0][0];
    expect(config.gameName).toBe("Chrono Trigger");
    expect(config.system).toBe("snes9x");
    expect(config.onSaveState).toBeTypeOf("function");
    expect(config.loadStateUrl).toBeNull();
    expect(config.customOptions?.systemId).toBe("snes");
    expect(config.customOptions?.preferredCores).toEqual(["snes9x", "bsnes"]);
  });

  it("delegates save-state callbacks to the provided handler", async () => {
    const onSaveState = vi.fn();

    render(
      <EmulatorPlayer romId="rom-2" romName="Super Metroid" platform="snes" onSaveState={onSaveState} />
    );

    await waitFor(() => {
      expect(window.EJS_player).toHaveBeenCalled();
    });

    const config = (window.EJS_player as vi.Mock).mock.calls[0][0];
    const payload = new ArrayBuffer(8);
    await act(async () => {
      await config.onSaveState?.(payload);
    });

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/player/play-states"),
        expect.objectContaining({ method: "POST" })
      );
    });
    expect(onSaveState).toHaveBeenCalledWith(payload);
  });

  it("normalizes platform identifiers when choosing emulator cores", async () => {
    render(<EmulatorPlayer romId="rom-3" romName="Metal Slug" platform="neoGeo" />);

    await waitFor(() => {
      expect(window.EJS_player).toHaveBeenCalled();
    });

    const config = (window.EJS_player as vi.Mock).mock.calls.at(-1)?.[0];
    expect(config?.system).toBe("fbneo");
    expect(config?.customOptions?.systemId).toBe("arcade");
    expect(config?.customOptions?.preferredCores).toEqual([
      "fbneo",
      "fbalpha2012_cps1",
      "fbalpha2012_cps2",
      "same_cdi"
    ]);
  });

  it("surfaces an error when the requested platform lacks a mapped core", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    render(<EmulatorPlayer romId="rom-4" romName="Crazy Taxi" platform="dreamcast" />);

    await waitFor(() => {
      expect(screen.getByText(/is not supported/i)).toBeInTheDocument();
    });

    const loadSpy = loadEmulatorBundleModule.loadEmulatorBundle as unknown as vi.Mock;
    expect(loadSpy).not.toHaveBeenCalled();
    expect(window.EJS_player).not.toHaveBeenCalled();

    warnSpy.mockRestore();
  });

  it("emits keyboard events for connected gamepads", () => {
    const events: Array<{ type: string; key: string }> = [];
    const handler = (event: KeyboardEvent) => {
      events.push({ type: event.type, key: event.key });
    };

    window.addEventListener("keydown", handler);
    window.addEventListener("keyup", handler);

    const rafCallbacks: FrameRequestCallback[] = [];
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback: FrameRequestCallback) => {
      rafCallbacks.push(callback);
      return rafCallbacks.length;
    });
    vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {});

    const createGamepad = (pressedButtons: Record<number, boolean>) => {
      const buttons = Array.from({ length: 16 }, (_, index) => {
        const pressed = Boolean(pressedButtons[index]);
        return {
          pressed,
          touched: pressed,
          value: pressed ? 1 : 0
        };
      });

      return {
        id: "test-pad",
        index: 0,
        connected: true,
        mapping: "standard",
        buttons,
        axes: [0, 0, 0, 0],
        timestamp: Date.now()
      } as unknown as Gamepad;
    };

    const gamepadFrames: (Gamepad | null)[][] = [
      [createGamepad({})],
      [
        createGamepad({
          12: true,
          0: true,
          1: true,
          2: true,
          3: true,
          8: true,
          9: true
        })
      ],
      [createGamepad({})]
    ];

    let frameIndex = 0;
    const getGamepadsMock = vi.fn(() => {
      const current = gamepadFrames[Math.min(frameIndex, gamepadFrames.length - 1)];
      return current;
    });

    Object.defineProperty(window.navigator, "getGamepads", {
      configurable: true,
      value: getGamepadsMock
    });

    const runFrame = () => {
      const callback = rafCallbacks.shift();
      if (!callback) {
        throw new Error("No frame callback queued");
      }
      act(() => {
        callback(0);
      });
      frameIndex += 1;
    };

    render(<EmulatorPlayer romId="rom-5" romName="Secret of Mana" platform="snes" />);

    expect(rafCallbacks.length).toBeGreaterThan(0);

    runFrame();
    expect(events).toEqual([]);

    runFrame();
    expect(events).toEqual([
      { type: "keydown", key: "ArrowUp" },
      { type: "keydown", key: "KeyX" },
      { type: "keydown", key: "KeyZ" },
      { type: "keydown", key: "KeyA" },
      { type: "keydown", key: "KeyS" },
      { type: "keydown", key: "Enter" },
      { type: "keydown", key: "ShiftRight" }
    ]);

    runFrame();
    expect(events).toEqual([
      { type: "keydown", key: "ArrowUp" },
      { type: "keydown", key: "KeyX" },
      { type: "keydown", key: "KeyZ" },
      { type: "keydown", key: "KeyA" },
      { type: "keydown", key: "KeyS" },
      { type: "keydown", key: "Enter" },
      { type: "keydown", key: "ShiftRight" },
      { type: "keyup", key: "ArrowUp" },
      { type: "keyup", key: "KeyX" },
      { type: "keyup", key: "KeyZ" },
      { type: "keyup", key: "KeyA" },
      { type: "keyup", key: "KeyS" },
      { type: "keyup", key: "Enter" },
      { type: "keyup", key: "ShiftRight" }
    ]);

    window.removeEventListener("keydown", handler);
    window.removeEventListener("keyup", handler);
  });
});
