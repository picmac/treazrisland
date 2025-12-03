'use client';

import { use, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Route } from '@/types/route';
import { useRouter } from 'next/navigation';

import { exchangeMagicLinkToken } from '@/lib/apiClient';
import { storeAccessToken } from '@/lib/authTokens';
import { PixellabNavigation } from '@/components/chrome';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { StatusPill } from '@/components/ui/StatusPill';
import styles from './page.module.css';

type MagicLinkPageProps = {
  params: { token: string } | Promise<{ token: string }>;
};

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
  const resolvedParams =
    params && typeof (params as Promise<{ token: string }>).then === 'function'
      ? use(params as Promise<{ token: string }>)
      : (params as { token: string });
  const token = useMemo(() => {
    if (typeof resolvedParams?.token === 'string' && resolvedParams.token.trim().length > 0) {
      return resolvedParams.token.trim();
    }
    const lastSegment =
      typeof window !== 'undefined'
        ? window.location.pathname.split('/').filter(Boolean).pop()
        : '';
    return lastSegment ?? '';
  }, [resolvedParams.token]);
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

  const statusTone =
    status.state === 'success' ? 'success' : status.state === 'error' ? 'danger' : 'info';

  return (
    <div className="page-shell">
      <PixellabNavigation
        links={[
          { href: '/library', label: 'Library' },
          { href: '/onboarding', label: 'Onboarding' },
          { href: '/login', label: 'Crew login' },
        ]}
        eyebrow="Magic link verification"
        description="Secure docking flow for one-time links and invite tokens."
      />
      <main className="page-content" id="main-content">
        <section className={styles.page} aria-label="Magic link redemption">
          <div className={styles.hero}>
            <p className="eyebrow">Secure docking</p>
            <h1>Redeeming your magic link</h1>
            <p className="lede">
              We&apos;re confirming token <strong>{token}</strong> so you can jump straight into the
              library.
            </p>
            <div className={styles.statusRow}>
              <StatusPill tone={statusTone}>
                {status.state === 'loading'
                  ? 'Verifying token'
                  : status.state === 'success'
                    ? 'Accepted'
                    : 'Needs attention'}
              </StatusPill>
              <StatusPill tone="info">Redirects to /library after success</StatusPill>
            </div>
          </div>

          <Card
            as="article"
            className={styles.card}
            title="Magic link status"
            description="Verifications typically complete in a few seconds. Retry if the token expired."
          >
            <div className={styles.statusRow} role="status" aria-live="polite">
              <StatusPill tone={statusTone}>{status.message}</StatusPill>
              {status.detail && <StatusPill tone="info">{status.detail}</StatusPill>}
            </div>
            <Button
              type="button"
              onClick={() => void redeemMagicLink()}
              loading={status.state === 'loading'}
            >
              {status.state === 'loading' ? 'Verifying…' : 'Retry verification'}
            </Button>
          </Card>
        </section>
      </main>
    </div>
  );
}
