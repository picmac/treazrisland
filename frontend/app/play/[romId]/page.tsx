import { notFound } from "next/navigation";
import EmulatorPlayer from "./EmulatorPlayer";
import NetplayControls from "./NetplayControls";
import { getRomMetadata } from "../getRomMetadata";

type PlayPageProps = {
  params: {
    romId: string;
  };
};

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
        <NetplayControls romId={rom.id} />
        <EmulatorPlayer romId={rom.id} romName={rom.title} platform={platformSlug} />
      </section>
    </main>
  );
}
