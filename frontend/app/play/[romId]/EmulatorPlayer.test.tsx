import { render, screen, waitFor, act, fireEvent } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import EmulatorPlayer from "./EmulatorPlayer";
import { loadEmulatorBundle } from "@/lib/emulator/loadBundle";
import {
  createPlayState,
  deletePlayState,
  listPlayStates,
  requestRomBinary,
  updatePlayState,
} from "@lib/api/player";

vi.mock("@/lib/emulator/loadBundle", () => ({
  loadEmulatorBundle: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@lib/api/player", () => ({
  listPlayStates: vi.fn(),
  createPlayState: vi.fn(),
  requestRomBinary: vi.fn(),
  updatePlayState: vi.fn(),
  deletePlayState: vi.fn(),
}));

vi.mock("@auth/session-provider", () => ({
  useSession: () => ({
    user: null,
    accessToken: "test-token",
    loading: false,
    login: vi.fn(),
    logout: vi.fn(),
    refresh: vi.fn(),
    setSession: vi.fn(),
    clearSession: vi.fn()
  })
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
      downloadUrl: "/play-states/state-new/binary",
    });
    vi.mocked(updatePlayState).mockReset();
    vi.mocked(deletePlayState).mockReset();
    vi.mocked(updatePlayState).mockResolvedValue({
      id: "state-1",
      romId: "rom-1",
      label: "Dungeon",
      slot: 0,
      size: 4,
      checksumSha256: "checksum",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      downloadUrl: "/play-states/state-1/binary",
    });
    vi.mocked(deletePlayState).mockResolvedValue(undefined);
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

  it("shows the preparing message while the bundle is loading", async () => {
    let resolveBundle: (() => void) | undefined;
    const bundlePromise = new Promise<void>((resolve) => {
      resolveBundle = resolve;
    });

    vi.mocked(loadEmulatorBundle).mockReturnValueOnce(bundlePromise);

    render(<EmulatorPlayer romId="rom-1" romName="Chrono Trigger" platform="snes" />);

    expect(screen.getByText("Preparing emulator…")).toBeInTheDocument();

    await act(async () => {
      resolveBundle?.();
    });

    await waitFor(() => {
      expect(window.EJS_player).toHaveBeenCalled();
    });
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
      downloadUrl: "/play-states/state-1/binary",
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

    expect(requestRomBinary).toHaveBeenCalledWith("rom-1", { authToken: "test-token" });

    const config = vi.mocked(window.EJS_player).mock.calls[0]?.[0] as Record<string, unknown>;
    expect(config.gameUrl).toBe("https://example.com/rom.zip");
    expect(config.system).toBe("snes9x");
    expect(config.loadStateUrl).toBe("/api/play-states/state-1/binary");

    const savedBuffer = new ArrayBuffer(8);
    const saveHandler = config.onSaveState as (payload: ArrayBuffer) => void;

    await act(async () => {
      await saveHandler(savedBuffer);
    });

    expect(createPlayState).toHaveBeenCalledWith({
      romId: "rom-1",
      data: savedBuffer,
      slot: 0
    });
    expect(onSaveSpy).toHaveBeenCalledWith(savedBuffer);

    fireEvent.click(await screen.findByTestId("mobile-controls"));
    expect(await screen.findByRole("button", { name: /Slot 0/ })).toBeInTheDocument();
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

  it("allows renaming a play state", async () => {
    const initialPlayState = {
      id: "state-rename",
      romId: "rom-1",
      label: "Dungeon",
      slot: 0,
      size: 1024,
      checksumSha256: "checksum",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      downloadUrl: "/play-states/state-rename/binary",
    };

    vi.mocked(listPlayStates).mockResolvedValueOnce([initialPlayState]);

    const updatedPlayState = {
      ...initialPlayState,
      label: "Mountain Pass",
      updatedAt: new Date(Date.now() + 1000).toISOString(),
    };

    vi.mocked(updatePlayState).mockResolvedValueOnce(updatedPlayState);

    render(
      <EmulatorPlayer romId="rom-1" romName="Chrono Trigger" platform="snes" />,
    );

    const renameButton = await screen.findByRole("button", {
      name: /rename dungeon/i,
    });

    fireEvent.click(renameButton);

    const input = await screen.findByRole("textbox", { name: /rename dungeon/i });
    fireEvent.change(input, { target: { value: "  Mountain Pass  " } });

    const saveButton = screen.getByRole("button", { name: /save name/i });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(updatePlayState).toHaveBeenCalledWith("state-rename", {
        label: "Mountain Pass",
      });
    });

    await waitFor(() => {
      expect(screen.getByText(/Mountain Pass/)).toBeInTheDocument();
    });
  });

  it("reverts label changes when renaming fails", async () => {
    const initialPlayState = {
      id: "state-rename-fail",
      romId: "rom-1",
      label: "Forest",
      slot: 0,
      size: 2048,
      checksumSha256: "checksum",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      downloadUrl: "/play-states/state-rename-fail/binary",
    };

    vi.mocked(listPlayStates).mockResolvedValueOnce([initialPlayState]);
    vi.mocked(updatePlayState).mockRejectedValueOnce(new Error("boom"));

    render(
      <EmulatorPlayer romId="rom-1" romName="Chrono Trigger" platform="snes" />,
    );

    fireEvent.click(await screen.findByRole("button", { name: /rename forest/i }));
    const input = await screen.findByRole("textbox", { name: /rename forest/i });
    fireEvent.change(input, { target: { value: "Forest Prime" } });

    fireEvent.click(screen.getByRole("button", { name: /save name/i }));

    await waitFor(() => {
      expect(updatePlayState).toHaveBeenCalledWith("state-rename-fail", {
        label: "Forest Prime",
      });
    });

    await waitFor(() => {
      expect(screen.getByText(/Failed to rename play state/)).toBeInTheDocument();
      expect(input).toHaveValue("Forest");
      expect(screen.getByText(/Forest/, { selector: "span" })).toBeInTheDocument();
    });
  });

  it("reassigns a save state slot", async () => {
    const playStates = [
      {
        id: "state-slot-1",
        romId: "rom-1",
        label: "Camp",
        slot: 0,
        size: 4096,
        checksumSha256: "checksum",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        downloadUrl: "/play-states/state-slot-1/binary",
      },
    ];

    vi.mocked(listPlayStates).mockResolvedValueOnce(playStates);

    const updatedState = {
      ...playStates[0],
      slot: 2,
      updatedAt: new Date(Date.now() + 2000).toISOString(),
    };
    vi.mocked(updatePlayState).mockResolvedValueOnce(updatedState);

    render(
      <EmulatorPlayer romId="rom-1" romName="Chrono Trigger" platform="snes" />,
    );

    const slotSelect = await screen.findByLabelText(/assign slot for camp/i);
    fireEvent.change(slotSelect, { target: { value: "2" } });

    await waitFor(() => {
      expect(updatePlayState).toHaveBeenCalledWith("state-slot-1", { slot: 2 });
    });

    await waitFor(() => {
      expect(screen.getByLabelText(/assign slot for camp/i)).toHaveValue("2");
    });
  });

  it("re-uploads a save state", async () => {
    const playState = {
      id: "state-upload",
      romId: "rom-1",
      label: "Boss",
      slot: 1,
      size: 512,
      checksumSha256: "checksum",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      downloadUrl: "/play-states/state-upload/binary",
    };

    vi.mocked(listPlayStates).mockResolvedValueOnce([playState]);

    const newBuffer = new Uint8Array([9, 9, 9]).buffer;
    vi.mocked(updatePlayState).mockResolvedValueOnce({
      ...playState,
      size: 2048,
      updatedAt: new Date(Date.now() + 3000).toISOString(),
    });

    const arrayBufferSpy = vi
      .spyOn(File.prototype, "arrayBuffer")
      .mockResolvedValueOnce(newBuffer);

    render(
      <EmulatorPlayer romId="rom-1" romName="Chrono Trigger" platform="snes" />,
    );

    const input = await screen.findByTestId("reupload-input-state-upload");
    const file = new File([new Uint8Array([1, 2, 3])], "save.sav", {
      type: "application/octet-stream",
    });

    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(updatePlayState).toHaveBeenCalledWith("state-upload", {
        data: newBuffer,
      });
    });

    arrayBufferSpy.mockRestore();
  });

  it("deletes a play state and removes it from the list", async () => {
    const playState = {
      id: "state-delete",
      romId: "rom-1",
      label: "Overworld",
      slot: 1,
      size: 512,
      checksumSha256: "checksum",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      downloadUrl: "/play-states/state-delete/binary",
    };

    vi.mocked(listPlayStates).mockResolvedValueOnce([playState]);

    render(
      <EmulatorPlayer romId="rom-1" romName="Chrono Trigger" platform="snes" />,
    );

    fireEvent.click(await screen.findByRole("button", { name: /delete overworld/i }));

    await waitFor(() => {
      expect(deletePlayState).toHaveBeenCalledWith("state-delete");
    });

    await waitFor(() => {
      expect(screen.queryByText(/Overworld/)).not.toBeInTheDocument();
    });
  });
});
