"use client";

import type { ReactNode } from "react";
import Link from "next/link";

import { PixelButton, PixelFrame } from "@/src/components/pixel";

import { RomLookupForm } from "./RomLookupForm";

type RetryLinkConfig = {
  type: "link";
  href: string;
  prefetch?: boolean;
};

type RetryActionConfig = {
  type: "action";
  onRetry: () => void;
};

export type PlayFallbackFrameProps = {
  heading: string;
  description: ReactNode;
  romIdDefault?: string;
  retry: (RetryLinkConfig | RetryActionConfig) & {
    label?: string;
  };
};

export function PlayFallbackFrame({ heading, description, romIdDefault, retry }: PlayFallbackFrameProps) {
  const retryLabel = retry.label ?? "Try again";

  return (
    <main className="flex flex-1 flex-col gap-6">
      <PixelFrame className="flex flex-col gap-5 p-6" tone="raised">
        <h1 className="text-3xl font-bold text-primary">{heading}</h1>
        <p className="text-base leading-relaxed text-foreground/80">{description}</p>
        <RomLookupForm defaultValue={romIdDefault} />
        <div className="flex flex-wrap gap-3">
          {retry.type === "link" ? (
            <Link href={retry.href} prefetch={retry.prefetch ?? false}>
              <PixelButton asChild>
                <span>{retryLabel}</span>
              </PixelButton>
            </Link>
          ) : (
            <PixelButton onClick={retry.onRetry}>{retryLabel}</PixelButton>
          )}
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

