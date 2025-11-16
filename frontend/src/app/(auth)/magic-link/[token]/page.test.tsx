import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import MagicLinkPage from './page';
import { exchangeMagicLinkToken } from '@/lib/apiClient';
import { storeAccessToken } from '@/lib/authTokens';

vi.mock('@/lib/apiClient', () => ({
  exchangeMagicLinkToken: vi.fn(),
}));

vi.mock('@/lib/authTokens', () => ({
  storeAccessToken: vi.fn(),
}));

const replace = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace }),
}));

describe('MagicLinkPage', () => {
  const mockedExchange = vi.mocked(exchangeMagicLinkToken);
  const mockedStore = vi.mocked(storeAccessToken);

  beforeEach(() => {
    mockedExchange.mockReset();
    mockedStore.mockReset();
    replace.mockReset();
  });

  it('redeems the token on mount and navigates to the library', async () => {
    mockedExchange.mockResolvedValue({
      accessToken: 'token-123',
      user: { id: 'user-1', email: 'deckhand@example.com' },
    });

    render(<MagicLinkPage params={{ token: 'token-123' }} />);

    await waitFor(() => expect(mockedExchange).toHaveBeenCalledWith('token-123'));
    await waitFor(() => expect(mockedStore).toHaveBeenCalledWith('token-123'));
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/library'));
    expect(
      await screen.findByRole('status', { name: /magic link accepted/i, exact: false }),
    ).toBeVisible();
  });

  it('surfaces API failures', async () => {
    mockedExchange.mockRejectedValue(new Error('Magic link expired'));

    render(<MagicLinkPage params={{ token: 'token-404' }} />);

    expect(await screen.findByText('Magic link expired')).toBeVisible();
    expect(replace).not.toHaveBeenCalled();
  });
});
