'use client';

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent, type ChangeEvent } from "react";
import { signupWithInvitation } from "@/src/lib/api/invitations";
import { ApiError } from "@/src/lib/api/client";
import { useSession } from "@/src/auth/session-provider";

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
  const { setSession } = useSession();

  const handleChange = (field: keyof FormState) => (event: ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [field]: event.target.value }));
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    startTransition(async () => {
      try {
        const payload = await signupWithInvitation({
          token,
          email: invitationEmail ?? form.email,
          nickname: form.nickname,
          password: form.password,
          displayName: form.displayName || form.nickname
        });

        setSession(payload);
        router.push("/play");
        router.refresh();
      } catch (err) {
        if (err instanceof ApiError) {
          setError(`${err.status}: ${err.message}`);
        } else if (err instanceof Error) {
          setError(err.message);
        } else {
          setError("Unknown error while redeeming invitation");
        }
      }
    });
  };

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      {invitationEmail ? (
        <div className="space-y-1">
          <label className="block text-xs uppercase tracking-widest text-slate-300">Email</label>
          <p className="rounded border border-primary/40 bg-background px-3 py-2 text-sm text-slate-200">
            {invitationEmail}
          </p>
          <p className="text-xs text-slate-400">This invitation is locked to the email above.</p>
        </div>
      ) : (
        <div className="space-y-1">
          <label className="block text-xs uppercase tracking-widest text-slate-300" htmlFor="email">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            value={form.email}
            onChange={handleChange("email")}
            className="w-full rounded border border-primary/40 bg-background px-3 py-2 text-sm text-white focus:border-primary focus:outline-none"
          />
        </div>
      )}

      <div className="space-y-1">
        <label className="block text-xs uppercase tracking-widest text-slate-300" htmlFor="nickname">
          Nickname
        </label>
        <input
          id="nickname"
          name="nickname"
          required
          minLength={3}
          value={form.nickname}
          onChange={handleChange("nickname")}
          className="w-full rounded border border-primary/40 bg-background px-3 py-2 text-sm text-white focus:border-primary focus:outline-none"
        />
      </div>

      <div className="space-y-1">
        <label className="block text-xs uppercase tracking-widest text-slate-300" htmlFor="displayName">
          Display Name
        </label>
        <input
          id="displayName"
          name="displayName"
          placeholder="Optional"
          value={form.displayName}
          onChange={handleChange("displayName")}
          className="w-full rounded border border-primary/40 bg-background px-3 py-2 text-sm text-white focus:border-primary focus:outline-none"
        />
        <p className="text-xs text-slate-400">Shown to other players. Defaults to your nickname if left empty.</p>
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
          minLength={8}
          value={form.password}
          onChange={handleChange("password")}
          className="w-full rounded border border-primary/40 bg-background px-3 py-2 text-sm text-white focus:border-primary focus:outline-none"
        />
        <p className="text-xs text-slate-400">Password must include at least one uppercase letter and one digit.</p>
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded bg-primary px-4 py-2 text-xs font-bold uppercase tracking-widest text-background hover:bg-primary-dark disabled:opacity-60"
      >
        {isPending ? "Hoisting sails…" : `Join as ${role.toLowerCase()}`}
      </button>

      {error && <p className="text-xs text-red-300">{error}</p>}
    </form>
  );
}
