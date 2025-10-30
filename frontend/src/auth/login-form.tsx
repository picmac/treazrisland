'use client';

import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useCallback, useState, useTransition, type ChangeEvent, type FormEvent } from "react";
import { useSession } from "@/src/auth/session-provider";
import { ApiError } from "@/src/lib/api/client";

interface FormState {
  identifier: string;
  password: string;
  mfaCode: string;
  recoveryCode: string;
}

const initialState: FormState = {
  identifier: "",
  password: "",
  mfaCode: "",
  recoveryCode: ""
};

export function LoginForm() {
  const router = useRouter();
  const playRoute: Route = "/play";
  const { login } = useSession();
  const [form, setForm] = useState<FormState>(initialState);
  const [error, setError] = useState<string | null>(null);
  const [mfaRequired, setMfaRequired] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleChange = useCallback(
    (field: keyof FormState) => (event: ChangeEvent<HTMLInputElement>) => {
      setForm((previous) => ({ ...previous, [field]: event.target.value }));
    },
    []
  );

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    startTransition(async () => {
      try {
        await login({
          identifier: form.identifier,
          password: form.password,
          mfaCode: form.mfaCode ? form.mfaCode : undefined,
          recoveryCode: form.recoveryCode ? form.recoveryCode : undefined
        });
        setForm(initialState);
        setMfaRequired(false);
        router.push(playRoute);
        router.refresh();
      } catch (err) {
        if (err instanceof ApiError) {
          if (typeof err.body === "object" && err.body && "mfaRequired" in err.body) {
            setMfaRequired(true);
            setError("Enter your MFA code or recovery code to continue.");
          } else {
            setError(`${err.status}: ${err.message}`);
          }
        } else if (err instanceof Error) {
          setError(err.message);
        } else {
          setError("Unexpected error while logging in");
        }
      }
    });
  };

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <div className="space-y-1">
        <label className="block text-xs uppercase tracking-widest text-slate-300" htmlFor="identifier">
          Email or Nickname
        </label>
        <input
          id="identifier"
          name="identifier"
          required
          value={form.identifier}
          onChange={handleChange("identifier")}
          className="w-full rounded border border-primary/40 bg-background px-3 py-2 text-sm text-white focus:border-primary focus:outline-none"
        />
      </div>

      <div className="space-y-1">
        <label className="block text-xs uppercase tracking-widest text-slate-300" htmlFor="password">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          value={form.password}
          onChange={handleChange("password")}
          className="w-full rounded border border-primary/40 bg-background px-3 py-2 text-sm text-white focus:border-primary focus:outline-none"
        />
      </div>

      {mfaRequired && (
        <div className="space-y-3 rounded border border-primary/30 bg-background/60 p-3">
          <div className="space-y-1">
            <label className="block text-xs uppercase tracking-widest text-slate-300" htmlFor="mfaCode">
              MFA Code
            </label>
            <input
              id="mfaCode"
              name="mfaCode"
              value={form.mfaCode}
              onChange={handleChange("mfaCode")}
              className="w-full rounded border border-primary/40 bg-background px-3 py-2 text-sm text-white focus:border-primary focus:outline-none"
            />
            <p className="text-xs text-slate-400">Enter the 6-digit code from your authenticator app.</p>
          </div>

          <div className="space-y-1">
            <label className="block text-xs uppercase tracking-widest text-slate-300" htmlFor="recoveryCode">
              Recovery Code
            </label>
            <input
              id="recoveryCode"
              name="recoveryCode"
              value={form.recoveryCode}
              onChange={handleChange("recoveryCode")}
              className="w-full rounded border border-primary/40 bg-background px-3 py-2 text-sm text-white focus:border-primary focus:outline-none"
            />
            <p className="text-xs text-slate-400">Optional fallback. We will use it if the MFA code is unavailable.</p>
          </div>
        </div>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded bg-primary px-4 py-2 text-xs font-bold uppercase tracking-widest text-background hover:bg-primary-dark disabled:opacity-60"
      >
        {isPending ? "Charting course…" : "Log In"}
      </button>

      {error && <p className="text-xs text-red-300">{error}</p>}
    </form>
  );
}
