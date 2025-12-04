'use client';

import { useEffect, useState } from 'react';

import { runHealthCheck, type HealthResponse } from '@/lib/admin';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { StatusPill } from '@/components/ui/StatusPill';
import { Card } from '@/components/ui/Card';

import type { HealthCheckResult, StepStatus } from '../types';
import { formatTimestamp } from '../formatTimestamp';
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
    <Card
      as="article"
      className={styles.stepCard}
      title="1. Verify backend health"
      description="Ping the API and object storage dependencies before inviting anyone."
    >
      <Button type="button" onClick={handleCheck} loading={isChecking}>
        {isChecking ? 'Running checks…' : 'Run health check'}
      </Button>

      {error && (
        <Alert tone="danger" dense role="alert">
          {error}
        </Alert>
      )}

      {result && (
        <div className={styles.statusPanel}>
          <div className={styles.inlineActions}>
            <StatusPill tone={result.status === 'ok' ? 'success' : 'warning'}>
              Stack: {result.status.toUpperCase()}
            </StatusPill>
            <StatusPill tone="info">{formatTimestamp(result.checkedAt)}</StatusPill>
          </div>
          <dl className={styles.dependencyList}>
            <div>
              <dt>Redis</dt>
              <dd>{result.dependencies.redis.status}</dd>
            </div>
            <div>
              <dt>Postgres</dt>
              <dd>{result.dependencies.prisma.status}</dd>
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
    </Card>
  );
}
