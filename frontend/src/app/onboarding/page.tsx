'use client';

import { useEffect, useMemo, useState, type ComponentType } from 'react';

import ProgressSteps, { type ProgressStep } from '@/components/ProgressSteps';

import { EmulatorConfigStep } from './steps/EmulatorConfigStep';
import { HealthCheckStep } from './steps/HealthCheckStep';
import { ProfileVerificationStep } from './steps/ProfileVerificationStep';
import { RomUploadStep } from './steps/RomUploadStep';
import type { OnboardingProgress, StepDataMap, StepKey, StepStatus } from './types';
import styles from './page.module.css';

const STORAGE_KEY = 'treazr.adminOnboarding.v1';

const defaultProgress: OnboardingProgress = {
  health: { completed: false },
  profile: { completed: false },
  emulator: { completed: false },
  rom: { completed: false },
  lastUpdated: new Date().toISOString(),
};

const readStoredProgress = (): OnboardingProgress => {
  if (typeof window === 'undefined') {
    return defaultProgress;
  }

  const stored =
    window.localStorage.getItem(STORAGE_KEY) ?? window.sessionStorage.getItem(STORAGE_KEY);

  if (!stored) {
    return defaultProgress;
  }

  try {
    const parsed = JSON.parse(stored) as OnboardingProgress;
    return {
      ...defaultProgress,
      ...parsed,
    };
  } catch {
    return defaultProgress;
  }
};

const persistProgress = (progress: OnboardingProgress) => {
  if (typeof window === 'undefined') {
    return;
  }

  const serialized = JSON.stringify(progress);

  try {
    window.localStorage.setItem(STORAGE_KEY, serialized);
    window.sessionStorage.setItem(STORAGE_KEY, serialized);
  } catch {
    // Ignore storage errors (e.g. private mode)
  }
};

type StepConfig<K extends StepKey> = {
  key: K;
  title: string;
  description: string;
  component: ComponentType<{
    state: StepStatus<StepDataMap[K]>;
    onComplete: (result: StepDataMap[K]) => void;
  }>;
};

const wizardSteps: StepConfig<StepKey>[] = [
  {
    key: 'health',
    title: 'Check API health',
    description: 'Call /health and confirm Redis and MinIO respond.',
    component: HealthCheckStep,
  },
  {
    key: 'profile',
    title: 'Verify profile',
    description: 'Update the admin display name and support contact.',
    component: ProfileVerificationStep,
  },
  {
    key: 'emulator',
    title: 'Configure EmulatorJS',
    description: 'Save the embed.js endpoint that EmulatorJS hosts.',
    component: EmulatorConfigStep,
  },
  {
    key: 'rom',
    title: 'Upload first ROM',
    description: 'Call /admin/roms with a cleared build.',
    component: RomUploadStep,
  },
];

const findNextStepIndex = (value: OnboardingProgress): number => {
  const index = wizardSteps.findIndex((step) => !value[step.key].completed);
  return index === -1 ? wizardSteps.length - 1 : index;
};

export default function OnboardingPage() {
  const [progress, setProgress] = useState<OnboardingProgress>(defaultProgress);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const stored = readStoredProgress();
    setProgress(stored);
    setCurrentStepIndex(findNextStepIndex(stored));
    setIsHydrated(true);
  }, []);

  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    persistProgress(progress);
  }, [progress, isHydrated]);

  const handleCompletion =
    <K extends StepKey>(key: K) =>
    (data: StepDataMap[K]) => {
      setProgress((previous) => {
        const updated = {
          ...previous,
          [key]: { completed: true, data },
          lastUpdated: new Date().toISOString(),
        } as OnboardingProgress;

        setCurrentStepIndex(findNextStepIndex(updated));
        return updated;
      });
    };

  const progressSteps: ProgressStep[] = useMemo(
    () =>
      wizardSteps.map((step, index) => {
        const status = progress[step.key].completed
          ? 'completed'
          : index === currentStepIndex
            ? 'current'
            : 'pending';

        return {
          title: step.title,
          description: step.description,
          status,
        } satisfies ProgressStep;
      }),
    [currentStepIndex, progress],
  );

  const activeStep = wizardSteps[currentStepIndex];
  const ActiveComponent = activeStep.component;

  const canJumpToStep = (index: number) => {
    if (index === currentStepIndex) {
      return true;
    }

    const precedingSteps = wizardSteps.slice(0, index);
    return precedingSteps.every((step) => progress[step.key].completed);
  };

  return (
    <div className="pixellab-grid">
      <div className="pixellab-content">
        <div className={styles.layout}>
          <section className={styles.heroCard} aria-labelledby="onboarding-title">
            <p className="eyebrow">Admin onboarding</p>
            <h1 id="onboarding-title">Complete the Treazr Island setup flow</h1>
            <p>
              Check infrastructure health, confirm your admin profile, configure EmulatorJS, and
              upload the first ROM without leaving this page.
            </p>
            <p className={styles.timestamp}>
              Last updated {new Date(progress.lastUpdated).toLocaleString()}
            </p>
          </section>

          <section className={styles.progressCard} aria-labelledby="wizard-progress">
            <p id="wizard-progress" className={styles.progressHeading}>
              Progress tracker
            </p>
            <ProgressSteps steps={progressSteps} />
            <ul className={styles.stepNav}>
              {wizardSteps.map((step, index) => (
                <li key={step.key}>
                  <button
                    type="button"
                    onClick={() => canJumpToStep(index) && setCurrentStepIndex(index)}
                    disabled={!canJumpToStep(index)}
                  >
                    {index + 1}. {step.title}
                  </button>
                </li>
              ))}
            </ul>
          </section>

          <section className={styles.stepWrapper}>
            <ActiveComponent
              state={progress[activeStep.key]}
              onComplete={handleCompletion(activeStep.key)}
            />
          </section>
        </div>
      </div>
    </div>
  );
}
