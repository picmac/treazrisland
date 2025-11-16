'use client';

import { FormEvent, useEffect, useState } from 'react';

import { fetchAdminProfile, updateAdminProfile } from '@/lib/admin';

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
    <div className={styles.stepCard}>
      <div className={styles.stepHeader}>
        <h2>2. Verify admin profile</h2>
        <p>Confirm the display name, timezone, and support contact players will see.</p>
      </div>

      <div className={styles.inlineActions}>
        <button
          type="button"
          className={styles.secondaryButton}
          onClick={handleLoadProfile}
          disabled={isLoading}
        >
          {isLoading ? 'Loading…' : 'Load profile from API'}
        </button>
      </div>

      <form className={styles.formGrid} onSubmit={handleSubmit}>
        <label>
          Display name
          <input
            type="text"
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            placeholder="Pixellab Studio"
          />
        </label>

        <label>
          Timezone
          <select value={timezone} onChange={(event) => setTimezone(event.target.value)}>
            {TIMEZONE_OPTIONS.map((zone) => (
              <option key={zone} value={zone}>
                {zone}
              </option>
            ))}
          </select>
        </label>

        <label>
          Support contact
          <input
            type="text"
            value={supportContact}
            onChange={(event) => setSupportContact(event.target.value)}
            placeholder="support@treazr.example"
          />
        </label>

        <button type="submit" className={styles.primaryButton} disabled={isSaving}>
          {isSaving ? 'Saving…' : 'Save profile'}
        </button>
      </form>

      {error && (
        <p role="alert" className={styles.errorMessage}>
          {error}
        </p>
      )}

      {success && <p className={styles.successMessage}>{success}</p>}
    </div>
  );
}
