import { apiFetch } from "@lib/api/client";
import { FirstAdminForm } from "@/src/onboarding/sections/first-admin-form";
import { PixelFrame } from "@/src/components/pixel-frame";

interface OnboardingStatus {
  needsSetup: boolean;
}

export default async function OnboardingEntry() {
  let status: OnboardingStatus | null = null;
  try {
    status = await apiFetch<OnboardingStatus>("/onboarding/status");
  } catch (error) {
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

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background p-6 text-white">
      <PixelFrame className="space-y-6">
        <header className="space-y-2 text-center">
          <h1 className="text-lg uppercase tracking-widest text-primary">
            Welcome, Keeper of the Vault
          </h1>
          <p className="text-sm text-slate-200">
            Provision the inaugural admin to unlock TREAZRISLAND&apos;s retro vault. Password policy: 8+ chars, uppercase + digit.
          </p>
        </header>
        <FirstAdminForm />
      </PixelFrame>
    </main>
  );
}
