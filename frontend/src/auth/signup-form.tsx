'use client';

import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent, type ChangeEvent } from "react";
import { redeemInvitationAction } from "@/app/(auth)/signup/actions";
import { PixelButton, PixelInput, PixelNotice } from "@/src/components/pixel";
import { useSession } from "@/src/auth/session-provider";
import { signupSchema } from "@/lib/validation/auth";

interface SignupFormProps {
  token: string;
  invitationEmail: string | null;
  role: string;
}

interface FormState {
  email: string;
  nickname: string;
  displayName: string;
  password: string;
}

const factoryFormState = (prefilledEmail: string | null): FormState => ({
  email: prefilledEmail ?? "",
  nickname: "",
  displayName: "",
  password: ""
});

export default function SignupForm({ token, invitationEmail, role }: SignupFormProps) {
  const [form, setForm] = useState<FormState>(factoryFormState(invitationEmail));
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const playRoute: Route = "/play";
  const { setSession } = useSession();

  const handleChange = (field: keyof FormState) => (event: ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [field]: event.target.value }));
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    const nickname = form.nickname.trim();
    const displayName = form.displayName.trim();
    const email = invitationEmail ?? form.email.trim();

    const submission = {
      token,
      email: email || undefined,
      nickname,
      password: form.password,
      displayName: displayName.length > 0 ? displayName : nickname,
    };

    const validation = signupSchema.safeParse(submission);
    if (!validation.success) {
      const [firstError] = validation.error.issues;
      setError(firstError?.message ?? "Please review your details and try again.");
      return;
    }

    startTransition(async () => {
      try {
        const result = await redeemInvitationAction(validation.data);

        if (result.success) {
          setSession(result.payload);
          router.push(playRoute);
          router.refresh();
          return;
        }

        setError(result.error || "Unknown error while redeeming invitation");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error while redeeming invitation");
      }
    });
  };

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      {invitationEmail ? (
        <div className="space-y-1">
          <label className="block text-xs uppercase tracking-widest text-foreground/70">Email</label>
          <p className="rounded-pixel border border-[var(--surface-outline-subtle)] bg-surface-sunken px-3 py-2 text-sm text-foreground/85">
            {invitationEmail}
          </p>
          <p className="text-xs text-foreground/60">This invitation is locked to the email above.</p>
        </div>
      ) : (
        <div className="space-y-1">
          <label className="block text-xs uppercase tracking-widest text-foreground/70" htmlFor="email">
            Email
          </label>
          <PixelInput
            id="email"
            name="email"
            type="email"
            required
            value={form.email}
            onChange={handleChange("email")}
          />
        </div>
      )}

      <div className="space-y-1">
        <label className="block text-xs uppercase tracking-widest text-foreground/70" htmlFor="nickname">
          Nickname
        </label>
        <PixelInput
          id="nickname"
          name="nickname"
          required
          minLength={3}
          value={form.nickname}
          onChange={handleChange("nickname")}
        />
      </div>

      <div className="space-y-1">
        <label className="block text-xs uppercase tracking-widest text-foreground/70" htmlFor="displayName">
          Display Name
        </label>
        <PixelInput
          id="displayName"
          name="displayName"
          placeholder="Optional"
          value={form.displayName}
          onChange={handleChange("displayName")}
        />
        <p className="text-xs text-foreground/60">Shown to other players. Defaults to your nickname if left empty.</p>
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
          minLength={8}
          value={form.password}
          onChange={handleChange("password")}
        />
        <p className="text-xs text-foreground/60">Password must include at least one uppercase letter and one digit.</p>
      </div>

      <PixelButton type="submit" disabled={isPending} fullWidth>
        {isPending ? "Hoisting sails…" : `Join as ${role.toLowerCase()}`}
      </PixelButton>

      {error && <PixelNotice tone="error">{error}</PixelNotice>}
    </form>
  );
}
