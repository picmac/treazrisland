'use client';

import { useState } from 'react';

import { clearStoredAccessToken } from '@/lib/authTokens';
import { logout } from '@/lib/apiClient';
import { Button } from './Button';

type SignOutButtonProps = {
  label?: string;
};

export function SignOutButton({ label = 'Sign out' }: SignOutButtonProps) {
  const [status, setStatus] = useState<'idle' | 'working' | 'done' | 'error'>('idle');

  const handleSignOut = async () => {
    setStatus('working');
    try {
      await logout();
      clearStoredAccessToken();
      setStatus('done');
    } catch {
      setStatus('error');
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
