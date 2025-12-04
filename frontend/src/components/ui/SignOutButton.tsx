'use client';

import { useContext, useState } from 'react';

import { AppRouterContext } from 'next/dist/shared/lib/app-router-context.shared-runtime';

import { clearStoredAccessToken } from '@/lib/authTokens';
import { logout } from '@/lib/apiClient';

type SignOutButtonProps = {
  label?: string;
};

export function SignOutButton({ label = 'Sign out' }: SignOutButtonProps) {
  const [status, setStatus] = useState<'idle' | 'working' | 'done' | 'error'>('idle');
  const router = useContext(AppRouterContext);

  const handleSignOut = async () => {
    setStatus('working');
    try {
      await logout();
      setStatus('done');
    } catch {
      setStatus('error');
    }

    clearStoredAccessToken();

    if (router) {
      router.push('/login');
    } else if (typeof window !== 'undefined') {
      window.location.assign('/login');
    }
  };

  const copy =
    status === 'working'
      ? 'Signing out…'
      : status === 'done'
        ? 'Signed out'
        : status === 'error'
          ? 'Retry sign out'
          : label;

  return (
    <button
      type="button"
      onClick={handleSignOut}
      disabled={status === 'working'}
      style={{
        borderRadius: '0.75rem',
        border: '1px solid rgba(255, 255, 255, 0.25)',
        background: 'rgba(255, 255, 255, 0.06)',
        color: 'var(--pixellab-foreground)',
        padding: '0.55rem 0.9rem',
        textTransform: 'uppercase',
        letterSpacing: '0.08rem',
        fontSize: '0.7rem',
        cursor: status === 'working' ? 'progress' : 'pointer',
      }}
      aria-live="polite"
    >
      {copy}
    </button>
  );
}
