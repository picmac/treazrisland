"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { PixelButton, PixelInput } from "@/src/components/pixel";
import { useSession } from "@/src/auth/session-provider";
import {
  closeNetplaySession,
  createNetplaySession,
  inviteToNetplaySession,
  joinNetplaySession,
  listNetplaySessions,
  sendNetplayHeartbeat,
} from "@lib/api/netplay";
import type { NetplayParticipant, NetplaySession } from "@lib/api/netplay/types";
import { useNetplaySignal } from "@lib/api/netplay/useNetplaySignal";

type NetplayControlsProps = {
  romId: string;
};

const HEARTBEAT_INTERVAL_MS = 30_000;

const formatStatus = (status: string) =>
  status
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

const formatTimestamp = (value?: string) => {
  if (!value) {
    return "–";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "–";
  }

  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};

export default function NetplayControls({ romId }: NetplayControlsProps) {
  const { user, accessToken } = useSession();
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<NetplaySession | null>(null);
  const [peerToken, setPeerToken] = useState<string | null>(null);
  const [inviteUserId, setInviteUserId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const sessionId = session?.id ?? null;

  const sortedParticipants = useMemo(() => {
    if (!session) {
      return [] as NetplayParticipant[];
    }

    return [...session.participants].sort((a, b) => {
      if (a.userId === session.hostId) {
        return -1;
      }
      if (b.userId === session.hostId) {
        return 1;
      }
      return a.userId.localeCompare(b.userId);
    });
  }, [session]);

  const persistPeerToken = useCallback((sessionId: string, token: string) => {
    setPeerToken(token);
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem(`netplay:token:${sessionId}`, token);
    }
  }, []);

  const clearStoredToken = useCallback((sessionId?: string | null) => {
    if (typeof window === "undefined" || !sessionId) {
      return;
    }

    window.sessionStorage.removeItem(`netplay:token:${sessionId}`);
  }, []);

  const loadSessions = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await listNetplaySessions();
      const existing = response.sessions.find(
        (entry) => entry.romId === romId && entry.status !== "CLOSED",
      );

      if (existing) {
        setSession(existing);
        if (typeof window !== "undefined") {
          const stored = window.sessionStorage.getItem(
            `netplay:token:${existing.id}`,
          );
          if (stored) {
            setPeerToken(stored);
          }
        }
      } else {
        setSession((previous) => {
          if (previous) {
            clearStoredToken(previous.id);
          }
          return null;
        });
        setPeerToken(null);
      }
    } catch (err) {
      console.error("Failed to load netplay sessions", err);
      setError("Unable to load netplay sessions right now.");
    } finally {
      setLoading(false);
    }
  }, [clearStoredToken, romId]);

  useEffect(() => {
    loadSessions().catch(() => {
      /* handled in loadSessions */
    });
  }, [loadSessions]);

  useEffect(() => {
    if (!sessionId) {
      return;
    }

    if (typeof window === "undefined") {
      return;
    }

    const stored = window.sessionStorage.getItem(`netplay:token:${sessionId}`);
    if (stored) {
      setPeerToken(stored);
    }
  }, [sessionId]);

  const handleSessionClosed = useCallback(
    (payload: { sessionId: string; reason: "closed" | "expired" | "not_found" }) => {
      setSession((previous) => {
        if (previous) {
          clearStoredToken(previous.id);
        }
        return null;
      });
      setPeerToken(null);
      if (payload.reason === "expired") {
        setError("The netplay session has expired.");
      }
    },
    [clearStoredToken],
  );

  const { connected, latency } = useNetplaySignal({
    sessionId,
    peerToken: peerToken ?? null,
    accessToken: accessToken ?? undefined,
    onSessionUpdate: setSession,
    onPeerToken: persistPeerToken,
    onSessionClosed: handleSessionClosed,
  });

  useEffect(() => {
    if (!sessionId || !peerToken) {
      return;
    }

    sendNetplayHeartbeat(sessionId, {
      peerToken,
      status: connected ? "connected" : "disconnected",
    }).catch(() => {
      /* heartbeat failures are logged server-side */
    });
  }, [connected, peerToken, sessionId]);

  useEffect(() => {
    if (!sessionId || !peerToken) {
      return;
    }

    const interval = window.setInterval(() => {
      sendNetplayHeartbeat(sessionId, {
        peerToken,
        status: connected ? "connected" : "disconnected",
      }).catch(() => {
        /* ignore interval failures */
      });
    }, HEARTBEAT_INTERVAL_MS);

    return () => {
      clearInterval(interval);
    };
  }, [connected, peerToken, sessionId]);

  const handleCreateSession = useCallback(async () => {
    setError(null);
    try {
      const response = await createNetplaySession({ romId });
      setSession(response.session);
      persistPeerToken(response.session.id, response.peerToken);
    } catch (err) {
      console.error("Failed to create netplay session", err);
      setError("Could not start a netplay session. Please try again.");
    }
  }, [persistPeerToken, romId]);

  const handleInvite = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!session || inviteUserId.trim().length === 0) {
        return;
      }

      setError(null);
      try {
        const response = await inviteToNetplaySession(session.id, inviteUserId.trim());
        setSession(response.session);
        setInviteUserId("");
      } catch (err) {
        console.error("Failed to invite player", err);
        setError("Unable to send the invitation. Check the user ID and try again.");
      }
    },
    [inviteUserId, session],
  );

  const handleJoin = useCallback(async () => {
    if (!session) {
      return;
    }

    setError(null);
    try {
      const response = await joinNetplaySession(session.id);
      setSession(response.session);
      persistPeerToken(response.session.id, response.peerToken);
    } catch (err) {
      console.error("Failed to join netplay session", err);
      setError("Unable to join the session. Please try again.");
    }
  }, [persistPeerToken, session]);

  const handleClose = useCallback(async () => {
    if (!session) {
      return;
    }

    setError(null);
    try {
      await closeNetplaySession(session.id);
      clearStoredToken(session.id);
      setSession(null);
      setPeerToken(null);
    } catch (err) {
      console.error("Failed to close netplay session", err);
      setError("Could not close the session. Please try again.");
    }
  }, [clearStoredToken, session]);

  const handleCopyPeerToken = useCallback(async () => {
    if (!peerToken) {
      return;
    }

    if (typeof navigator === "undefined" || typeof navigator.clipboard?.writeText !== "function") {
      setError("Clipboard access is not available in this browser.");
      return;
    }

    try {
      await navigator.clipboard.writeText(peerToken);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy peer token", err);
      setError("Could not copy the peer token. Please copy it manually.");
    }
  }, [peerToken]);

  const participantSelf = session?.participants.find(
    (participant) => participant.userId === user?.id,
  );

  const canJoin = Boolean(
    participantSelf &&
      ["INVITED", "DISCONNECTED"].includes(participantSelf.status.toUpperCase()),
  );

  return (
    <section className="rounded-3xl border border-[color:var(--surface-outline-subtle)] bg-surface-sunken/70 p-4 shadow-inner">
      <header className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold uppercase tracking-widest text-lagoon">
            Netplay Session
          </h2>
          <p className="text-xs uppercase tracking-[0.3em] text-parchment/60">
            {session ? formatStatus(session.status) : "No active session"}
          </p>
        </div>
        <div className="text-xs text-parchment/70">
          {connected ? (
            <span className="text-[color:var(--color-primary)]">
              Signal connected
              {typeof latency === "number" && Number.isFinite(latency)
                ? ` • ${Math.round(latency)}ms`
                : ""}
            </span>
          ) : (
            <span className="text-[color:var(--color-danger)]">Signal offline</span>
          )}
        </div>
      </header>

      {error && (
        <p className="mt-3 text-sm text-[color:var(--color-danger)]">{error}</p>
      )}

      {loading ? (
        <p className="mt-4 text-sm text-parchment/70">Loading netplay status…</p>
      ) : session ? (
        <div className="mt-4 flex flex-col gap-4">
          {peerToken && (
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-parchment/60">
                  Your peer token
                </p>
                <code className="block break-all rounded-md bg-surface-deep/70 px-3 py-2 text-xs text-parchment">
                  {peerToken}
                </code>
              </div>
              <div className="flex items-center gap-2">
                <PixelButton variant="secondary" size="sm" onClick={handleCopyPeerToken}>
                  Copy
                </PixelButton>
                {copied && (
                  <span className="text-xs text-[color:var(--color-primary)]">Copied!</span>
                )}
              </div>
            </div>
          )}

          <div>
            <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-parchment/70">
              Participants
            </h3>
            <ul className="mt-2 divide-y divide-[color:var(--surface-outline-subtle)] border border-[color:var(--surface-outline-subtle)] bg-surface-translucent">
              {sortedParticipants.map((participant) => {
                const isSelf = participant.userId === user?.id;
                const label = isSelf ? "You" : participant.userId;
                const roleLabel = participant.userId === session.hostId ? "Host" : "Player";

                return (
                  <li
                    key={participant.id}
                    className="flex flex-col gap-1 px-3 py-2 text-xs text-parchment sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex flex-col gap-0.5">
                      <span className="font-semibold text-parchment">
                        {label}
                        <span className="ml-2 text-[color:var(--surface-outline-strong)]">{roleLabel}</span>
                      </span>
                      <span className="uppercase tracking-[0.3em] text-parchment/60">
                        {formatStatus(participant.status)}
                      </span>
                    </div>
                    <div className="text-[11px] uppercase tracking-[0.3em] text-parchment/40">
                      Last seen {formatTimestamp(participant.lastHeartbeatAt)}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>

          {participantSelf && canJoin && (
            <PixelButton variant="primary" onClick={handleJoin} disabled={loading}>
              Join session
            </PixelButton>
          )}

          {session.hostId === user?.id && (
            <div className="flex flex-col gap-3">
              <form className="flex flex-col gap-2 sm:flex-row sm:items-center" onSubmit={handleInvite}>
                <PixelInput
                  value={inviteUserId}
                  onChange={(event) => setInviteUserId(event.target.value)}
                  placeholder="Enter player user ID"
                />
                <PixelButton type="submit" variant="secondary" disabled={inviteUserId.trim().length === 0}>
                  Invite player
                </PixelButton>
              </form>
              <PixelButton variant="danger" onClick={handleClose}>
                End session
              </PixelButton>
            </div>
          )}
        </div>
      ) : (
        <div className="mt-4 flex flex-col gap-3">
          <p className="text-sm text-parchment/70">
            Start a session to invite friends and trade peer tokens for WebRTC play.
          </p>
          <PixelButton onClick={handleCreateSession}>Start netplay session</PixelButton>
        </div>
      )}
    </section>
  );
}
