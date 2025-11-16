import type { EmulatorConfig, HealthResponse } from '@/lib/admin';

export type StepKey = 'health' | 'profile' | 'emulator' | 'rom';

export interface HealthCheckResult extends HealthResponse {
  checkedAt: string;
}

export interface ProfileVerificationResult {
  displayName: string;
  timezone: string;
  supportContact: string;
  verifiedAt: string;
}

export interface EmulatorConfigResult extends EmulatorConfig {}

export interface RomUploadResult {
  romId: string;
  title: string;
  filename: string;
  uploadedAt: string;
}

export interface StepStatus<T> {
  completed: boolean;
  data?: T;
}

export interface OnboardingProgress {
  health: StepStatus<HealthCheckResult>;
  profile: StepStatus<ProfileVerificationResult>;
  emulator: StepStatus<EmulatorConfigResult>;
  rom: StepStatus<RomUploadResult>;
  lastUpdated: string;
}

export type StepDataMap = {
  health: HealthCheckResult;
  profile: ProfileVerificationResult;
  emulator: EmulatorConfigResult;
  rom: RomUploadResult;
};
