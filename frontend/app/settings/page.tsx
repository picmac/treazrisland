import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import SettingsPageClient from "./SettingsPageClient";
import type { UserProfileResponse } from "@/src/lib/api/user";
import { API_BASE } from "@/src/lib/api/client";

async function fetchProfile(): Promise<UserProfileResponse> {
  const cookieStore = await cookies();
  const cookieHeader = cookieStore
    .getAll()
    .map((entry) => `${entry.name}=${entry.value}`)
    .join("; ");

  const response = await fetch(`${API_BASE}/users/me`, {
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
  const profile = await fetchProfile();

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
