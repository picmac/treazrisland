'use client';

import { Suspense, useEffect, useState, type FormEvent } from 'react';
import { useSearchParams } from 'next/navigation';
import { exchangeMagicLinkToken, loginWithPassword, type AuthResponse } from '@/lib/apiClient';
import { storeAccessToken } from '@/lib/authTokens';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { FormField } from '@/components/ui/FormField';
import { StatusPill } from '@/components/ui/StatusPill';
import styles from './page.module.css';

type FormStatus = {
  state: 'idle' | 'loading' | 'success' | 'error';
  message?: string;
  detail?: string;
};

const idleStatus: FormStatus = { state: 'idle' };

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <section aria-label="Operator login" className="auth-section page-content">
          <header>
            <p className="eyebrow">Secure Docking</p>
            <h1>Loading authentication portal…</h1>
            <p className="lede">Preparing the magic link and password flows.</p>
          </header>
        </section>
      }
    >
      <LoginFormShell />
    </Suspense>
  );
}

function LoginFormShell() {
  const searchParams = useSearchParams();
  const [magicToken, setMagicToken] = useState('');
  const [magicStatus, setMagicStatus] = useState<FormStatus>(idleStatus);
  const [magicResult, setMagicResult] = useState<AuthResponse | null>(null);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordStatus, setPasswordStatus] = useState<FormStatus>(idleStatus);
  const [passwordResult, setPasswordResult] = useState<AuthResponse | null>(null);

  useEffect(() => {
    const tokenFromQuery = searchParams.get('token');
    if (tokenFromQuery) {
      setMagicToken(tokenFromQuery);
    }
  }, [searchParams]);

  const handleMagicSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!magicToken.trim()) {
      setMagicStatus({ state: 'error', message: 'Enter the magic link token to continue.' });
      return;
    }

    setMagicStatus({ state: 'loading', message: 'Exchanging magic link…' });
    setMagicResult(null);

    try {
      const result = await exchangeMagicLinkToken(magicToken.trim());
      storeAccessToken(result.accessToken);
      setMagicResult(result);
      setMagicStatus({
        state: 'success',
        message: 'Magic link accepted.',
        detail: `Welcome back ${result.user.email}`,
      });
    } catch (error) {
      setMagicStatus({
        state: 'error',
        message: error instanceof Error ? error.message : 'Magic link exchange failed.',
      });
    }
  };

  const handlePasswordSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    setPasswordStatus({ state: 'loading', message: 'Verifying credentials…' });
    setPasswordResult(null);

    try {
      if (!email.trim() || !password.trim()) {
        throw new Error('Email and password are required.');
      }

      const result = await loginWithPassword(email.trim(), password);
      storeAccessToken(result.accessToken);
      setPasswordResult(result);
      setPasswordStatus({
        state: 'success',
        message: 'Password login successful.',
        detail: `Session issued for ${result.user.email}`,
      });
    } catch (error) {
      setPasswordStatus({
        state: 'error',
        message: error instanceof Error ? error.message : 'Unable to log in with password.',
      });
    }
  };

  return (
    <main className="page-content" id="main-content">
      <section className={styles.layout} aria-label="Operator login">
        <div className={styles.sidebar}>
          <p className="eyebrow">Secure Docking</p>
          <h1>Authenticate your Treazr Island session</h1>
          <p className="lede">
            Use the invitation token from your email or the bootstrap admin credentials. Every flow
            shows inline guidance, validation, and a recovery path.
          </p>
          <div className={styles.statusRow}>
            <StatusPill tone="success">Status: API reachable</StatusPill>
            <StatusPill tone="info">Rate limiting active</StatusPill>
            <StatusPill tone="warning">Magic links expire fast</StatusPill>
          </div>
          <ul className={styles.helperList}>
            <li>Tokens are single-use and short lived for safety.</li>
            <li>Passwords must be at least 8 characters and never stored in localStorage.</li>
            <li>Access tokens persist via HTTP-only cookies and session rotation.</li>
          </ul>
        </div>

        <div className={styles.grid}>
          <Card title="Magic link entry" description="Redeem the email token for a fresh session.">
            <form className={styles.formStack} onSubmit={handleMagicSubmit}>
              <FormField
                label="Magic link token"
                description="Paste the one-time token from your invite message or CLI output."
                error={magicStatus.state === 'error' ? magicStatus.message : undefined}
                inputProps={{
                  type: 'text',
                  name: 'magic-token',
                  value: magicToken,
                  onChange: (event) => setMagicToken(event.target.value),
                  autoComplete: 'one-time-code',
                  placeholder: 'e.g. pixellab-6Yz1',
                  disabled: magicStatus.state === 'loading',
                  required: true,
                  'aria-label': 'Magic link token',
                }}
              />
              <Button type="submit" loading={magicStatus.state === 'loading'} fullWidth>
                Redeem magic link
              </Button>
              <StatusMessage status={magicStatus} result={magicResult} />
            </form>
          </Card>

          <Card
            title="Fallback password login"
            description="Use the bootstrap admin credentials or your invited account."
          >
            <form className={styles.formStack} onSubmit={handlePasswordSubmit}>
              <FormField
                label="Email"
                description="We normalize case and trim whitespace before submitting."
                error={passwordStatus.state === 'error' ? passwordStatus.message : undefined}
                inputProps={{
                  type: 'email',
                  name: 'email',
                  value: email,
                  onChange: (event) => setEmail(event.target.value),
                  autoComplete: 'email',
                  placeholder: 'you@example.com',
                  disabled: passwordStatus.state === 'loading',
                  required: true,
                }}
              />
              <FormField
                label="Password"
                description="Never shared with third parties. Stored as bcrypt hashes."
                error={passwordStatus.state === 'error' ? passwordStatus.message : undefined}
                inputProps={{
                  type: 'password',
                  name: 'password',
                  value: password,
                  onChange: (event) => setPassword(event.target.value),
                  autoComplete: 'current-password',
                  placeholder: '••••••••',
                  disabled: passwordStatus.state === 'loading',
                  required: true,
                }}
              />
              <div className={styles.actionRow}>
                <Button type="submit" loading={passwordStatus.state === 'loading'} fullWidth>
                  Log in
                </Button>
              </div>
              <StatusMessage status={passwordStatus} result={passwordResult} />
            </form>
          </Card>
        </div>
      </section>
    </main>
  );
}

function StatusMessage({ status, result }: { status: FormStatus; result: AuthResponse | null }) {
  if (status.state === 'idle') {
    return null;
  }

  return (
    <div
      className={`auth-status auth-status--${status.state}`}
      role={status.state === 'error' ? 'alert' : 'status'}
      aria-live="polite"
    >
      <p className={styles.statusMessage}>{status.message}</p>
      {status.detail && <p className={styles.statusMessage}>{status.detail}</p>}
      {result?.accessToken && status.state === 'success' && (
        <code className="token-preview" aria-label="Access token preview">
          {result.accessToken.slice(0, 16)}…
        </code>
      )}
    </div>
  );
}
