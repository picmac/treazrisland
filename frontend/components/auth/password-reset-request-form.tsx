"use client";

import { useState, useTransition, type FormEvent } from "react";
import { PixelButton, PixelInput, PixelNotice } from "@/src/components/pixel";
import { submitPasswordResetRequest } from "@/app/(auth)/password/reset/request/actions";
import { passwordResetRequestSchema } from "@/lib/validation/auth";

export function PasswordResetRequestForm() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedEmail = email.trim();
    const validation = passwordResetRequestSchema.safeParse({ email: trimmedEmail });

    if (!validation.success) {
      const [firstError] = validation.error.issues;
      setStatus({
        type: "error",
        message: firstError?.message ?? "Enter a valid email to continue.",
      });
      return;
    }

    setStatus(null);
    startTransition(async () => {
      const result = await submitPasswordResetRequest({ email: validation.data.email });
      if (result.success) {
        setStatus({ type: "success", message: result.message });
      } else {
        setStatus({ type: "error", message: result.error });
      }
    });
  };

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <div className="space-y-1">
        <label className="block text-xs uppercase tracking-widest text-foreground/70" htmlFor="email">
          Account email
        </label>
        <PixelInput
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
        />
        <p className="text-xs text-foreground/60">
          We&apos;ll send reset instructions if the email belongs to an existing TREAZRISLAND account.
        </p>
      </div>

      <PixelButton type="submit" disabled={isPending} fullWidth>
        {isPending ? "Sending signal…" : "Send reset link"}
      </PixelButton>

      {status && <PixelNotice tone={status.type === "success" ? "success" : "error"}>{status.message}</PixelNotice>}
    </form>
  );
}
