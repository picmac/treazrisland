import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import AuthInviteForm from './AuthInviteForm';
import { redeemInviteToken } from '@/lib/apiClient';
import type { InviteRedemptionResponse } from '@/lib/apiClient';

vi.mock('@/lib/apiClient', () => ({
  redeemInviteToken: vi.fn(),
}));

describe('AuthInviteForm', () => {
  const mockedRedeem = vi.mocked(redeemInviteToken);
  const token = 'invite-code-123';

  beforeEach(() => {
    mockedRedeem.mockReset();
  });

  it('submits invite details and forwards the API response to the caller', async () => {
    const user = userEvent.setup();
    const onSuccess = vi.fn();
    const response: InviteRedemptionResponse = {
      accessToken: 'token-123',
      message: 'Invite redeemed',
      user: { id: 'user-1', email: 'player@example.com' },
    };

    mockedRedeem.mockResolvedValue(response);

    render(<AuthInviteForm token={token} onSuccess={onSuccess} />);

    await user.type(screen.getByLabelText('Email'), 'player@example.com');
    await user.type(screen.getByLabelText('Display name (optional)'), 'Deckhand Nova');
    await user.type(screen.getByLabelText('Password'), 'Password123!');
    await user.type(screen.getByLabelText('Confirm password'), 'Password123!');
    await user.click(screen.getByRole('button', { name: 'Redeem invite' }));

    await waitFor(() => expect(mockedRedeem).toHaveBeenCalled());
    expect(mockedRedeem).toHaveBeenCalledWith(token, {
      email: 'player@example.com',
      password: 'Password123!',
      displayName: 'Deckhand Nova',
    });
    expect(onSuccess).toHaveBeenCalledWith(response);
  });

  it('prevents submission when passwords mismatch', async () => {
    const user = userEvent.setup();
    render(<AuthInviteForm token={token} />);

    await user.type(screen.getByLabelText('Email'), 'deckhand@example.com');
    await user.type(screen.getByLabelText('Password'), 'Password123!');
    await user.type(screen.getByLabelText('Confirm password'), 'Password1234!');
    await user.click(screen.getByRole('button', { name: 'Redeem invite' }));

    expect(await screen.findByText('Passwords must match.')).toBeVisible();
    expect(mockedRedeem).not.toHaveBeenCalled();
  });
});
