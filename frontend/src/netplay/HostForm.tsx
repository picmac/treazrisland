'use client';

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createNetplaySession, type NetplaySession } from "@lib/api/netplay";
import { ApiError } from "@lib/api/client";

interface HostFormProps {
  onHosted?: (session: NetplaySession) => void;
}

const MIN_EXPIRY_MINUTES = 5;
const MAX_EXPIRY_MINUTES = 360;

export function HostForm({ onHosted }: HostFormProps) {
  const router = useRouter();
  const [romId, setRomId] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [expiresInMinutes, setExpiresInMinutes] = useState(30);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSuccessMessage(null);

    const form = event.currentTarget;
    const romField = form.elements.namedItem("romId") as HTMLInputElement | null;
    const displayField = form.elements.namedItem("displayName") as HTMLInputElement | null;
    const expiryField = form.elements.namedItem("expiresInMinutes") as HTMLInputElement | null;

    const rawRomId = romField?.value ?? romId;
    const rawDisplayName = displayField?.value ?? displayName;
    const minutesValue = expiryField ? Number(expiryField.value) : expiresInMinutes;
    const normalizedMinutes = Number.isFinite(minutesValue) ? minutesValue : expiresInMinutes;

    setRomId(rawRomId);
    setDisplayName(rawDisplayName);
    setExpiresInMinutes(normalizedMinutes);

    if (normalizedMinutes < MIN_EXPIRY_MINUTES || normalizedMinutes > MAX_EXPIRY_MINUTES) {
      setError(`Session expiry must be between ${MIN_EXPIRY_MINUTES} and ${MAX_EXPIRY_MINUTES} minutes.`);
      return;
    }

    const payload = {
      expiresInMinutes: normalizedMinutes,
      ...(rawRomId.trim() ? { romId: rawRomId.trim() } : {}),
      ...(rawDisplayName.trim() ? { displayName: rawDisplayName.trim() } : {})
    };

    setIsSubmitting(true);

    try {
      const result = await createNetplaySession(payload);
      const session = result.session;
      setSuccessMessage(`Session ready! Share code ${session.code.toUpperCase()}`);
      setRomId("");
      onHosted?.(session);
      router.refresh();
    } catch (err) {
      if (err instanceof ApiError) {
        setError(`${err.status}: ${err.message}`);
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Unknown error while creating session");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form className="space-y-4" onSubmit={handleSubmit} noValidate>
      <div className="space-y-1">
        <h3 className="text-lg font-semibold uppercase tracking-[0.3em] text-lagoon">Host a session</h3>
        <p className="text-xs text-parchment/70">
          Launch a lobby for your crew. The join code will be generated instantly so you can share it right away.
        </p>
      </div>

      <div className="space-y-1">
        <label className="block text-xs uppercase tracking-[0.3em] text-parchment/80" htmlFor="netplay-rom-id">
          ROM ID (optional)
        </label>
        <input
          id="netplay-rom-id"
          name="romId"
          type="text"
          value={romId}
          onChange={(event) => setRomId(event.target.value)}
          placeholder="rom_123"
          className="w-full rounded-pixel border border-ink/60 bg-night/70 px-3 py-2 text-sm text-parchment shadow-pixel-inset focus:border-lagoon focus:outline-none"
        />
      </div>

      <div className="space-y-1">
        <label className="block text-xs uppercase tracking-[0.3em] text-parchment/80" htmlFor="netplay-display-name">
          Display name (optional)
        </label>
        <input
          id="netplay-display-name"
          name="displayName"
          type="text"
          value={displayName}
          onChange={(event) => setDisplayName(event.target.value)}
          placeholder="Captain Pixel"
          className="w-full rounded-pixel border border-ink/60 bg-night/70 px-3 py-2 text-sm text-parchment shadow-pixel-inset focus:border-lagoon focus:outline-none"
        />
      </div>

      <div className="space-y-1">
        <label className="block text-xs uppercase tracking-[0.3em] text-parchment/80" htmlFor="netplay-expiry">
          Session length (minutes)
        </label>
        <input
          id="netplay-expiry"
          name="expiresInMinutes"
          type="number"
          min={MIN_EXPIRY_MINUTES}
          max={MAX_EXPIRY_MINUTES}
          value={Number.isNaN(expiresInMinutes) ? "" : expiresInMinutes}
          onChange={(event) => setExpiresInMinutes(Number(event.target.value))}
          className="w-full rounded-pixel border border-ink/60 bg-night/70 px-3 py-2 text-sm text-parchment shadow-pixel-inset focus:border-lagoon focus:outline-none"
        />
        <p className="text-xs text-parchment/60">Choose between 5 minutes and 6 hours.</p>
      </div>

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full rounded-pixel bg-kelp px-4 py-2 text-xs font-bold uppercase tracking-[0.4em] text-night shadow-pixel transition hover:bg-lagoon disabled:opacity-60"
      >
        {isSubmitting ? "Creating session…" : "Host session"}
      </button>

      {successMessage && (
        <p className="rounded-pixel border border-lagoon/60 bg-night/60 px-3 py-2 text-xs text-lagoon">{successMessage}</p>
      )}

      {error && <p className="text-xs text-red-300">{error}</p>}
    </form>
  );
}
