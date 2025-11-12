import { headers } from "next/headers";

import { FirstAdminForm } from "@/src/onboarding/sections/first-admin-form";
import { PixelFrame } from "@/src/components/pixel-frame";
import { SetupWizard } from "@/src/onboarding/setup-wizard";
import { ApiError, resolveApiBase } from "@/src/lib/api/client";
import { OnboardingConnectionRetry } from "@/src/onboarding/components/onboarding-connection-retry";
import {
  fetchOnboardingStatus,
  type OnboardingStatus,
  type OnboardingStepKey,
  type OnboardingStepState
} from "@lib/api/onboarding";

const ONBOARDING_STEP_KEYS: readonly OnboardingStepKey[] = [
  "first-admin",
  "system-profile",
  "integrations",
  "personalization"
];

function buildFallbackStatus(): OnboardingStatus {
  const timestamp = new Date().toISOString();
  const buildStep = (): OnboardingStepState => ({
    status: "PENDING",
    updatedAt: timestamp
  });

  return {
    needsSetup: true,
    setupComplete: false,
    steps: {
      "first-admin": buildStep(),
      "system-profile": buildStep(),
      integrations: buildStep(),
      personalization: buildStep()
    },
    pendingSteps: [...ONBOARDING_STEP_KEYS]
  } satisfies OnboardingStatus;
}

export default async function OnboardingEntry() {
  const requestHeaders = headers();
  const resolvedApiBase = resolveApiBase(requestHeaders);
  let status: OnboardingStatus | null = null;
  let onboardingWarning: string | null = null;
  try {
    status = await fetchOnboardingStatus({ requestHeaders });
  } catch (error) {
    if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
      status = buildFallbackStatus();
      const reason = error.message?.trim();
      onboardingWarning = [
        `We couldn't confirm the onboarding status (${error.status}).`,
        reason ? `API response: ${reason}.` : null,
        "You can still forge the inaugural admin, but double-check your backend auth chart." 
      ]
        .filter(Boolean)
        .join(" ");
    } else {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "An unexpected error occurred while contacting the backend.";

      return (
        <main className="flex min-h-screen flex-col items-center justify-center bg-background p-6 text-white">
          <PixelFrame className="space-y-4">
            <h1 className="text-lg uppercase tracking-widest text-primary">
              Onboarding temporarily unavailable
            </h1>
            <div className="space-y-3 text-sm text-slate-200">
              <OnboardingConnectionRetry
                errorMessage={errorMessage}
                resolvedApiBase={resolvedApiBase}
              />
              <div className="space-y-2 text-xs text-slate-300">
                <p className="uppercase text-slate-100">Troubleshooting checklist</p>
                <ul className="list-disc space-y-1 pl-5">
                  <li>Ensure the backend server is running: <code className="rounded bg-slate-800 px-1 py-0.5">npm run dev --workspace backend</code>.</li>
                  <li>Or start the stack via Docker Compose: <code className="rounded bg-slate-800 px-1 py-0.5">docker compose up backend frontend</code>.</li>
                  <li>Confirm <code className="rounded bg-slate-800 px-1 py-0.5">NEXT_PUBLIC_API_BASE_URL</code> (or <code className="rounded bg-slate-800 px-1 py-0.5">AUTH_API_BASE_URL</code>) points to your backend.</li>
                </ul>
              </div>
            </div>
          </PixelFrame>
        </main>
      );
    }
  }

  if (!status?.needsSetup) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-background p-6 text-white">
        <PixelFrame className="space-y-4">
          <h1 className="text-lg uppercase tracking-widest text-primary">
            Island already charted
          </h1>
          <p className="text-sm text-slate-200">
            An administrator has completed setup. Please sign in using the main portal once authentication routes are live.
          </p>
        </PixelFrame>
      </main>
    );
  }

  const awaitingAdmin = status.pendingSteps.includes("first-admin");

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background p-6 text-white">
      {awaitingAdmin ? (
        <PixelFrame className="space-y-6">
          <header className="space-y-2 text-center">
            <h1 className="text-lg uppercase tracking-widest text-primary">
              Welcome, Keeper of the Vault
            </h1>
            <p className="text-sm text-slate-200">
              Provision the inaugural admin to unlock TREAZRISLAND&apos;s retro vault. Password policy: 8+ chars, uppercase + digit.
            </p>
          </header>
          {onboardingWarning ? (
            <p className="rounded border border-amber-500/40 bg-amber-900/40 px-3 py-2 text-xs text-amber-200">
              {onboardingWarning}
            </p>
          ) : null}
          <FirstAdminForm />
        </PixelFrame>
      ) : (
        <SetupWizard initialStatus={status} />
      )}
    </main>
  );
}
