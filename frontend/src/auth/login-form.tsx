'use client';

import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useCallback, useState, useTransition, type ChangeEvent, type FormEvent } from "react";
import { performLogin } from "@/app/(auth)/login/actions";
import { loginSchema } from "@/lib/validation/auth";
import { PixelButton, PixelInput, PixelNotice } from "@/src/components/pixel";
import { useSession } from "@/src/auth/session-provider";

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
  const { setSession } = useSession();
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

    const trimmed = {
      identifier: form.identifier.trim(),
      password: form.password,
      mfaCode: form.mfaCode.trim() || undefined,
      recoveryCode: form.recoveryCode.trim() || undefined
    };

    const validation = loginSchema.safeParse(trimmed);
    if (!validation.success) {
      const [firstError] = validation.error.issues;
      setError(firstError?.message ?? "Check your credentials and try again.");
      setMfaRequired(Boolean(trimmed.mfaCode || trimmed.recoveryCode));
      return;
    }

    startTransition(async () => {
      try {
        const result = await performLogin(validation.data);

        if (result.success) {
          setSession(result.payload);
          setForm(initialState);
          setMfaRequired(false);
          router.push(playRoute);
          router.refresh();
          return;
        }

        setMfaRequired(result.mfaRequired ?? false);
        setError(
          result.mfaRequired
            ? result.error || "Enter your MFA code or recovery code to continue."
            : result.error || "Unexpected error while logging in"
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unexpected error while logging in");
      }
    });
  };

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <div className="space-y-1">
        <label className="block text-xs uppercase tracking-widest text-foreground/70" htmlFor="identifier">
          Email or Nickname
        </label>
        <PixelInput
          id="identifier"
          name="identifier"
          required
          value={form.identifier}
          onChange={handleChange("identifier")}
        />
      </div>

      <div className="space-y-1">
        <label className="block text-xs uppercase tracking-widest text-foreground/70" htmlFor="password">
          Password
        </label>
        <PixelInput
          id="password"
          name="password"
          type="password"
          required
          value={form.password}
          onChange={handleChange("password")}
        />
      </div>

      {mfaRequired && (
        <div className="space-y-3 rounded-pixel border border-[color:var(--surface-outline-subtle)] bg-surface-translucent p-3">
          <div className="space-y-1">
            <label className="block text-xs uppercase tracking-widest text-foreground/70" htmlFor="mfaCode">
              MFA Code
            </label>
            <PixelInput
              id="mfaCode"
              name="mfaCode"
              value={form.mfaCode}
              onChange={handleChange("mfaCode")}
            />
            <p className="text-xs text-foreground/60">Enter the 6-digit code from your authenticator app.</p>
          </div>

          <div className="space-y-1">
            <label className="block text-xs uppercase tracking-widest text-foreground/70" htmlFor="recoveryCode">
              Recovery Code
            </label>
            <PixelInput
              id="recoveryCode"
              name="recoveryCode"
              value={form.recoveryCode}
              onChange={handleChange("recoveryCode")}
            />
            <p className="text-xs text-foreground/60">Optional fallback. We will use it if the MFA code is unavailable.</p>
          </div>
        </div>
      )}

      <PixelButton type="submit" disabled={isPending} fullWidth>
        {isPending ? "Charting course…" : "Log In"}
      </PixelButton>

      {error && <PixelNotice tone="error">{error}</PixelNotice>}
    </form>
  );
}
