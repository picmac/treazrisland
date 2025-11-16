'use client';

import { useEffect, useState } from 'react';

import { runHealthCheck, type HealthResponse } from '@/lib/admin';

import type { HealthCheckResult, StepStatus } from '../types';
import styles from '../page.module.css';

interface HealthCheckStepProps {
  state: StepStatus<HealthCheckResult>;
  onComplete: (result: HealthCheckResult) => void;
}

export function HealthCheckStep({ state, onComplete }: HealthCheckStepProps) {
  const [result, setResult] = useState<HealthCheckResult | null>(state.data ?? null);
  const [isChecking, setIsChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (state.data) {
      setResult(state.data);
    }
  }, [state.data]);

  const handleCheck = async () => {
    setIsChecking(true);
    setError(null);

    try {
      const response = await runHealthCheck();
      const payload: HealthCheckResult = {
        ...(response as HealthResponse),
        checkedAt: new Date().toISOString(),
      };
      setResult(payload);
      onComplete(payload);
    } catch (checkError) {
      const message = checkError instanceof Error ? checkError.message : 'Health check failed';
      setError(message);
    } finally {
      setIsChecking(false);
    }
  };

  return (
    <div className={styles.stepCard}>
      <div className={styles.stepHeader}>
        <h2>1. Verify backend health</h2>
        <p>Ping the API and object storage dependencies before inviting anyone.</p>
      </div>

      <button
        type="button"
        className={styles.primaryButton}
        onClick={handleCheck}
        disabled={isChecking}
      >
        {isChecking ? 'Running checks…' : 'Run health check'}
      </button>

      {error && (
        <p role="alert" className={styles.errorMessage}>
          {error}
        </p>
      )}

      {result && (
        <div className={styles.statusPanel}>
          <p>
            Stack status: <strong>{result.status.toUpperCase()}</strong>
          </p>
          <p className={styles.timestamp}>
            Last checked {new Date(result.checkedAt).toLocaleString()}
          </p>
          <dl className={styles.dependencyList}>
            <div>
              <dt>Redis</dt>
              <dd>{result.dependencies.redis.status}</dd>
            </div>
            <div>
              <dt>Object storage</dt>
              <dd>
                {result.dependencies.objectStorage.bucket} ·{' '}
                {result.dependencies.objectStorage.region}
              </dd>
            </div>
          </dl>
        </div>
      )}
    </div>
  );
}
