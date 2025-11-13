'use client';

import { useState, type FormEvent } from 'react';

import { redeemInviteToken, type InviteRedemptionResponse } from '@/lib/apiClient';

type FormStatus = {
  state: 'idle' | 'loading' | 'success' | 'error';
  message?: string;
};

interface InvitePageProps {
  params: { token: string };
}

const initialStatus: FormStatus = { state: 'idle' };

export default function InvitePage({ params }: InvitePageProps) {
  const { token } = params;
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [status, setStatus] = useState<FormStatus>(initialStatus);
  const [result, setResult] = useState<InviteRedemptionResponse | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!email.trim() || !password.trim()) {
      setStatus({ state: 'error', message: 'Email and password are required.' });
      return;
    }

    if (password !== confirmPassword) {
      setStatus({ state: 'error', message: 'Passwords must match.' });
      return;
    }

    setStatus({ state: 'loading', message: 'Redeeming invite…' });
    setResult(null);

    try {
      const response = await redeemInviteToken(token, {
        email: email.trim(),
        password,
        displayName: displayName.trim() || undefined
      });
      setResult(response);
      setStatus({ state: 'success', message: response.message || 'Invite redeemed. You can now sign in.' });
    } catch (error) {
      setStatus({
        state: 'error',
        message: error instanceof Error ? error.message : 'Invite redemption failed.'
      });
    }
  };

  return (
    <section aria-label="Invitation redemption" className="auth-section">
      <header>
        <p className="eyebrow">Invitation detected</p>
        <h1>Unlock your Treazr Island profile</h1>
        <p className="lede">
          Token <strong>{token}</strong> is ready to be redeemed. Provide your contact info and a secure password to activate
          your account.
        </p>
      </header>

      <article className="auth-card">
        <h2>Set up your credentials</h2>
        <form onSubmit={handleSubmit}>
          <label>
            <span>Email</span>
            <input
              type="email"
              name="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="player@treazr.io"
              autoComplete="email"
              disabled={status.state === 'loading'}
              required
            />
          </label>
          <label>
            <span>Display name (optional)</span>
            <input
              type="text"
              name="displayName"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              placeholder="Treazr Cadet"
              disabled={status.state === 'loading'}
            />
          </label>
          <label>
            <span>Password</span>
            <input
              type="password"
              name="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Create a password"
              autoComplete="new-password"
              disabled={status.state === 'loading'}
              required
            />
          </label>
          <label>
            <span>Confirm password</span>
            <input
              type="password"
              name="confirmPassword"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              placeholder="Repeat password"
              autoComplete="new-password"
              disabled={status.state === 'loading'}
              required
            />
          </label>
          <button type="submit" disabled={status.state === 'loading'}>
            {status.state === 'loading' ? 'Linking…' : 'Redeem invite'}
          </button>
        </form>
        {status.state !== 'idle' && (
          <div className={`auth-status auth-status--${status.state}`} role="status" aria-live="polite">
            <p>{status.message}</p>
            {result?.accessToken && <p>Access token preview: {result.accessToken.slice(0, 16)}…</p>}
          </div>
        )}
      </article>
    </section>
  );
}
