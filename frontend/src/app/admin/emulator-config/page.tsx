'use client';

import { FormEvent, useEffect, useState } from 'react';

import { fetchEmulatorConfig, saveEmulatorConfig } from '@/lib/admin';

const FALLBACK_EMBED_URL =
  process.env.NEXT_PUBLIC_EMULATOR_EMBED_URL ?? 'http://localhost:8080/dist/embed.js';

type Status = 'idle' | 'loading' | 'saving' | 'success' | 'error';

export default function EmulatorConfigPage() {
  const [embedUrl, setEmbedUrl] = useState(FALLBACK_EMBED_URL);
  const [lastVerifiedAt, setLastVerifiedAt] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>('idle');
  const [message, setMessage] = useState<string | null>(null);

  const loadConfig = async () => {
    setStatus('loading');
    setMessage(null);

    try {
      const response = await fetchEmulatorConfig();
      setEmbedUrl(response.config.embedUrl);
      setLastVerifiedAt(response.config.verifiedAt);
      setStatus('idle');
    } catch (error) {
      const friendlyMessage =
        error instanceof Error ? error.message : 'Unable to load EmulatorJS configuration';
      setStatus('error');
      setMessage(friendlyMessage);
    }
  };

  useEffect(() => {
    void loadConfig();
  }, []);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!embedUrl.trim()) {
      setStatus('error');
      setMessage('Embed URL is required.');
      return;
    }

    setStatus('saving');
    setMessage(null);

    try {
      const response = await saveEmulatorConfig({ embedUrl });
      setEmbedUrl(response.config.embedUrl);
      setLastVerifiedAt(response.config.verifiedAt);
      setStatus('success');
      setMessage('Emulator endpoint verified and saved.');
    } catch (error) {
      const friendlyMessage =
        error instanceof Error ? error.message : 'Unable to save EmulatorJS configuration';
      setStatus('error');
      setMessage(friendlyMessage);
    }
  };

  return (
    <main className="settings-page">
      <section className="settings-card">
        <header>
          <p className="eyebrow">Admin · EmulatorJS</p>
          <h1>Configure embed endpoint</h1>
          <p className="lead">
            Save the EmulatorJS <code>embed.js</code> URL used across the admin console and player
            runtime. Updates are verified before they are persisted.
          </p>
        </header>

        <form className="settings-form" onSubmit={handleSubmit}>
          <label className="settings-field">
            <span>Embed URL</span>
            <input
              type="url"
              name="embedUrl"
              value={embedUrl}
              onChange={(event) => setEmbedUrl(event.target.value)}
              placeholder="http://localhost:8080/dist/embed.js"
              required
              disabled={status === 'loading' || status === 'saving'}
            />
          </label>

          {lastVerifiedAt && (
            <p className="settings-message">
              Last verified on {new Date(lastVerifiedAt).toLocaleString()}
            </p>
          )}

          {message && (
            <p
              className={`settings-message settings-message--${status === 'error' ? 'error' : 'success'}`}
              role="status"
            >
              {message}
            </p>
          )}

          <div className="settings-actions">
            <button type="button" onClick={() => void loadConfig()} disabled={status === 'loading'}>
              {status === 'loading' ? 'Loading…' : 'Reload from backend'}
            </button>
            <button type="submit" disabled={status === 'loading' || status === 'saving'}>
              {status === 'saving' ? 'Validating…' : 'Save configuration'}
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}
