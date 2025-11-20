'use client';

import { FormEvent, useEffect, useState } from 'react';

import ImageUploader from '@/components/forms/ImageUploader';
import { getCurrentUserProfile, updateUserProfile } from '@/lib/users';

export default function ProfileSettingsPage() {
  const [displayName, setDisplayName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarObjectKey, setAvatarObjectKey] = useState<string | null>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'saving' | 'error' | 'success'>('idle');
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const loadProfile = async () => {
      setStatus('loading');
      try {
        const response = await getCurrentUserProfile();
        setDisplayName(response.user.displayName ?? '');
        setAvatarUrl(response.user.avatarUrl ?? null);
        setAvatarObjectKey(response.user.avatarObjectKey ?? null);
        setStatus('idle');
      } catch (error) {
        setStatus('error');
        setMessage(error instanceof Error ? error.message : 'Unable to load profile');
      }
    };

    void loadProfile();
  }, []);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus('saving');
    setMessage(null);

    try {
      const response = await updateUserProfile({ displayName, avatarObjectKey });
      setDisplayName(response.user.displayName ?? '');
      setAvatarUrl(response.user.avatarUrl ?? null);
      setAvatarObjectKey(response.user.avatarObjectKey ?? null);
      setStatus('success');
      setMessage('Profile updated successfully.');
    } catch (error) {
      setStatus('error');
      setMessage(error instanceof Error ? error.message : 'Unable to update profile');
    }
  };

  const handleAvatarUploaded = (result: { objectKey: string; previewUrl: string }) => {
    setAvatarObjectKey(result.objectKey);
    setAvatarUrl(result.previewUrl);
    setStatus('idle');
    setMessage('Avatar uploaded. Save changes to apply it to your profile.');
  };

  return (
    <main className="settings-page">
      <section className="settings-card">
        <header>
          <p className="eyebrow">Profile</p>
          <h1>Edit your profile</h1>
          <p className="lead">
            Update the display name shown across Treazr Island and upload a fresh avatar using our
            direct-to-storage flow.
          </p>
        </header>

        <form className="settings-form" onSubmit={handleSubmit}>
          <label className="settings-field">
            <span>Display name</span>
            <input
              type="text"
              name="displayName"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              placeholder="Player One"
              disabled={status === 'loading' || status === 'saving'}
              minLength={2}
              maxLength={100}
              required
            />
          </label>

          <ImageUploader
            label="Avatar"
            helperText="Upload a square image for best results. Changes save when you update the form."
            initialPreviewUrl={avatarUrl}
            onUploaded={handleAvatarUploaded}
            disabled={status === 'loading' || status === 'saving'}
          />

          <div className="settings-actions">
            <button type="submit" disabled={status === 'loading' || status === 'saving'}>
              {status === 'saving' ? 'Saving…' : 'Save changes'}
            </button>
            {message && (
              <p className={`settings-message settings-message--${status}`} role="status">
                {message}
              </p>
            )}
          </div>
        </form>
      </section>
    </main>
  );
}
