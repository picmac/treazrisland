'use client';

import { useContext, useState } from 'react';

import { AppRouterContext } from 'next/dist/shared/lib/app-router-context.shared-runtime';

import { clearStoredAccessToken } from '@/lib/authTokens';
import { logout } from '@/lib/apiClient';
import { Button } from './Button';

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

    clearStoredAccessToken({ disableRefresh: true });

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
    <Button
      type="button"
      variant="ghost"
      size="md"
      onClick={handleSignOut}
      loading={status === 'working'}
      aria-live="polite"
      aria-label={copy}
    >
      {copy}
    </Button>
  );
}
