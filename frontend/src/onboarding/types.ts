export type OnboardingStepKey =
  | "first-admin"
  | "system-profile"
  | "integrations"
  | "personalization";

export type OnboardingStepStatus = "PENDING" | "COMPLETED" | "SKIPPED";

export interface OnboardingStepState {
  status: OnboardingStepStatus;
  updatedAt: string;
  payload?: unknown;
}

export interface OnboardingStatus {
  needsSetup: boolean;
  setupComplete: boolean;
  steps: Record<OnboardingStepKey, OnboardingStepState>;
  pendingSteps: OnboardingStepKey[];
}
