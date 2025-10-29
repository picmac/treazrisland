'use client';

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createInvitation } from "@lib/api/invitations";
import { ApiError } from "@lib/api/client";

const ROLE_OPTIONS = [
  { label: "Player", value: "USER" },
  { label: "Administrator", value: "ADMIN" }
];

interface AdminInvitationFormProps {
  onCreated?: (args: {
    invitation: {
      id: string;
      role: string;
      email: string | null;
      expiresAt: string;
      redeemedAt: string | null;
      createdAt: string;
    };
    token: string;
  }) => void;
}

export function AdminInvitationForm({ onCreated }: AdminInvitationFormProps) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("USER");
  const [expiry, setExpiry] = useState(24);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        const result = await createInvitation({
          email: email.trim() ? email.trim() : undefined,
          role,
          expiresInHours: expiry
        });
        setToken(result.token);
        onCreated?.(result);
        router.refresh();
      } catch (err) {
        if (err instanceof ApiError) {
          setError(`${err.status}: ${err.message}`);
        } else if (err instanceof Error) {
          setError(err.message);
        } else {
          setError("Unknown error while creating invitation");
        }
      }
    });
  };

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <div className="space-y-1">
        <label className="block text-xs uppercase tracking-widest text-slate-300" htmlFor="invite-email">
          Email (optional)
        </label>
        <input
          id="invite-email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="friend@example.com"
          className="w-full rounded border border-primary/40 bg-background px-3 py-2 text-sm text-white focus:border-primary focus:outline-none"
        />
        <p className="text-xs text-slate-400">Leave blank to allow any email to redeem this invitation.</p>
      </div>

      <div className="space-y-1">
        <label className="block text-xs uppercase tracking-widest text-slate-300" htmlFor="invite-role">
          Role
        </label>
        <select
          id="invite-role"
          value={role}
          onChange={(event) => setRole(event.target.value)}
          className="w-full rounded border border-primary/40 bg-background px-3 py-2 text-sm text-white focus:border-primary focus:outline-none"
        >
          {ROLE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1">
        <label className="block text-xs uppercase tracking-widest text-slate-300" htmlFor="invite-expiry">
          Expiry (hours)
        </label>
        <input
          id="invite-expiry"
          type="number"
          min={1}
          max={720}
          value={expiry}
          onChange={(event) => setExpiry(Number(event.target.value))}
          className="w-full rounded border border-primary/40 bg-background px-3 py-2 text-sm text-white focus:border-primary focus:outline-none"
        />
        <p className="text-xs text-slate-400">Defaults to 24 hours. Maximum 720 hours (30 days).</p>
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded bg-primary px-4 py-2 text-xs font-bold uppercase tracking-widest text-background hover:bg-primary-dark disabled:opacity-60"
      >
        {isPending ? "Minting invite…" : "Create Invitation"}
      </button>

      {token && (
        <div className="rounded border border-lagoon/60 bg-night/60 p-3 text-xs text-lagoon">
          Invite token generated: <span className="font-semibold text-white">{token}</span>
        </div>
      )}

      {error && <p className="text-xs text-red-300">{error}</p>}
    </form>
  );
}
