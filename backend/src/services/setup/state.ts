import type { Prisma, PrismaClient } from "@prisma/client";

export const ONBOARDING_STEP_KEYS = [
  "first-admin",
  "system-profile",
  "integrations",
  "personalization",
] as const;

export type OnboardingStepKey = (typeof ONBOARDING_STEP_KEYS)[number];

export type OnboardingStepStatus = "PENDING" | "COMPLETED" | "SKIPPED";

export interface OnboardingStepState {
  status: OnboardingStepStatus;
  updatedAt: string;
  payload?: unknown;
}

export interface SetupStateView {
  setupComplete: boolean;
  steps: Record<OnboardingStepKey, OnboardingStepState>;
}

const REQUIRED_STEPS: OnboardingStepKey[] = ["first-admin", "system-profile"];

const defaultStepState = (
  status: OnboardingStepStatus = "PENDING",
): OnboardingStepState => ({ status, updatedAt: new Date().toISOString() });

const initialSteps = (): Record<OnboardingStepKey, OnboardingStepState> => ({
  "first-admin": defaultStepState(),
  "system-profile": defaultStepState(),
  integrations: defaultStepState(),
  personalization: defaultStepState(),
});

const toJson = (
  steps: Record<OnboardingStepKey, OnboardingStepState>,
): Prisma.JsonObject => steps as unknown as Prisma.JsonObject;

const normalizeSteps = (
  json: Prisma.JsonValue | null | undefined,
): Record<OnboardingStepKey, OnboardingStepState> => {
  const base = initialSteps();
  if (!json || typeof json !== "object" || Array.isArray(json)) {
    return base;
  }

  const record = json as Record<string, unknown>;
  for (const key of ONBOARDING_STEP_KEYS) {
    const raw = record[key];
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      continue;
    }
    const status = (raw as { status?: unknown }).status;
    const updatedAt = (raw as { updatedAt?: unknown }).updatedAt;
    const payload = (raw as { payload?: unknown }).payload;

    if (
      status === "PENDING" ||
      status === "COMPLETED" ||
      status === "SKIPPED"
    ) {
      base[key] = {
        status,
        updatedAt:
          typeof updatedAt === "string" ? updatedAt : new Date().toISOString(),
        payload,
      };
    }
  }

  return base;
};

const computeSetupComplete = (
  steps: Record<OnboardingStepKey, OnboardingStepState>,
): boolean => {
  const requiredSatisfied = REQUIRED_STEPS.every(
    (stepKey) => steps[stepKey]?.status === "COMPLETED",
  );
  const allResolved = ONBOARDING_STEP_KEYS.every(
    (stepKey) => steps[stepKey]?.status !== "PENDING",
  );
  return requiredSatisfied && allResolved;
};

export const fetchSetupState = async (
  prisma: PrismaClient,
): Promise<SetupStateView> => {
  const existing = await prisma.setupState.findUnique({ where: { id: 1 } });
  if (!existing) {
    const steps = initialSteps();
    const created = await prisma.setupState.create({
      data: {
        id: 1,
        setupComplete: false,
        steps: toJson(steps),
      },
    });
    return {
      setupComplete: created.setupComplete,
      steps,
    };
  }

  const steps = normalizeSteps(existing.steps);
  return {
    setupComplete: existing.setupComplete,
    steps,
  };
};

export const updateSetupStep = async (
  prisma: PrismaClient,
  stepKey: OnboardingStepKey,
  status: OnboardingStepStatus,
  payload?: unknown,
): Promise<SetupStateView> => {
  const current = await fetchSetupState(prisma);
  const nextSteps: Record<OnboardingStepKey, OnboardingStepState> = {
    ...current.steps,
    [stepKey]: {
      status,
      payload,
      updatedAt: new Date().toISOString(),
    },
  };

  const setupComplete = computeSetupComplete(nextSteps);

  const updated = await prisma.setupState.upsert({
    where: { id: 1 },
    create: {
      id: 1,
      setupComplete,
      steps: toJson(nextSteps),
    },
    update: {
      setupComplete,
      steps: toJson(nextSteps),
    },
  });

  return {
    setupComplete: updated.setupComplete,
    steps: nextSteps,
  };
};

export const markSetupComplete = async (
  prisma: PrismaClient,
): Promise<SetupStateView> => {
  const current = await fetchSetupState(prisma);
  const setupComplete = computeSetupComplete(current.steps);
  const updated = await prisma.setupState.upsert({
    where: { id: 1 },
    create: {
      id: 1,
      setupComplete,
      steps: toJson(current.steps),
    },
    update: {
      setupComplete,
    },
  });

  return {
    setupComplete: updated.setupComplete,
    steps: current.steps,
  };
};
