import Link from "next/link";
import { DashboardPanels } from "@/src/components/dashboard-panels";

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
            href="/platforms"
            className="inline-block rounded-pixel bg-kelp px-4 py-2 font-semibold text-night shadow-pixel transition hover:bg-lagoon"
          >
            Explore the library
          </Link>
          <Link
            href="/top-lists"
            className="inline-block rounded-pixel border border-kelp/70 bg-night/70 px-4 py-2 font-semibold text-parchment shadow-pixel transition hover:border-lagoon hover:text-lagoon"
          >
            Browse top lists
          </Link>
          <Link
            href="/collections"
            className="inline-block rounded-pixel border border-kelp/70 bg-night/70 px-4 py-2 font-semibold text-parchment shadow-pixel transition hover:border-lagoon hover:text-lagoon"
          >
            View collections
          </Link>
          <Link
            href="/favorites"
            className="inline-block rounded-pixel border border-kelp/70 bg-night/70 px-4 py-2 font-semibold text-parchment shadow-pixel transition hover:border-lagoon hover:text-lagoon"
          >
            Starred adventures
          </Link>
        </div>
      </section>

      <DashboardPanels />
    </main>
  );
}
