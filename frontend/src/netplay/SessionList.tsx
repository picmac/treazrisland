"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError } from "@lib/api/client";
import { cancelNetplaySession, type NetplaySession } from "@lib/api/netplay";
import { PixelFrame } from "@/src/components/pixel-frame";

interface SessionListProps {
  sessions: NetplaySession[];
}

export function SessionList({ sessions }: SessionListProps) {
  const router = useRouter();
  const [activeSession, setActiveSession] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleCancel = async (sessionId: string) => {
    setActiveSession(sessionId);
    setErrorMessage(null);

    try {
      await cancelNetplaySession(sessionId);
      router.refresh();
    } catch (error) {
      if (error instanceof ApiError) {
        setErrorMessage(`${error.status}: ${error.message}`);
      } else if (error instanceof Error) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage("Unable to manage session");
      }
    } finally {
      setActiveSession(null);
    }
  };

  if (sessions.length === 0) {
    return <p className="text-sm text-parchment/70">No netplay sessions yet. Host or join a crew to see them here.</p>;
  }

  return (
    <div className="space-y-4">
      {sessions.map((session) => (
        <PixelFrame key={session.id} className="space-y-3 bg-night/80 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold text-lagoon">Session {session.joinCode}</h3>
              <p className="text-xs uppercase tracking-widest text-parchment/60">
                Status: {session.status.toLowerCase()} • Expires {new Date(session.expiresAt).toLocaleTimeString()}
              </p>
            </div>
            {(session.canManage || session.isHost) && (
              <button
                type="button"
                className="pixel-button"
                onClick={() => handleCancel(session.id)}
                disabled={activeSession === session.id}
              >
                {activeSession === session.id ? "Closing…" : "Cancel session"}
              </button>
            )}
          </div>

          <div>
            <h4 className="text-xs uppercase tracking-widest text-parchment/70">Crew manifest</h4>
            <ul className="mt-2 grid gap-2 sm:grid-cols-2">
              {session.participants.map((participant) => (
                <li
                  key={participant.id}
                  className="rounded-pixel border border-lagoon/40 bg-night/90 px-3 py-2 text-sm text-parchment"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">
                      {participant.nickname || "Unknown pirate"}
                    </span>
                    {participant.isHost && <span className="text-xs uppercase text-lagoon">Host</span>}
                  </div>
                  <p className="text-xs text-parchment/60">
                    {participant.status.toLowerCase()} • Joined {new Date(participant.joinedAt).toLocaleTimeString()}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </PixelFrame>
      ))}

      {errorMessage && <p className="text-sm text-red-300">{errorMessage}</p>}
    </div>
  );
}
