'use client';

import { FormEvent, useEffect, useState } from 'react';

import { fetchAdminProfile, updateAdminProfile } from '@/lib/admin';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { FormField } from '@/components/ui/FormField';
import { StatusPill } from '@/components/ui/StatusPill';

import type { ProfileVerificationResult, StepStatus } from '../types';
import styles from '../page.module.css';

const TIMEZONE_OPTIONS = [
  'UTC',
  'America/Los_Angeles',
  'America/New_York',
  'Europe/Berlin',
  'Asia/Tokyo',
];

interface ProfileVerificationStepProps {
  state: StepStatus<ProfileVerificationResult>;
  onComplete: (result: ProfileVerificationResult) => void;
}

export function ProfileVerificationStep({ state, onComplete }: ProfileVerificationStepProps) {
  const [displayName, setDisplayName] = useState(state.data?.displayName ?? '');
  const [timezone, setTimezone] = useState(state.data?.timezone ?? TIMEZONE_OPTIONS[0]);
  const [supportContact, setSupportContact] = useState(state.data?.supportContact ?? '');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (state.data) {
      setDisplayName(state.data.displayName);
      setTimezone(state.data.timezone);
      setSupportContact(state.data.supportContact);
    }
  }, [state.data]);

  const handleLoadProfile = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetchAdminProfile();
      setDisplayName(response.user.displayName ?? '');
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : 'Unable to load profile';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!displayName.trim() || !supportContact.trim()) {
      setError('Display name and support contact are required.');
      return;
    }

    setIsSaving(true);
    setError(null);
    setSuccess(null);

    try {
      await updateAdminProfile({ displayName });
      const payload: ProfileVerificationResult = {
        displayName,
        timezone,
        supportContact,
        verifiedAt: new Date().toISOString(),
      };
      onComplete(payload);
      setSuccess('Profile saved. You can revisit this step any time.');
    } catch (saveError) {
      const message = saveError instanceof Error ? saveError.message : 'Unable to save profile';
      setError(message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card
      as="article"
      className={styles.stepCard}
      title="2. Verify admin profile"
      description="Confirm the display name, timezone, and support contact players will see."
    >
      <div className={styles.inlineActions}>
        <Button type="button" variant="secondary" onClick={handleLoadProfile} loading={isLoading}>
          {isLoading ? 'Loading…' : 'Load profile from API'}
        </Button>
        {success && <StatusPill tone="success">{success}</StatusPill>}
        {error && (
          <StatusPill tone="danger" role="alert">
            {error}
          </StatusPill>
        )}
      </div>

      <form className={styles.formGrid} onSubmit={handleSubmit}>
        <FormField
          label="Display name"
          inputProps={{
            type: 'text',
            value: displayName,
            onChange: (event) => setDisplayName(event.target.value),
            placeholder: 'Pixellab Studio',
          }}
        />

        <FormField
          label="Timezone"
          inputSlot={
            <select
              value={timezone}
              onChange={(event) => setTimezone(event.target.value)}
              className={styles.select}
            >
              {TIMEZONE_OPTIONS.map((zone) => (
                <option key={zone} value={zone}>
                  {zone}
                </option>
              ))}
            </select>
          }
        />

        <FormField
          label="Support contact"
          description="Shown to players in support touchpoints."
          inputProps={{
            type: 'text',
            value: supportContact,
            onChange: (event) => setSupportContact(event.target.value),
            placeholder: 'support@treazr.example',
          }}
        />

        <Button type="submit" loading={isSaving}>
          {isSaving ? 'Saving…' : 'Save profile'}
        </Button>
      </form>
    </Card>
  );
}
