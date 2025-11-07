import Link from "next/link";
import { DashboardPanels } from "@/src/components/dashboard-panels";
import { PixelFrame } from "@/src/components/pixel-frame";

type QuickLink = {
  href: string;
  eyebrow: string;
  title: string;
  description: string;
  icon: string;
};

const QUICK_LINKS: QuickLink[] = [
  {
    href: "/platforms",
    eyebrow: "Library hub",
    title: "Explore the library",
    description: "Browse curated consoles, hero art, and fresh arrivals.",
    icon: "🎮"
  },
  {
    href: "/play",
    eyebrow: "Instant play",
    title: "Launch the emulator",
    description: "Paste a ROM ID to boot EmulatorJS with your saves ready.",
    icon: "🚀"
  },
  {
    href: "/favorites",
    eyebrow: "Personal queue",
    title: "Starred adventures",
    description: "Filter favorites by platform or genre for rapid replays.",
    icon: "⭐"
  },
  {
    href: "/collections",
    eyebrow: "Curated journeys",
    title: "Story-driven collections",
    description: "Dive into themed marathons assembled by the crew.",
    icon: "🗺️"
  },
  {
    href: "/top-lists",
    eyebrow: "Ranked spotlights",
    title: "Top lists",
    description: "See crew rankings, blurbs, and platform highlights.",
    icon: "🏆"
  }
];

export default function HomePage() {
  return (
    <main className="flex flex-1 flex-col gap-6 pb-10">
      <PixelFrame className="relative overflow-hidden bg-night/80 p-6">
        <div className="pointer-events-none absolute -right-12 -top-16 h-48 w-48 rounded-full bg-lagoon/10 blur-3xl" aria-hidden />
        <header className="relative space-y-3 text-parchment">
          <p className="text-xs uppercase tracking-[0.35em] text-lagoon/80">Welcome aboard</p>
          <h1 className="text-3xl font-bold text-parchment">Sail into the TREAZRISLAND vault</h1>
          <p className="max-w-2xl text-base leading-relaxed text-parchment/80">
            Curate your retro collection, sync cloud saves, and keep your adventures private. The dashboard surfaces
            library health, recent play states, and quick links into the most-traveled routes on the island.
          </p>
        </header>
      </PixelFrame>

      <PixelFrame className="space-y-5 bg-night/80 p-6">
        <header className="space-y-2 text-parchment">
          <h2 className="text-2xl font-semibold text-lagoon">Quick start</h2>
          <p className="max-w-2xl text-sm leading-relaxed text-parchment/80">
            Use these shortcuts to jump directly into discovery, playback, or your personalized queues. Each frame mirrors the
            onboarding copy deck so crew members know exactly where to chart their next session.
          </p>
        </header>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {QUICK_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="group flex flex-col gap-2 rounded-pixel border border-ink/40 bg-night/70 p-4 transition hover:border-lagoon hover:bg-night/80"
            >
              <span className="text-sm uppercase tracking-[0.3em] text-lagoon/70">
                {link.eyebrow}
              </span>
              <div className="flex items-baseline gap-2">
                <span className="text-lg">{link.icon}</span>
                <h3 className="text-lg font-semibold text-parchment transition group-hover:text-lagoon">
                  {link.title}
                </h3>
              </div>
              <p className="text-sm leading-relaxed text-parchment/70">{link.description}</p>
            </Link>
          ))}
        </div>
      </PixelFrame>

      <DashboardPanels />
    </main>
  );
}
