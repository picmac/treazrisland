import Link from "next/link";
import EmulatorPlayer from "./[romId]/EmulatorPlayer";
import { getRomMetadata } from "./getRomMetadata";

type PlayLandingPageProps = {
  searchParams?: {
    romId?: string;
  };
};

function RomLookupForm({ defaultValue }: { defaultValue?: string }) {
  return (
    <form className="flex flex-col gap-2" method="get">
      <label htmlFor="rom-id" className="text-sm font-semibold uppercase tracking-widest text-parchment/70">
        Load by ROM ID
      </label>
      <div className="flex flex-wrap gap-2 sm:flex-nowrap">
        <input
          id="rom-id"
          name="romId"
          defaultValue={defaultValue}
          className="flex-1 rounded-pixel border border-ink/40 bg-night px-3 py-2 text-parchment shadow-inner-pixel focus:border-lagoon focus:outline-none"
          placeholder="ex: rom-1234"
        />
        <button
          type="submit"
          className="rounded-pixel bg-lagoon px-4 py-2 font-semibold uppercase tracking-widest text-night shadow-pixel transition hover:bg-kelp"
        >
          Load ROM
        </button>
      </div>
    </form>
  );
}

export default async function PlayLandingPage({ searchParams }: PlayLandingPageProps) {
  const romId = searchParams?.romId?.trim();

  if (!romId) {
    return (
      <main className="flex flex-1 flex-col gap-6">
        <section className="pixel-frame flex flex-col gap-5 p-6">
          <h1 className="text-3xl font-bold text-lagoon">Choose a ROM to start playing</h1>
          <p className="text-base leading-relaxed text-parchment/80">
            Load a ROM from the library to launch the TREAZRISLAND emulator. Select a platform to browse available
            titles or paste a ROM ID directly into the form below to jump right into the action.
          </p>
          <RomLookupForm />
          <div className="flex flex-wrap gap-3">
            <Link
              href="/platforms"
              className="inline-flex items-center justify-center rounded-pixel bg-kelp px-4 py-2 font-semibold text-night shadow-pixel transition hover:bg-lagoon"
            >
              Explore the library
            </Link>
          </div>
        </section>
      </main>
    );
  }

  const rom = await getRomMetadata(romId);

  if (!rom) {
    return (
      <main className="flex flex-1 flex-col gap-6">
        <section className="pixel-frame flex flex-col gap-5 p-6">
          <h1 className="text-3xl font-bold text-lagoon">ROM not found</h1>
          <p className="text-base leading-relaxed text-parchment/80">
            We couldn&apos;t find a ROM with ID <span className="font-mono text-parchment">{romId}</span>. Double-check the ID or
            browse the library to discover available titles.
          </p>
          <RomLookupForm defaultValue={romId} />
          <div className="flex flex-wrap gap-3">
            <Link
              href="/platforms"
              className="inline-flex items-center justify-center rounded-pixel bg-kelp px-4 py-2 font-semibold text-night shadow-pixel transition hover:bg-lagoon"
            >
              Explore the library
            </Link>
          </div>
        </section>
      </main>
    );
  }

  const platformSlug = rom.platform.slug ?? rom.platform.name ?? rom.platform.id;

  return (
    <main className="flex flex-1 flex-col gap-6">
      <header className="pixel-frame flex flex-col gap-4 p-4">
        <div>
          <h1 className="text-2xl font-bold text-lagoon">{rom.title}</h1>
          <p className="mt-1 text-sm uppercase tracking-widest text-parchment/70">
            Platform: {platformSlug.toUpperCase()} • ROM ID: {rom.id}
          </p>
        </div>
        <RomLookupForm defaultValue={romId} />
      </header>
      <section className="pixel-frame flex flex-1 flex-col gap-4 p-4">
        <EmulatorPlayer romId={rom.id} romName={rom.title} platform={platformSlug} />
      </section>
    </main>
  );
}
