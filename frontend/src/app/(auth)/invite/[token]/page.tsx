'use client';

import { use } from 'react';
import type { Route } from '@/types/route';
import { useRouter } from 'next/navigation';

import AuthInviteForm from '@/components/forms/AuthInviteForm';
import { storeAccessToken } from '@/lib/authTokens';
import type { InviteRedemptionResponse } from '@/lib/apiClient';
import { PixellabNavigation } from '@/components/chrome';
import { Card } from '@/components/ui/Card';
import { StatusPill } from '@/components/ui/StatusPill';
import styles from './page.module.css';

type InvitePageProps = {
  params: { token: string } | Promise<{ token: string }>;
};

export default function InvitePage({ params }: InvitePageProps) {
  const router = useRouter();
  const resolvedParams =
    params && typeof (params as Promise<{ token: string }>).then === 'function'
      ? use(params as Promise<{ token: string }>)
      : (params as { token: string });
  const token = resolvedParams?.token ?? '';

  const handleSuccess = (response: InviteRedemptionResponse) => {
    if (response.accessToken) {
      storeAccessToken(response.accessToken);
    }

    // Push the player into the library immediately after redemption.
    router.replace('/library' as Route);
    if (typeof window !== 'undefined') {
      window.location.assign('/library');
    }
  };

  return (
    <div className="page-shell">
      <PixellabNavigation
        links={[
          { href: '/library', label: 'Library' },
          { href: '/onboarding', label: 'Onboarding' },
          { href: '/login', label: 'Crew login' },
        ]}
        eyebrow="Invite redemption"
        description="Unlock your Treazr Island profile with a single-use invite code."
      />
      <main className="page-content" id="main-content">
        <section className={styles.page} aria-label="Invitation redemption">
          <div className={styles.hero}>
            <p className="eyebrow">Invitation detected</p>
            <h1>Unlock your Treazr Island profile</h1>
            <p className="lede">
              Token <strong>{token}</strong> is ready to be redeemed. Provide your contact info and
              a secure password to activate your account.
            </p>
            <div className={styles.statusRow}>
              <StatusPill tone="info">Single-use code</StatusPill>
              <StatusPill tone="warning">Expires if unused</StatusPill>
              <StatusPill tone="success">Redirects to library on success</StatusPill>
            </div>
          </div>

          <Card
            as="article"
            className={styles.card}
            title="Set up your credentials"
            description="Enter the invite email and a strong password to activate your account."
          >
            <AuthInviteForm token={token} onSuccess={handleSuccess} />
          </Card>
        </section>
      </main>
    </div>
  );
}
