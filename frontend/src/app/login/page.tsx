'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useSearchParams } from 'next/navigation';
import { exchangeMagicLinkToken, loginWithPassword, type AuthResponse } from '@/lib/apiClient';
import { storeAccessToken } from '@/lib/authTokens';

type FormStatus = {
  state: 'idle' | 'loading' | 'success' | 'error';
  message?: string;
  detail?: string;
};

const idleStatus: FormStatus = { state: 'idle' };

export default function LoginPage() {
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
        detail: `Welcome back ${result.user.email}`
      });
    } catch (error) {
      setMagicStatus({
        state: 'error',
        message: error instanceof Error ? error.message : 'Magic link exchange failed.'
      });
    }
  };

  const handlePasswordSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!email.trim() || !password.trim()) {
      setPasswordStatus({ state: 'error', message: 'Email and password are required.' });
      return;
    }

    setPasswordStatus({ state: 'loading', message: 'Verifying credentials…' });
    setPasswordResult(null);

    try {
      const result = await loginWithPassword(email.trim(), password);
      storeAccessToken(result.accessToken);
      setPasswordResult(result);
      setPasswordStatus({
        state: 'success',
        message: 'Password login successful.',
        detail: `Session issued for ${result.user.email}`
      });
    } catch (error) {
      setPasswordStatus({
        state: 'error',
        message: error instanceof Error ? error.message : 'Unable to log in with password.'
      });
    }
  };

  return (
    <section aria-label="Operator login" className="auth-section">
      <header>
        <p className="eyebrow">Secure Docking</p>
        <h1>Authenticate your Treazr Island session</h1>
        <p className="lede">
          Use the magic link token from your invitation email or fall back to the operator password issued during bootstrap.
        </p>
      </header>

      <div className="auth-grid">
        <article className="auth-card">
          <h2>Magic link entry</h2>
          <p>Paste the short-lived token supplied via email or CLI invite to receive a fresh session.</p>
          <form onSubmit={handleMagicSubmit}>
            <label>
              <span>Magic link token</span>
              <input
                type="text"
                name="magic-token"
                value={magicToken}
                onChange={(event) => setMagicToken(event.target.value)}
                autoComplete="one-time-code"
                placeholder="e.g. pixellab-6Yz1"
                disabled={magicStatus.state === 'loading'}
                required
              />
            </label>
            <button type="submit" disabled={magicStatus.state === 'loading'}>
              {magicStatus.state === 'loading' ? 'Authorising…' : 'Redeem magic link'}
            </button>
          </form>
          <StatusMessage status={magicStatus} result={magicResult} />
        </article>

        <article className="auth-card">
          <h2>Fallback password login</h2>
          <p>The admin bootstrap password works even if invites aren’t configured yet.</p>
          <form onSubmit={handlePasswordSubmit}>
            <label>
              <span>Email</span>
              <input
                type="email"
                name="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
                placeholder="you@example.com"
                disabled={passwordStatus.state === 'loading'}
                required
              />
            </label>
            <label>
              <span>Password</span>
              <input
                type="password"
                name="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
                placeholder="••••••••"
                disabled={passwordStatus.state === 'loading'}
                required
              />
            </label>
            <button type="submit" disabled={passwordStatus.state === 'loading'}>
              {passwordStatus.state === 'loading' ? 'Checking…' : 'Log in'}
            </button>
          </form>
          <StatusMessage status={passwordStatus} result={passwordResult} />
        </article>
      </div>
    </section>
  );
}

function StatusMessage({ status, result }: { status: FormStatus; result: AuthResponse | null }) {
  if (status.state === 'idle') {
    return null;
  }

  return (
    <div className={`auth-status auth-status--${status.state}`} role="status" aria-live="polite">
      <p>{status.message}</p>
      {status.detail && <p>{status.detail}</p>}
      {result?.accessToken && status.state === 'success' && (
        <code className="token-preview" aria-label="Access token preview">
          {result.accessToken.slice(0, 16)}…
        </code>
      )}
    </div>
  );
}
