import Link from "next/link";
import EmulatorPlayer from "./[romId]/EmulatorPlayer";
import { getRomMetadata } from "./getRomMetadata";
import { RomLookupForm } from "./RomLookupForm";
import { PlayFallbackFrame } from "./PlayFallbackFrame";
import { PixelButton, PixelFrame } from "@/src/components/pixel";

type PlayLandingPageProps = {
  searchParams?: {
    romId?: string;
  };
};

export default async function PlayLandingPage({ searchParams }: PlayLandingPageProps) {
  const romId = searchParams?.romId?.trim();

  if (!romId) {
    return (
      <main className="flex flex-1 flex-col gap-6">
        <PixelFrame className="flex flex-col gap-5 p-6" tone="raised">
          <h1 className="text-3xl font-bold text-primary">Choose a ROM to start playing</h1>
          <p className="text-base leading-relaxed text-foreground/80">
            Load a ROM from the library to launch the TREAZRISLAND emulator. Select a platform to browse available
            titles or paste a ROM ID directly into the form below to jump right into the action.
          </p>
          <RomLookupForm />
          <div className="flex flex-wrap gap-3">
            <Link href="/platforms">
              <PixelButton asChild>
                <span>Explore the library</span>
              </PixelButton>
            </Link>
          </div>
        </PixelFrame>
      </main>
    );
  }

  let rom;

  try {
    rom = await getRomMetadata(romId);
  } catch (error) {
    console.error("Failed to load ROM metadata", { romId, error });

    return (
      <PlayFallbackFrame
        heading="We couldn&apos;t load that ROM just now"
        description={
          <>
            The squall around TREAZRISLAND knocked our ROM scanner offline while loading
            <span className="mx-1 font-mono text-foreground">{romId}</span>. Give it another go in a moment or sail
            back to the library to chart a new adventure.
          </>
        }
        romIdDefault={romId}
        retry={{
          type: "link",
          href: {
            pathname: "/play",
            query: { romId },
          },
          prefetch: false,
        }}
      />
    );
  }

  if (!rom) {
    return (
      <main className="flex flex-1 flex-col gap-6">
        <PixelFrame className="flex flex-col gap-5 p-6" tone="raised">
          <h1 className="text-3xl font-bold text-primary">ROM not found</h1>
          <p className="text-base leading-relaxed text-foreground/80">
            We couldn&apos;t find a ROM with ID <span className="font-mono text-foreground">{romId}</span>. Double-check the ID or
            browse the library to discover available titles.
          </p>
          <RomLookupForm defaultValue={romId} />
          <div className="flex flex-wrap gap-3">
            <Link href="/platforms">
              <PixelButton asChild>
                <span>Explore the library</span>
              </PixelButton>
            </Link>
          </div>
        </PixelFrame>
      </main>
    );
  }

  const platformSlug = rom.platform.slug ?? rom.platform.name ?? rom.platform.id;

  return (
    <main className="flex flex-1 flex-col gap-6">
      <PixelFrame className="flex flex-col gap-4 p-4" tone="raised">
        <div>
          <h1 className="text-2xl font-bold text-primary">{rom.title}</h1>
          <p className="mt-1 text-sm uppercase tracking-widest text-foreground/70">
            Platform: {platformSlug.toUpperCase()} • ROM ID: {rom.id}
          </p>
        </div>
        <RomLookupForm defaultValue={romId} />
      </PixelFrame>
      <PixelFrame className="flex flex-1 flex-col gap-4 p-4" tone="sunken">
        <EmulatorPlayer romId={rom.id} romName={rom.title} platform={platformSlug} />
      </PixelFrame>
    </main>
  );
}
