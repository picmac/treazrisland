'use client';

import type { Route } from "next";
import { useRouter } from "next/navigation";
import type { ChangeEvent, FormEvent } from "react";
import { useState, useTransition } from "react";
import { apiFetch, ApiError } from "@lib/api/client";
import { useSession } from "@/src/auth/session-provider";

interface FormState {
  email: string;
  nickname: string;
  password: string;
}

const initialState: FormState = {
  email: "",
  nickname: "",
  password: ""
};

export function FirstAdminForm() {
  const [form, setForm] = useState<FormState>(initialState);
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

    startTransition(async () => {
      try {
        const payload = await apiFetch<{
          user: { id: string; email: string; nickname: string; role: string };
          accessToken: string;
          refreshExpiresAt: string;
        }>("/onboarding/admin", {
          method: "POST",
          body: JSON.stringify(form)
        });

        setSession({
          user: payload.user,
          accessToken: payload.accessToken,
          refreshExpiresAt: payload.refreshExpiresAt
        });
        router.push(playRoute);
        router.refresh();
      } catch (err) {
        if (err instanceof ApiError) {
          setError(`${err.status}: ${err.message}`);
        } else if (err instanceof Error) {
          setError(err.message);
        } else {
          setError("Unknown error while creating admin");
        }
      }
    });
  };

  return (
    <form className="space-y-4 text-left" onSubmit={handleSubmit}>
      <div className="space-y-1">
        <label className="block text-xs uppercase tracking-widest text-slate-300" htmlFor="email">
          Admin Email
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
        <p className="text-xs text-slate-400">Must include at least one uppercase letter and one digit.</p>
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded bg-primary px-4 py-2 text-xs font-bold uppercase tracking-widest text-background hover:bg-primary-dark disabled:opacity-60"
      >
        {isPending ? "Charting course…" : "Create Admin"}
      </button>

      {error && <p className="text-xs text-red-300">{error}</p>}
    </form>
  );
}
