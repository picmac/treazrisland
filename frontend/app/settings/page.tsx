import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import SettingsPageClient from "./SettingsPageClient";
import type { UserProfileResponse } from "@/src/lib/api/user";
import { resolveApiBase } from "@/src/lib/api/client";
import { PixelFrame } from "@/src/components/pixel-frame";

async function fetchProfile(): Promise<UserProfileResponse> {
  const cookieStore = await cookies();
  const cookieHeader = cookieStore
    .getAll()
    .map((entry) => `${entry.name}=${entry.value}`)
    .join("; ");

  const headerStore = headers();
  const apiBase = resolveApiBase(headerStore);

  const response = await fetch(`${apiBase}/users/me`, {
    method: "GET",
    headers: {
      Accept: "application/json",
      ...(cookieHeader.length > 0 ? { cookie: cookieHeader } : {}),
    },
    cache: "no-store",
  });

  if (response.status === 401) {
    redirect("/login");
  }

  if (!response.ok) {
    throw new Error(`Failed to load profile: ${response.status}`);
  }

  return (await response.json()) as UserProfileResponse;
}

export default async function SettingsPage() {
  let profile: UserProfileResponse | null = null;
  let errorMessage: string | null = null;

  try {
    profile = await fetchProfile();
  } catch (error) {
    if (error instanceof Error) {
      errorMessage = error.message;
    } else {
      errorMessage = "Unable to load your profile.";
    }
  }

  if (!profile) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center">
        <PixelFrame className="max-w-xl space-y-4 p-6 text-parchment" tone="sunken">
          <header className="space-y-2 text-center">
            <h1 className="text-2xl font-semibold text-lagoon">Captain&apos;s quarters are adrift</h1>
            <p className="text-sm text-parchment/80">
              We couldn&apos;t retrieve your profile details from the API, so the settings dock is temporarily unavailable.
            </p>
          </header>
          <p className="rounded-pixel border border-ink/40 bg-night/70 px-3 py-2 text-xs uppercase tracking-widest text-parchment/70">
            {errorMessage ?? "Unexpected error."}
          </p>
          <div className="flex justify-center">
            <Link
              href="/settings"
              className="rounded-pixel bg-kelp px-4 py-2 text-xs font-semibold uppercase tracking-widest text-night shadow-pixel transition hover:bg-lagoon"
            >
              Try again
            </Link>
          </div>
        </PixelFrame>
      </main>
    );
  }

  return (
    <main className="flex flex-1 flex-col gap-6">
      <header className="pixel-frame p-6 text-parchment">
        <h1 className="text-3xl font-bold text-lagoon">Captain&apos;s quarters</h1>
        <p className="mt-2 max-w-2xl text-sm text-parchment/80">
          Update your nickname, refresh your display name, or swap in a new avatar so crew mates recognise you at a glance.
        </p>
      </header>
      <SettingsPageClient initialProfile={profile.user} />
    </main>
  );
}
