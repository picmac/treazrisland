"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ApiError } from "@lib/api/client";
import { joinNetplaySession, type NetplaySession } from "@lib/api/netplay";

interface JoinFormProps {
  onJoined?: (session: NetplaySession) => void;
}

export function JoinForm({ onJoined }: JoinFormProps) {
  const router = useRouter();
  const [joinCode, setJoinCode] = useState("");
  const [nickname, setNickname] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);
    setConfirmation(null);

    startTransition(async () => {
      try {
        const result = await joinNetplaySession({
          joinCode: joinCode.trim(),
          nickname: nickname.trim() ? nickname.trim() : undefined
        });
        setConfirmation(`Anchored in ${result.session.joinCode}!`);
        onJoined?.(result.session);
        router.refresh();
      } catch (error) {
        if (error instanceof ApiError) {
          setErrorMessage(`${error.status}: ${error.message}`);
        } else if (error instanceof Error) {
          setErrorMessage(error.message);
        } else {
          setErrorMessage("Failed to join session");
        }
      }
    });
  };

  return (
    <form className="space-y-4 text-parchment" onSubmit={handleSubmit}>
      <div className="space-y-2">
        <h2 className="text-xl font-bold text-lagoon">Join a session</h2>
        <p className="text-sm text-parchment/80">Enter the share code from your host to start playing together.</p>
      </div>

      <div className="space-y-1">
        <label className="block text-xs uppercase tracking-widest text-parchment/70" htmlFor="join-code">
          Join code
        </label>
        <input
          id="join-code"
          type="text"
          value={joinCode}
          onChange={(event) => setJoinCode(event.target.value.toUpperCase())}
          placeholder="ABCD"
          required
          className="w-full rounded-pixel border border-ink/60 bg-night/90 px-3 py-2 text-sm uppercase tracking-[0.3em] text-parchment placeholder:text-parchment/40 focus:border-lagoon focus:outline-none"
        />
      </div>

      <div className="space-y-1">
        <label className="block text-xs uppercase tracking-widest text-parchment/70" htmlFor="join-nickname">
          Display name (optional)
        </label>
        <input
          id="join-nickname"
          type="text"
          value={nickname}
          onChange={(event) => setNickname(event.target.value)}
          placeholder="Deckhand"
          className="w-full rounded-pixel border border-ink/60 bg-night/90 px-3 py-2 text-sm text-parchment placeholder:text-parchment/40 focus:border-lagoon focus:outline-none"
        />
      </div>

      <button type="submit" className="pixel-button w-full" disabled={isPending || joinCode.trim().length === 0}>
        {isPending ? "Casting lines…" : "Join session"}
      </button>

      {confirmation && (
        <div className="rounded-pixel border border-lagoon/50 bg-lagoon/10 px-3 py-2 text-sm text-lagoon">{confirmation}</div>
      )}

      {errorMessage && <p className="text-sm text-red-300">{errorMessage}</p>}
    </form>
  );
}
