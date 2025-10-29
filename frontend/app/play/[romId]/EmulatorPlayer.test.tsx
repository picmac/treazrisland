import React from "react";
import { render, waitFor } from "@testing-library/react";
import EmulatorPlayer from "./EmulatorPlayer";

vi.mock("@/lib/emulator/loadBundle", () => ({
  loadEmulatorBundle: vi.fn(() => Promise.resolve())
}));

const loadEmulatorBundleModule = await import("@/lib/emulator/loadBundle");
const originalFetch = global.fetch;

describe("EmulatorPlayer", () => {
  beforeEach(() => {
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(4))
      })
    ) as unknown as typeof fetch;

    (window as any).EJS_player = vi.fn();
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:rom");
  });

  afterEach(() => {
    global.fetch = originalFetch;
    delete (window as any).EJS_player;
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
    await config.onSaveState?.(payload);

    expect(onSaveState).toHaveBeenCalledWith(payload);
  });
});
