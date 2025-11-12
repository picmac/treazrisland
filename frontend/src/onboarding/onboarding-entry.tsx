import { headers } from "next/headers";

import { FirstAdminForm } from "@/src/onboarding/sections/first-admin-form";
import { PixelFrame } from "@/src/components/pixel-frame";
import { SetupWizard } from "@/src/onboarding/setup-wizard";
import { ApiError } from "@/src/lib/api/client";
import { fetchOnboardingStatus, type OnboardingStatus } from "@lib/api/onboarding";

const ONBOARDING_STEP_KEYS = [
  "first-admin",
  "system-profile",
  "integrations",
  "personalization"
] as const satisfies ReadonlyArray<keyof OnboardingStatus["steps"]>;

function buildFallbackStatus(): OnboardingStatus {
  const timestamp = new Date().toISOString();
  const buildStep = () => ({ status: "PENDING", updatedAt: timestamp });

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
  let status: OnboardingStatus | null = null;
  let onboardingWarning: string | null = null;
  try {
    status = await fetchOnboardingStatus({ requestHeaders: headers() });
  } catch (error) {
    if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
      status = buildFallbackStatus();
      const reason = error.message?.trim();
      onboardingWarning = `Continuing onboarding despite ${error.status} response${
        reason ? `: ${reason}` : ""
      }.`;
    } else {
      return (
        <main className="flex min-h-screen flex-col items-center justify-center bg-background p-6 text-white">
          <PixelFrame className="space-y-4">
            <h1 className="text-lg uppercase tracking-widest text-primary">
              Onboarding temporarily unavailable
            </h1>
            <p className="text-sm text-slate-200">
              {error instanceof Error
                ? error.message
                : "An unexpected error occurred while contacting the backend."}
            </p>
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
