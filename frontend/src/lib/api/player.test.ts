import { beforeAll, beforeEach, afterAll, afterEach, describe, expect, it, vi } from "vitest";

vi.mock("./client", async () => {
  const actual = await vi.importActual<typeof import("./client")>("./client");
  return {
    __esModule: true as const,
    API_BASE: actual.API_BASE,
    ApiError: actual.ApiError,
    apiFetch: vi.fn(),
  };
});

import { apiFetch } from "./client";
import {
  listPlayStates,
  createPlayState,
  listRecentPlayStates,
  requestRomBinary,
  type PlayState,
  type RecentPlayState,
} from "./player";

let originalBtoa: typeof btoa | undefined;
const originalFetch = globalThis.fetch;

beforeAll(() => {
  originalBtoa = globalThis.btoa;
  globalThis.btoa = ((value: string) =>
    Buffer.from(value, "binary").toString("base64")) as typeof btoa;
});

afterAll(() => {
  if (originalBtoa) {
    globalThis.btoa = originalBtoa;
  } else {
    Reflect.deleteProperty(globalThis, "btoa");
  }

  if (originalFetch) {
    globalThis.fetch = originalFetch;
  } else {
    Reflect.deleteProperty(globalThis, "fetch");
  }
});

describe("player api", () => {
  beforeEach(() => {
    vi.mocked(apiFetch).mockReset();
    if (originalFetch) {
      globalThis.fetch = originalFetch;
    } else {
      Reflect.deleteProperty(globalThis, "fetch");
    }
  });

  afterEach(() => {
    if (originalFetch) {
      globalThis.fetch = originalFetch;
    } else {
      Reflect.deleteProperty(globalThis, "fetch");
    }
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

  it("requests a signed ROM URL when provided by the backend", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => ({ type: "signed-url", url: "https://example.com/rom.zip", size: 4096 }),
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const result = await requestRomBinary("rom-1");

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/player/roms/rom-1/binary"),
      expect.objectContaining({
        credentials: "include",
        headers: expect.any(Headers),
      }),
    );
    expect(result).toEqual({
      type: "signed-url",
      url: "https://example.com/rom.zip",
      contentType: undefined,
      size: 4096,
    });
  });

  it("returns inline binary data when the backend streams the ROM", async () => {
    const buffer = new Uint8Array([1, 2, 3]).buffer;
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "application/octet-stream" }),
      arrayBuffer: async () => buffer,
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const result = await requestRomBinary("rom-2");

    expect(result.type).toBe("inline");
    if (result.type === "inline") {
      expect(result.data).toBe(buffer);
      expect(result.contentType).toBe("application/octet-stream");
    }
  });
});
