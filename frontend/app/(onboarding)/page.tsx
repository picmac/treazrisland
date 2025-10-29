import { Suspense } from "react";
import OnboardingEntry from "@/src/onboarding/onboarding-entry";

export default function OnboardingPage() {
  return (
    <Suspense fallback={<div className="text-white">Preparing the docks…</div>}>
      <OnboardingEntry />
    </Suspense>
  );
}
