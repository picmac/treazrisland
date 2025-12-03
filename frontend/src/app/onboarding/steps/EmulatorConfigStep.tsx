'use client';

import { useEffect, useRef, useState } from 'react';

import { fetchEmulatorConfig, saveEmulatorConfig } from '@/lib/admin';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { FormField } from '@/components/ui/FormField';
import { StatusPill } from '@/components/ui/StatusPill';

import type { EmulatorConfigResult, StepStatus } from '../types';
import styles from '../page.module.css';

const FALLBACK_EMBED_URL =
  process.env.NEXT_PUBLIC_EMULATOR_EMBED_URL ?? 'http://localhost:8080/dist/embed.js';

interface EmulatorConfigStepProps {
  state: StepStatus<EmulatorConfigResult>;
  onComplete: (result: EmulatorConfigResult) => void;
}

export function EmulatorConfigStep({ state, onComplete }: EmulatorConfigStepProps) {
  const [embedUrl, setEmbedUrl] = useState(state.data?.embedUrl ?? FALLBACK_EMBED_URL);
  const [lastVerifiedAt, setLastVerifiedAt] = useState<string | null>(
    state.data?.verifiedAt ?? null,
  );
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const completionTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    if (state.data) {
      setEmbedUrl(state.data.embedUrl);
      setLastVerifiedAt(state.data.verifiedAt ?? null);
    }
  }, [state.data]);

  useEffect(() => {
    if (!state.data) {
      void loadConfig();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadConfig = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetchEmulatorConfig();
      setEmbedUrl(response.config.embedUrl);
      setLastVerifiedAt(response.config.verifiedAt);
    } catch (loadError) {
      const message =
        loadError instanceof Error ? loadError.message : 'Unable to load EmulatorJS config';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    return () => {
      if (completionTimeoutRef.current) {
        window.clearTimeout(completionTimeoutRef.current);
      }
    };
  }, []);

  const handleSave = async () => {
    if (!embedUrl.trim()) {
      setError('Embed URL is required.');
      return;
    }

    setIsSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await saveEmulatorConfig({ embedUrl });
      setLastVerifiedAt(response.config.verifiedAt);
      setSuccess('Emulator endpoint verified and saved.');
      if (completionTimeoutRef.current) {
        window.clearTimeout(completionTimeoutRef.current);
      }
      completionTimeoutRef.current = window.setTimeout(() => {
        onComplete(response.config);
        completionTimeoutRef.current = null;
      }, 1000);
    } catch (saveError) {
      const message =
        saveError instanceof Error ? saveError.message : 'Unable to verify EmulatorJS endpoint';
      setError(message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card
      as="article"
      className={styles.stepCard}
      title="3. Configure EmulatorJS endpoint"
      description="Point the dashboard at the EmulatorJS embed bundle served by your infrastructure."
    >
      <FormField
        label="Embed URL"
        description="Use the embed.js endpoint hosted by your EmulatorJS service."
        inputProps={{
          type: 'url',
          value: embedUrl,
          onChange: (event) => setEmbedUrl(event.target.value),
          placeholder: 'http://localhost:8080/dist/embed.js',
        }}
      />

      <div className={styles.inlineActions}>
        <Button type="button" variant="secondary" onClick={loadConfig} loading={isLoading}>
          {isLoading ? 'Loading…' : 'Reload from backend'}
        </Button>
        <Button type="button" onClick={handleSave} loading={isSaving}>
          {isSaving ? 'Validating…' : 'Validate & save'}
        </Button>
      </div>

      <div className={styles.inlineActions}>
        {lastVerifiedAt && (
          <StatusPill tone="success">
            Verified {new Date(lastVerifiedAt).toLocaleString()}
          </StatusPill>
        )}
        {success && <StatusPill tone="info">{success}</StatusPill>}
        {error && (
          <StatusPill tone="danger" role="alert">
            {error}
          </StatusPill>
        )}
      </div>
    </Card>
  );
}
