'use client';

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { endNetplaySession, type NetplaySession } from "@lib/api/netplay";
import { ApiError } from "@lib/api/client";

interface SessionListProps {
  initialSessions: NetplaySession[];
}

export function SessionList({ initialSessions }: SessionListProps) {
  const router = useRouter();
  const [sessions, setSessions] = useState(initialSessions);
  const [error, setError] = useState<string | null>(null);
  const [pendingSessionId, setPendingSessionId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const handleEndSession = (sessionId: string) => {
    setError(null);
    setPendingSessionId(sessionId);

    startTransition(async () => {
      try {
        await endNetplaySession(sessionId);
        setSessions((current) => current.filter((session) => session.id !== sessionId));
        router.refresh();
      } catch (err) {
        if (err instanceof ApiError) {
          setError(`${err.status}: ${err.message}`);
        } else if (err instanceof Error) {
          setError(err.message);
        } else {
          setError("Unknown error while ending session");
        }
      } finally {
        setPendingSessionId(null);
      }
    });
  };

  if (sessions.length === 0) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-parchment/70">No active sessions yet. Host a lobby to get your crew connected.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {sessions.map((session) => (
        <article key={session.id} className="space-y-3 rounded-pixel border border-ink/60 bg-ink/30 p-4 shadow-pixel">
          <header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-parchment/60">Join code</p>
              <p className="font-mono text-lg uppercase tracking-[0.5em] text-parchment">{session.code.toUpperCase()}</p>
            </div>
            <div className="flex items-center gap-3">
              <ParticipantStatusBadge status={session.status} label="Session" />
              {session.isHost && (
                <button
                  type="button"
                  onClick={() => handleEndSession(session.id)}
                  disabled={pendingSessionId === session.id}
                  className="rounded-pixel bg-coral/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.3em] text-night shadow-pixel transition hover:bg-coral disabled:opacity-60"
                >
                  {pendingSessionId === session.id ? "Ending…" : "End session"}
                </button>
              )}
            </div>
          </header>

          <div className="space-y-2">
            <p className="text-xs uppercase tracking-[0.3em] text-parchment/60">Participants</p>
            <ul className="grid gap-2 md:grid-cols-2">
              {session.participants.map((participant) => (
                <li key={participant.id} className="rounded-pixel border border-ink/60 bg-night/60 px-3 py-2 shadow-pixel">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-parchment">
                      {participant.displayName?.trim() || participant.nickname}
                    </span>
                    <ParticipantStatusBadge status={participant.status} label={participant.role} />
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </article>
      ))}

      {error && <p className="text-xs text-red-300">{error}</p>}
    </div>
  );
}

function ParticipantStatusBadge({ status, label }: { status: string; label: string }) {
  const palette = getStatusPalette(status);
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-pixel border px-2 py-1 text-[0.6rem] font-semibold uppercase tracking-[0.3em] ${palette}`}
    >
      <span>{label}</span>
      <span>{formatStatus(status)}</span>
    </span>
  );
}

function getStatusPalette(status: string): string {
  const normalized = status.toUpperCase();
  switch (normalized) {
    case "ACTIVE":
    case "READY":
      return "border-lagoon/60 bg-lagoon/20 text-lagoon";
    case "PENDING":
    case "WAITING":
      return "border-parchment/40 bg-parchment/10 text-parchment";
    case "DISCONNECTED":
    case "ENDED":
      return "border-coral/60 bg-coral/20 text-coral";
    default:
      return "border-slate-500/50 bg-slate-500/10 text-slate-200";
  }
}

function formatStatus(status: string): string {
  return status
    .toLowerCase()
    .split("_")
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
}
