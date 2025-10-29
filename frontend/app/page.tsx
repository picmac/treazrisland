import Link from "next/link";

export default function HomePage() {
  return (
    <main className="flex flex-1 flex-col gap-6">
      <header className="rounded-pixel bg-ink/80 p-6 text-parchment shadow-pixel">
        <h1 className="text-3xl font-bold">Welcome to TREAZRISLAND</h1>
        <p className="mt-2 text-lg">
          Sail into a library of beloved ROMs and relive the SNES era with a privacy-first, self-hosted arcade.
        </p>
      </header>
      <section className="rounded-pixel border border-ink/50 bg-night/70 p-6 shadow-pixel">
        <h2 className="text-2xl font-semibold text-lagoon">Quick start</h2>
        <p className="mt-3 max-w-2xl text-base leading-relaxed text-parchment/80">
          Use the library explorer to select a ROM, or paste a ROM ID in the URL to jump right into the player.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link
            href="/play/demo"
            className="inline-block rounded-pixel bg-kelp px-4 py-2 font-semibold text-night shadow-pixel transition hover:bg-lagoon"
          >
            Try the demo player
          </Link>
        </div>
      </section>
    </main>
  );
}
