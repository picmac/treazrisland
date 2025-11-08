import { apiFetch, ApiError } from "@lib/api/client";
import type { SessionPayload } from "@lib/api/auth";

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

export type StorageDriver = "filesystem" | "s3";

export interface SettingsUpdatePayload {
  systemProfile?: {
    instanceName: string;
    timezone: string;
    baseUrl?: string;
  };
  storage?: {
    driver: StorageDriver;
    localRoot?: string;
    bucketAssets: string;
    bucketRoms: string;
    bucketBios?: string;
    signedUrlTTLSeconds?: number;
    s3?: {
      endpoint: string;
      region: string;
      accessKey: string;
      secretKey: string;
      forcePathStyle?: boolean;
    };
  };
  email?: {
    provider: "none" | "postmark";
    postmark?: {
      serverToken: string;
      fromEmail: string;
      messageStream?: string;
    };
  };
  metrics?: {
    enabled?: boolean;
    token?: string;
    allowedCidrs?: string[];
  };
  screenscraper?: {
    username?: string;
    password?: string;
    secretKey?: string;
  };
  personalization?: {
    theme?: string;
  };
}

export interface WizardStepResult {
  setupComplete: boolean;
  steps: Record<OnboardingStepKey, OnboardingStepState>;
}

export interface CreateFirstAdminPayload {
  email: string;
  nickname: string;
  password: string;
}

export async function fetchOnboardingStatus(): Promise<OnboardingStatus> {
  return apiFetch<OnboardingStatus>("/onboarding/status");
}

export async function createFirstAdmin(
  payload: CreateFirstAdminPayload
): Promise<SessionPayload> {
  return apiFetch<SessionPayload>("/onboarding/admin", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

interface UpdateOnboardingStepOptions {
  accessToken?: string | null;
}

export interface UpdateOnboardingStepPayload {
  status: "COMPLETED" | "SKIPPED";
  settings?: SettingsUpdatePayload;
  notes?: string;
}

export async function updateOnboardingStep(
  stepKey: OnboardingStepKey,
  payload: UpdateOnboardingStepPayload,
  options?: UpdateOnboardingStepOptions
): Promise<WizardStepResult> {
  try {
    return await apiFetch<WizardStepResult>(`/onboarding/steps/${stepKey}`, {
      method: "PATCH",
      headers: options?.accessToken
        ? { authorization: `Bearer ${options.accessToken}` }
        : undefined,
      body: JSON.stringify(payload)
    });
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(
      error instanceof Error ? error.message : "Failed to update onboarding step",
      500
    );
  }
}
