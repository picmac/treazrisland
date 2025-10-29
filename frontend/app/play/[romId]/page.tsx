import { notFound } from "next/navigation";
import EmulatorPlayer from "./EmulatorPlayer";

type PlayPageProps = {
  params: {
    romId: string;
  };
};

const SUPPORTED_PLACEHOLDER_PLATFORM = "snes" as const;

async function getRomMetadata(romId: string) {
  if (!romId) {
    return null;
  }

  return {
    id: romId,
    title: decodeURIComponent(romId).replace(/-/g, " ") || "Mystery ROM",
    platform: SUPPORTED_PLACEHOLDER_PLATFORM,
    coverArtUrl: null
  } as const;
}

export default async function PlayRomPage({ params }: PlayPageProps) {
  const rom = await getRomMetadata(params.romId);

  if (!rom) {
    notFound();
  }

  return (
    <main className="flex flex-1 flex-col gap-6">
      <header className="pixel-frame p-4">
        <h1 className="text-2xl font-bold text-lagoon">{rom.title}</h1>
        <p className="mt-2 text-sm uppercase tracking-widest text-parchment/70">
          Platform: {rom.platform.toUpperCase()} • ROM ID: {rom.id}
        </p>
      </header>
      <section className="pixel-frame flex flex-1 flex-col gap-4 p-4">
        <EmulatorPlayer romId={rom.id} romName={rom.title} platform={rom.platform} />
      </section>
    </main>
  );
}
