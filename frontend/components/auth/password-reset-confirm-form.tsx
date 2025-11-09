"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import { PixelButton, PixelInput, PixelNotice } from "@/src/components/pixel";
import { confirmPasswordResetAction } from "@/app/(auth)/password/reset/confirm/actions";
import { useSession } from "@/src/auth/session-provider";
import { passwordSchema } from "@/lib/validation/auth";

interface PasswordResetConfirmFormProps {
  token: string;
}

export function PasswordResetConfirmForm({ token }: PasswordResetConfirmFormProps) {
  const router = useRouter();
  const { setSession } = useSession();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSuccessMessage(null);

    const validation = passwordSchema.safeParse(password);
    if (!validation.success) {
      const [firstError] = validation.error.issues;
      setError(firstError?.message ?? "Choose a stronger password and try again.");
      return;
    }

    startTransition(async () => {
      const result = await confirmPasswordResetAction({ token, password: validation.data });
      if (result.success) {
        setSession(result.payload);
        setSuccessMessage("Password updated. Redirecting to the island…");
        router.push("/play");
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  };

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <div className="space-y-1">
        <label className="block text-xs uppercase tracking-widest text-foreground/70" htmlFor="password">
          New password
        </label>
        <PixelInput
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
        />
        <p className="text-xs text-foreground/60">
          Must be at least 8 characters and include an uppercase letter and digit.
        </p>
      </div>

      <PixelButton type="submit" disabled={isPending} fullWidth>
        {isPending ? "Anchoring new secret…" : "Update password"}
      </PixelButton>

      {error && <PixelNotice tone="error">{error}</PixelNotice>}
      {successMessage && <PixelNotice tone="success">{successMessage}</PixelNotice>}
    </form>
  );
}
