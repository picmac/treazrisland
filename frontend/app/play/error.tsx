"use client";

import { useEffect } from "react";
import Link from "next/link";
import { PixelButton, PixelFrame } from "@/src/components/pixel";

import { RomLookupForm } from "./RomLookupForm";

type PlayErrorBoundaryProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function PlayErrorBoundary({ error, reset }: PlayErrorBoundaryProps) {
  useEffect(() => {
    console.error("Play route runtime error", error);
  }, [error]);

  return (
    <main className="flex flex-1 flex-col gap-6">
      <PixelFrame className="flex flex-col gap-5 p-6" tone="raised">
        <h1 className="text-3xl font-bold text-primary">We couldn&apos;t load that ROM just now</h1>
        <p className="text-base leading-relaxed text-foreground/80">
          Something in the emulator bay misfired. Try the lookup again or sail back to the library while we batten down the
          hatches.
        </p>
        <RomLookupForm />
        <div className="flex flex-wrap gap-3">
          <PixelButton onClick={reset}>Try again</PixelButton>
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
