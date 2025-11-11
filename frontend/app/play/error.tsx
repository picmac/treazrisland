"use client";

import { useEffect } from "react";

import { PlayFallbackFrame } from "./PlayFallbackFrame";

type PlayErrorBoundaryProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function PlayErrorBoundary({ error, reset }: PlayErrorBoundaryProps) {
  useEffect(() => {
    console.error("Play route runtime error", error);
  }, [error]);

  return (
    <PlayFallbackFrame
      heading="We couldn&apos;t load that ROM just now"
      description="Something in the emulator bay misfired. Try the lookup again or sail back to the library while we batten down the hatches."
      retry={{
        type: "action",
        onRetry: reset,
      }}
    />
  );
}
