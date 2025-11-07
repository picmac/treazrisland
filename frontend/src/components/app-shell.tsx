"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import clsx from "clsx";

import { AppNav } from "@/src/components/app-nav";

const NAVLESS_PREFIXES = ["/login", "/signup", "/onboarding"];

function shouldHideNav(pathname: string | null) {
  if (!pathname) {
    return false;
  }

  return NAVLESS_PREFIXES.some((prefix) => {
    return pathname === prefix || pathname.startsWith(`${prefix}/`);
  });
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const hideNav = shouldHideNav(pathname);

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div
        className="pointer-events-none absolute inset-0 -z-20 bg-gradient-to-br from-night via-night to-ink"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,_rgba(93,187,205,0.25),_transparent_55%)]"
        aria-hidden
      />
      <div
        className={clsx(
          "relative mx-auto flex min-h-screen w-full flex-col px-4 py-8 sm:px-6 lg:px-8",
          hideNav ? undefined : "max-w-6xl gap-6"
        )}
      >
        {!hideNav && <AppNav />}
        {children}
      </div>
    </div>
  );
}
