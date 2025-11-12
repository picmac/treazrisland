"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

interface OnboardingConnectionRetryProps {
  readonly errorMessage: string;
  readonly resolvedApiBase: string;
  readonly retryIntervalMs?: number;
}

function clampRetryInterval(candidate?: number): number {
  if (!candidate || Number.isNaN(candidate) || candidate <= 0) {
    return 5000;
  }

  const minimum = 1500;
  const maximum = 15000;

  if (candidate < minimum) {
    return minimum;
  }

  if (candidate > maximum) {
    return maximum;
  }

  return candidate;
}

export function OnboardingConnectionRetry({
  errorMessage,
  resolvedApiBase,
  retryIntervalMs
}: OnboardingConnectionRetryProps) {
  const router = useRouter();
  const effectiveRetryMs = useMemo(() => clampRetryInterval(retryIntervalMs), [retryIntervalMs]);
  const [remainingMs, setRemainingMs] = useState(effectiveRetryMs);

  useEffect(() => {
    setRemainingMs(effectiveRetryMs);

    const intervalId = window.setInterval(() => {
      setRemainingMs((current) => {
        const next = current - 1000;
        return next > 0 ? next : 0;
      });
    }, 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [effectiveRetryMs]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      router.refresh();
    }, effectiveRetryMs);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [router, effectiveRetryMs]);

  const secondsRemaining = Math.ceil(remainingMs / 1000);

  return (
    <div className="space-y-2 text-xs text-slate-300">
      <p className="text-sm text-slate-100">Temporary communications outage detected.</p>
      <p>
        {errorMessage}
        {" "}
        We will retry automatically in {secondsRemaining} second{secondsRemaining === 1 ? "" : "s"}.
      </p>
      <p>
        Target backend: <code className="rounded bg-slate-800 px-1 py-0.5">{resolvedApiBase}</code>
      </p>
      <p>
        If the page does not recover, confirm the backend dev server is running and reachable from this host.
      </p>
    </div>
  );
}
