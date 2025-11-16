'use client';

// The onboarding wizard imports this component from a client page, so it must
// be marked as a client component to satisfy Next.js' server/client boundaries.

import styles from './ProgressSteps.module.css';

export type ProgressStepStatus = 'pending' | 'current' | 'completed';

export interface ProgressStep {
  title: string;
  description?: string;
  status: ProgressStepStatus;
}

interface ProgressStepsProps {
  steps: ProgressStep[];
}

export function ProgressSteps({ steps }: ProgressStepsProps) {
  return (
    <ol className={styles.progressWrapper} aria-label="Admin onboarding progress">
      {steps.map((step, index) => {
        const indicator = step.status === 'completed' ? '✓' : index + 1;

        return (
          <li key={step.title} className={`${styles.step} ${styles[step.status]}`}>
            <span className={styles.stepIndicator} aria-hidden="true">
              {indicator}
            </span>
            <div>
              <p className={styles.stepTitle}>{step.title}</p>
              {step.description && <p className={styles.stepDescription}>{step.description}</p>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export default ProgressSteps;
