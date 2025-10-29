"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ApiError } from "@lib/api/client";
import { hostNetplaySession, type NetplaySession } from "@lib/api/netplay";

interface HostFormProps {
  onHosted?: (session: NetplaySession) => void;
}

export function HostForm({ onHosted }: HostFormProps) {
  const router = useRouter();
  const [romId, setRomId] = useState("");
  const [ttlMinutes, setTtlMinutes] = useState<number>(60);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    startTransition(async () => {
      try {
        const result = await hostNetplaySession({
          romId: romId.trim() ? romId.trim() : undefined,
          ttlMinutes
        });

        setSuccessMessage(`Session ready! Share code ${result.session.joinCode}`);
        onHosted?.(result.session);
        router.refresh();
      } catch (error) {
        if (error instanceof ApiError) {
          setErrorMessage(`${error.status}: ${error.message}`);
        } else if (error instanceof Error) {
          setErrorMessage(error.message);
        } else {
          setErrorMessage("Failed to create session");
        }
      }
    });
  };

  return (
    <form className="space-y-4 text-parchment" onSubmit={handleSubmit}>
      <div className="space-y-2">
        <h2 className="text-xl font-bold text-lagoon">Host a session</h2>
        <p className="text-sm text-parchment/80">
          Launch a cooperative dock for your crew. Share the join code so friends can embark in seconds.
        </p>
      </div>

      <div className="space-y-1">
        <label className="block text-xs uppercase tracking-widest text-parchment/70" htmlFor="host-rom-id">
          ROM ID (optional)
        </label>
        <input
          id="host-rom-id"
          type="text"
          value={romId}
          onChange={(event) => setRomId(event.target.value)}
          placeholder="rom_abc123"
          className="w-full rounded-pixel border border-ink/60 bg-night/90 px-3 py-2 text-sm text-parchment placeholder:text-parchment/40 focus:border-lagoon focus:outline-none"
        />
      </div>

      <div className="space-y-1">
        <label className="block text-xs uppercase tracking-widest text-parchment/70" htmlFor="host-ttl">
          Session length (minutes)
        </label>
        <input
          id="host-ttl"
          type="number"
          min={5}
          max={360}
          value={ttlMinutes}
          onChange={(event) => setTtlMinutes(Number(event.target.value))}
          className="w-full rounded-pixel border border-ink/60 bg-night/90 px-3 py-2 text-sm text-parchment focus:border-lagoon focus:outline-none"
        />
        <p className="text-xs text-parchment/60">Choose between 5 and 360 minutes. Defaults to 60 minutes.</p>
      </div>

      <button
        type="submit"
        className="pixel-button w-full justify-center text-center"
        disabled={isPending}
      >
        {isPending ? "Hoisting sails…" : "Create session"}
      </button>

      {successMessage && (
        <div className="rounded-pixel border border-lagoon/50 bg-lagoon/10 px-3 py-2 text-sm text-lagoon">
          {successMessage}
        </div>
      )}

      {errorMessage && <p className="text-sm text-red-300">{errorMessage}</p>}
    </form>
  );
}
