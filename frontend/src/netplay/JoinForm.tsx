'use client';

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { joinNetplaySession, type NetplaySession } from "@lib/api/netplay";
import { ApiError } from "@lib/api/client";

interface JoinFormProps {
  onJoined?: (session: NetplaySession) => void;
}

export function JoinForm({ onJoined }: JoinFormProps) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSuccessMessage(null);

    const formData = new FormData(event.currentTarget);
    const rawCode = (formData.get("joinCode") as string | null) ?? code;
    const rawDisplayName = (formData.get("displayName") as string | null) ?? displayName;

    setCode(rawCode);
    setDisplayName(rawDisplayName);

    const normalizedCode = rawCode.trim().toUpperCase();
    if (!normalizedCode) {
      setError("Enter a join code to connect to a session.");
      return;
    }

    const normalizedDisplay = rawDisplayName.trim();
    const payload = {
      code: normalizedCode,
      ...(normalizedDisplay ? { displayName: normalizedDisplay } : {})
    };

    setIsSubmitting(true);

    try {
      const result = await joinNetplaySession(payload);
      const session = result.session;
      setCode(normalizedCode);
      setSuccessMessage(`Joined session ${session.code.toUpperCase()}!`);
      onJoined?.(session);
      router.refresh();
    } catch (err) {
      if (err instanceof ApiError) {
        setError(`${err.status}: ${err.message}`);
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Unknown error while joining session");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form className="space-y-4" onSubmit={handleSubmit} noValidate>
      <div className="space-y-1">
        <h3 className="text-lg font-semibold uppercase tracking-[0.3em] text-lagoon">Join a crew</h3>
        <p className="text-xs text-parchment/70">
          Enter the join code shared by your host to drop into the session instantly.
        </p>
      </div>

      <div className="space-y-1">
        <label className="block text-xs uppercase tracking-[0.3em] text-parchment/80" htmlFor="netplay-code">
          Join code
        </label>
        <input
          id="netplay-code"
          name="joinCode"
          type="text"
          value={code}
          onChange={(event) => setCode(event.target.value)}
          placeholder="ABCD"
          className="w-full rounded-pixel border border-ink/60 bg-night/70 px-3 py-2 text-sm text-parchment shadow-pixel-inset focus:border-lagoon focus:outline-none"
        />
      </div>

      <div className="space-y-1">
        <label className="block text-xs uppercase tracking-[0.3em] text-parchment/80" htmlFor="netplay-join-display">
          Display name (optional)
        </label>
        <input
          id="netplay-join-display"
          name="displayName"
          type="text"
          value={displayName}
          onChange={(event) => setDisplayName(event.target.value)}
          placeholder="Deckhand"
          className="w-full rounded-pixel border border-ink/60 bg-night/70 px-3 py-2 text-sm text-parchment shadow-pixel-inset focus:border-lagoon focus:outline-none"
        />
      </div>

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full rounded-pixel bg-lagoon px-4 py-2 text-xs font-bold uppercase tracking-[0.4em] text-night shadow-pixel transition hover:bg-kelp disabled:opacity-60"
      >
        {isSubmitting ? "Connecting…" : "Join session"}
      </button>

      {successMessage && (
        <p className="rounded-pixel border border-lagoon/60 bg-night/60 px-3 py-2 text-xs text-lagoon">{successMessage}</p>
      )}

      {error && <p className="text-xs text-red-300">{error}</p>}
    </form>
  );
}
