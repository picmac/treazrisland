"use client";

import Link from "next/link";
import type { Route } from "next";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { PixelFrame } from "@/src/components/pixel-frame";

type NavItem = {
  href: Route;
  label: string;
  description: string;
};

const NAV_ITEMS: NavItem[] = [
  {
    href: "/",
    label: "Dashboard",
    description: "Stats & save states"
  },
  {
    href: "/platforms",
    label: "Library",
    description: "Browse consoles"
  },
  {
    href: "/favorites",
    label: "Starred",
    description: "Personal queue"
  },
  {
    href: "/collections",
    label: "Collections",
    description: "Curated marathons"
  },
  {
    href: "/top-lists",
    label: "Top Lists",
    description: "Ranked spotlights"
  },
  {
    href: "/play",
    label: "Play",
    description: "Launch emulator"
  },
  {
    href: "/settings",
    label: "Settings",
    description: "Captain's quarters"
  }
];

function isActivePath(pathname: string, target: Route) {
  if (target === "/") {
    return pathname === "/";
  }
  return pathname === target || pathname.startsWith(`${target}/`);
}

export function AppNav() {
  const pathname = usePathname();

  return (
    <PixelFrame className="relative flex flex-col gap-4 bg-night/80 p-4 shadow-pixel sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-col gap-1">
        <Link
          href="/"
          className="text-sm font-semibold uppercase tracking-[0.5em] text-lagoon transition hover:text-parchment"
        >
          Treazrisland
        </Link>
        <p className="text-xs text-parchment/70">
          Self-hosted retro gaming vault · SNES-inspired interface
        </p>
      </div>
      <nav aria-label="Primary">
        <ul className="flex flex-wrap gap-2">
          {NAV_ITEMS.map((item) => {
            const active = isActivePath(pathname, item.href);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={clsx(
                    "group flex flex-col rounded-pixel border px-3 py-2 text-left text-xs uppercase tracking-widest transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lagoon focus-visible:ring-offset-2 focus-visible:ring-offset-night",
                    active
                      ? "border-lagoon bg-lagoon/20 text-lagoon shadow-inner-pixel"
                      : "border-ink/40 bg-night/70 text-parchment/70 hover:border-lagoon hover:text-parchment"
                  )}
                >
                  <span className="text-[0.7rem] font-semibold">{item.label}</span>
                  <span className="text-[0.6rem] font-normal uppercase tracking-[0.3em] text-parchment/40 group-hover:text-parchment/60">
                    {item.description}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      <div className="pointer-events-none absolute inset-0 -z-10 rounded-pixel border border-ink/60" aria-hidden />
    </PixelFrame>
  );
}
