import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import EmulatorPlayer from "./EmulatorPlayer";
import type { RomDetail } from "@/src/lib/api/library";
import { API_BASE } from "@/src/lib/api/client";

type PlayPageProps = {
  params: {
    romId: string;
  };
};

async function getRomMetadata(romId: string): Promise<RomDetail | null> {
  if (!romId) {
    return null;
  }

  const cookieHeader = cookies()
    .getAll()
    .map((entry) => `${entry.name}=${entry.value}`)
    .join("; ");

  const response = await fetch(`${API_BASE}/roms/${encodeURIComponent(romId)}`, {
    headers: {
      Accept: "application/json",
      ...(cookieHeader.length > 0 ? { cookie: cookieHeader } : {})
    },
    cache: "no-store"
  });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error(`Failed to load ROM metadata: ${response.status}`);
  }

  return (await response.json()) as RomDetail;
}

export default async function PlayRomPage({ params }: PlayPageProps) {
  const rom = await getRomMetadata(params.romId);

  if (!rom) {
    notFound();
  }

  const platformSlug = rom.platform.slug ?? rom.platform.name ?? rom.platform.id;

  return (
    <main className="flex flex-1 flex-col gap-6">
      <header className="pixel-frame p-4">
        <h1 className="text-2xl font-bold text-lagoon">{rom.title}</h1>
        <p className="mt-2 text-sm uppercase tracking-widest text-parchment/70">
          Platform: {platformSlug.toUpperCase()} • ROM ID: {rom.id}
        </p>
      </header>
      <section className="pixel-frame flex flex-1 flex-col gap-4 p-4">
        <EmulatorPlayer romId={rom.id} romName={rom.title} platform={platformSlug} />
      </section>
    </main>
  );
}
