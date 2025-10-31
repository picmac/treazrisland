import { beforeAll, beforeEach, afterAll, describe, expect, it, vi } from "vitest";

vi.mock("./client", () => ({
  apiFetch: vi.fn(),
}));

import { apiFetch } from "./client";
import {
  listPlayStates,
  createPlayState,
  listRecentPlayStates,
  type PlayState,
  type RecentPlayState,
} from "./player";

beforeAll(() => {
  vi.stubGlobal(
    "btoa",
    (value: string) => Buffer.from(value, "binary").toString("base64"),
  );
});

afterAll(() => {
  vi.unstubAllGlobals();
});

describe("player api", () => {
  beforeEach(() => {
    vi.mocked(apiFetch).mockReset();
  });

  it("fetches play states for a rom", async () => {
    const playStates: PlayState[] = [];
    vi.mocked(apiFetch).mockResolvedValueOnce({ playStates });

    const result = await listPlayStates("rom-1");

    expect(apiFetch).toHaveBeenCalledWith("/player/play-states?romId=rom-1");
    expect(result).toBe(playStates);
  });

  it("creates a play state payload from an ArrayBuffer", async () => {
    const payload = { romId: "rom-1", data: new Uint8Array([1, 2, 3]).buffer };
    const expectedBase64 = Buffer.from([1, 2, 3]).toString("base64");
    const created: PlayState = {
      id: "state-1",
      romId: "rom-1",
      label: null,
      slot: null,
      size: 3,
      checksumSha256: "abc",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      downloadUrl: "/player/play-states/state-1/binary",
    };
    vi.mocked(apiFetch).mockResolvedValueOnce(created);

    const result = await createPlayState(payload);

    expect(apiFetch).toHaveBeenCalledWith(
      "/player/play-states",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ romId: "rom-1", data: expectedBase64 }),
      }),
    );
    expect(result).toBe(created);
  });

  it("fetches recent play states with rom context", async () => {
    const recent: RecentPlayState[] = [];
    vi.mocked(apiFetch).mockResolvedValueOnce({ recent });

    const result = await listRecentPlayStates();

    expect(apiFetch).toHaveBeenCalledWith("/player/play-states/recent");
    expect(result).toBe(recent);
  });
});
