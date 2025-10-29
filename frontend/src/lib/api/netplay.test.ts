import { vi, describe, it, expect, beforeEach } from "vitest";

vi.mock("@lib/api/client", () => ({
  apiFetch: vi.fn()
}));

import { apiFetch } from "@lib/api/client";
import {
  hostNetplaySession,
  joinNetplaySession,
  listNetplaySessions,
  cancelNetplaySession,
  leaveNetplaySession
} from "./netplay";

describe("netplay api helpers", () => {
  beforeEach(() => {
    vi.mocked(apiFetch).mockReset();
  });

  it("posts host payload", async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce({ session: { id: "session_1" } });

    await hostNetplaySession({ romId: "rom_1", ttlMinutes: 120 });

    expect(apiFetch).toHaveBeenCalledWith(
      "/netplay/sessions",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ romId: "rom_1", ttlMinutes: 120 })
      })
    );
  });

  it("joins a session by code", async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce({ session: { id: "session_2" }, participant: { id: "participant_1" } });

    await joinNetplaySession({ joinCode: "ABCD", nickname: "Player" });

    expect(apiFetch).toHaveBeenCalledWith(
      "/netplay/sessions/join",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ joinCode: "ABCD", nickname: "Player" })
      })
    );
  });

  it("lists user sessions", async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce({ sessions: [] });

    await listNetplaySessions();

    expect(apiFetch).toHaveBeenCalledWith(
      "/netplay/sessions",
      expect.objectContaining({
        method: "GET"
      })
    );
  });

  it("cancels a session", async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce({ success: true });

    await cancelNetplaySession("session_3");

    expect(apiFetch).toHaveBeenCalledWith(
      "/netplay/sessions/session_3",
      expect.objectContaining({
        method: "DELETE"
      })
    );
  });

  it("leaves a session", async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce({ success: true });

    await leaveNetplaySession("session_4");

    expect(apiFetch).toHaveBeenCalledWith(
      "/netplay/sessions/session_4/leave",
      expect.objectContaining({
        method: "POST"
      })
    );
  });
});
