'use client';

import type { Route } from 'next';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

import { exchangeMagicLinkToken } from '@/lib/apiClient';
import { storeAccessToken } from '@/lib/authTokens';

interface MagicLinkPageProps {
  params: { token: string };
}

type RedemptionStatus = {
  state: 'loading' | 'success' | 'error';
  message: string;
  detail?: string;
};

const loadingStatus: RedemptionStatus = {
  state: 'loading',
  message: 'Confirming your magic link token…',
};

const successRedirectDelayMs = 1200;

export default function MagicLinkPage({ params }: MagicLinkPageProps) {
  const router = useRouter();
  const { token } = params;
  const [status, setStatus] = useState<RedemptionStatus>(loadingStatus);
  const redemptionAttemptedRef = useRef(false);
  const redirectTimerRef = useRef<number | null>(null);
  const successRedirectTarget = useMemo(() => '/library' as Route, []);

  const redeemMagicLink = useCallback(async () => {
    setStatus({ ...loadingStatus });
    try {
      const response = await exchangeMagicLinkToken(token);
      storeAccessToken(response.accessToken);
      setStatus({
        state: 'success',
        message: 'Magic link accepted. Redirecting to your library…',
        detail: `Welcome back ${response.user.email}`,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Magic link exchange failed. Try again.';
      setStatus({ state: 'error', message });
    }
  }, [token]);

  useEffect(() => {
    if (redemptionAttemptedRef.current) {
      return;
    }

    redemptionAttemptedRef.current = true;
    void redeemMagicLink();
  }, [redeemMagicLink]);

  useEffect(() => {
    if (status.state !== 'success') {
      return undefined;
    }

    router.prefetch(successRedirectTarget);
    redirectTimerRef.current = window.setTimeout(() => {
      router.replace(successRedirectTarget);
    }, successRedirectDelayMs);

    return () => {
      if (redirectTimerRef.current) {
        window.clearTimeout(redirectTimerRef.current);
        redirectTimerRef.current = null;
      }
    };
  }, [router, status.state, successRedirectTarget]);

  return (
    <section aria-label="Magic link" className="auth-section">
      <header>
        <p className="eyebrow">Secure docking</p>
        <h1>Redeeming your magic link</h1>
        <p className="lede">
          We&apos;re confirming token <strong>{token}</strong> so you can jump straight into the
          library.
        </p>
      </header>

      <article className="auth-card">
        <p>Verifications typically complete in a few seconds. Retry below if the token expired.</p>
        <button
          type="button"
          onClick={() => void redeemMagicLink()}
          disabled={status.state === 'loading'}
        >
          {status.state === 'loading' ? 'Verifying…' : 'Retry verification'}
        </button>
        <div
          className={`auth-status auth-status--${status.state}`}
          role="status"
          aria-live="polite"
        >
          <p>{status.message}</p>
          {status.detail && <p>{status.detail}</p>}
        </div>
      </article>
    </section>
  );
}
