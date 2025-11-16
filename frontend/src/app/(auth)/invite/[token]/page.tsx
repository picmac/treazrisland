'use client';

import type { Route } from 'next';
import { useRouter } from 'next/navigation';

import AuthInviteForm from '@/components/forms/AuthInviteForm';
import { storeAccessToken } from '@/lib/authTokens';
import type { InviteRedemptionResponse } from '@/lib/apiClient';

interface InvitePageProps {
  params: { token: string };
}

export default function InvitePage({ params }: InvitePageProps) {
  const router = useRouter();
  const { token } = params;

  const handleSuccess = (response: InviteRedemptionResponse) => {
    if (response.accessToken) {
      storeAccessToken(response.accessToken);
    }

    router.replace('/library' as Route);
  };

  return (
    <section aria-label="Invitation redemption" className="auth-section">
      <header>
        <p className="eyebrow">Invitation detected</p>
        <h1>Unlock your Treazr Island profile</h1>
        <p className="lede">
          Token <strong>{token}</strong> is ready to be redeemed. Provide your contact info and a
          secure password to activate your account.
        </p>
      </header>

      <AuthInviteForm token={token} onSuccess={handleSuccess} />
    </section>
  );
}
