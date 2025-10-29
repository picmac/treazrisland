import { vi, describe, it, expect, beforeEach } from "vitest";

vi.mock("@lib/api/client", () => ({
  apiFetch: vi.fn()
}));

import { apiFetch } from "@lib/api/client";
import {
  createNetplaySession,
  joinNetplaySession,
  listNetplaySessions,
  getNetplaySession,
  endNetplaySession
} from "./netplay";

describe("netplay api helpers", () => {
  beforeEach(() => {
    vi.mocked(apiFetch).mockReset();
  });

  it("creates a session", async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce({ session: { id: "session_1" } });

    await createNetplaySession({ romId: "rom_1", expiresInMinutes: 45, displayName: "Captain" });

    expect(apiFetch).toHaveBeenCalledWith(
      "/netplay/sessions",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ romId: "rom_1", expiresInMinutes: 45, displayName: "Captain" })
      })
    );
  });

  it("joins a session", async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce({
      session: { id: "session_1" },
      participant: { id: "participant_1" }
    });

    await joinNetplaySession({ code: "ABCD", displayName: "Crewmate" });

    expect(apiFetch).toHaveBeenCalledWith(
      "/netplay/sessions/join",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ code: "ABCD", displayName: "Crewmate" })
      })
    );
  });

  it("lists sessions", async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce({ sessions: [] });

    await listNetplaySessions();

    expect(apiFetch).toHaveBeenCalledWith(
      "/netplay/sessions",
      expect.objectContaining({
        method: "GET"
      })
    );
  });

  it("fetches session details", async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce({ session: { id: "session_1" } });

    await getNetplaySession("session_1");

    expect(apiFetch).toHaveBeenCalledWith(
      "/netplay/sessions/session_1",
      expect.objectContaining({
        method: "GET"
      })
    );
  });

  it("ends a session", async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce({ session: { id: "session_1" } });

    await endNetplaySession("session_1");

    expect(apiFetch).toHaveBeenCalledWith(
      "/netplay/sessions/session_1",
      expect.objectContaining({
        method: "DELETE"
      })
    );
  });
});
