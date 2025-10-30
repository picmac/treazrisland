import Link from "next/link";

export default function PlayLandingPage() {
  return (
    <main className="flex flex-1 flex-col gap-6">
      <section className="pixel-frame flex flex-col gap-4 p-6">
        <h1 className="text-3xl font-bold text-lagoon">Choose a ROM to start playing</h1>
        <p className="text-base leading-relaxed text-parchment/80">
          Load a ROM from the library to launch the TREAZRISLAND emulator. Select a platform to browse
          available titles or paste a ROM ID directly into the URL to jump right into the action.
        </p>
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
