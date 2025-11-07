import { render, screen, waitFor, act, fireEvent } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import EmulatorPlayer from "./EmulatorPlayer";
import { loadEmulatorBundle } from "@/lib/emulator/loadBundle";
import { createPlayState, listPlayStates, requestRomBinary } from "@lib/api/player";

vi.mock("@/lib/emulator/loadBundle", () => ({
  loadEmulatorBundle: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@lib/api/player", () => ({
  listPlayStates: vi.fn(),
  createPlayState: vi.fn(),
  requestRomBinary: vi.fn(),
}));

vi.mock("@/components/MobileControls", () => ({
  __esModule: true,
  default: ({ onVirtualKey }: { onVirtualKey: (key: string, pressed: boolean) => void }) => (
    <button data-testid="mobile-controls" type="button" onClick={() => onVirtualKey("KeyA", true)}>
      mobile-controls
    </button>
  ),
}));

describe("EmulatorPlayer", () => {
  beforeEach(() => {
    vi.mocked(loadEmulatorBundle).mockResolvedValue(undefined);
    vi.mocked(listPlayStates).mockResolvedValue([]);
    vi.mocked(createPlayState).mockResolvedValue({
      id: "state-new",
      romId: "rom-1",
      label: null,
      slot: null,
      size: 4,
      checksumSha256: "new",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      downloadUrl: "/player/play-states/state-new/binary",
    });
    vi.mocked(requestRomBinary).mockResolvedValue({
      type: "signed-url",
      url: "https://example.com/rom.zip",
    });

    Object.defineProperty(window, "navigator", {
      value: { getGamepads: () => [] },
      configurable: true,
    });
    window.requestAnimationFrame = vi.fn((cb: FrameRequestCallback) => {
      cb(performance.now());
      return 1;
    });
    window.cancelAnimationFrame = vi.fn();
    (window as typeof window & { EJS_player?: ReturnType<typeof vi.fn> }).EJS_player = vi.fn();
  });

  it("boots EmulatorJS with a signed ROM URL and loads recent play state", async () => {
    const playState = {
      id: "state-1",
      romId: "rom-1",
      label: "Dungeon",
      slot: 0,
      size: 123,
      checksumSha256: "checksum",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      downloadUrl: "/player/play-states/state-1/binary",
    };
    vi.mocked(listPlayStates).mockResolvedValueOnce([playState]);

    const onSaveSpy = vi.fn();
    render(
      <EmulatorPlayer
        romId="rom-1"
        romName="Chrono Trigger"
        platform="snes"
        onSaveState={onSaveSpy}
      />,
    );

    await waitFor(() => {
      expect(window.EJS_player).toHaveBeenCalled();
    });

    const config = vi.mocked(window.EJS_player).mock.calls[0]?.[0] as Record<string, unknown>;
    expect(config.gameUrl).toBe("https://example.com/rom.zip");
    expect(config.system).toBe("snes9x");
    expect(config.loadStateUrl).toBe("/api/player/play-states/state-1/binary");

    const savedBuffer = new ArrayBuffer(8);
    const saveHandler = config.onSaveState as (payload: ArrayBuffer) => void;

    await act(async () => {
      await saveHandler(savedBuffer);
    });

    expect(createPlayState).toHaveBeenCalledWith({ romId: "rom-1", data: savedBuffer });
    expect(onSaveSpy).toHaveBeenCalledWith(savedBuffer);

    fireEvent.click(await screen.findByTestId("mobile-controls"));
  });

  it("creates an object URL when the ROM is streamed inline", async () => {
    const arrayBuffer = new Uint8Array([1, 2, 3]).buffer;
    const createObjectURL = vi.fn().mockReturnValue("blob:rom-object");
    const revokeObjectURL = vi.fn();
    global.URL.createObjectURL = createObjectURL;
    global.URL.revokeObjectURL = revokeObjectURL;

    vi.mocked(requestRomBinary).mockResolvedValueOnce({
      type: "inline",
      data: arrayBuffer,
      contentType: "application/octet-stream",
    });

    const { unmount } = render(
      <EmulatorPlayer romId="rom-2" romName="Metroid" platform="snes" />,
    );

    await waitFor(() => {
      expect(createObjectURL).toHaveBeenCalled();
    });
    expect(window.EJS_player).toHaveBeenCalled();

    unmount();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:rom-object");
  });
});
