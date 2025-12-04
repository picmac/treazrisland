import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import LoginPage from './page';
import { loginWithPassword } from '@/lib/apiClient';
import { storeAccessToken } from '@/lib/authTokens';

vi.mock('@/lib/apiClient', () => ({
  loginWithPassword: vi.fn(),
  exchangeMagicLinkToken: vi.fn(),
}));

vi.mock('@/lib/authTokens', () => ({
  storeAccessToken: vi.fn(),
}));

const push = vi.fn();
const prefetch = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, prefetch }),
  useSearchParams: () => new URLSearchParams(),
}));

describe('LoginPage', () => {
  const fetchMock = vi.fn();
  const mockedLogin = vi.mocked(loginWithPassword);
  const mockedStore = vi.mocked(storeAccessToken);

  beforeEach(() => {
    fetchMock.mockReset();
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ status: 'ok' }) });
    vi.stubGlobal('fetch', fetchMock);
    mockedLogin.mockReset();
    mockedStore.mockReset();
    push.mockReset();
    prefetch.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('logs in with password and caches the issued access token', async () => {
    mockedLogin.mockResolvedValue({
      accessToken: 'token-abc',
      user: { id: 'user-1', email: 'captain@example.com' },
    });

    const user = userEvent.setup();

    render(<LoginPage />);

    await user.type(screen.getByLabelText('Email'), 'captain@example.com');
    await user.type(screen.getByLabelText('Password'), 'SuperSecret1!');
    await user.click(screen.getByRole('button', { name: 'Log in' }));

    await waitFor(() =>
      expect(mockedLogin).toHaveBeenCalledWith('captain@example.com', 'SuperSecret1!'),
    );
    expect(mockedStore).toHaveBeenCalledWith('token-abc');
    await waitFor(() => expect(push).toHaveBeenCalledWith('/onboarding'));
  });

  it('surfaces the http-only session cookie guidance', async () => {
    render(<LoginPage />);

    expect(
      await screen.findByText(/HTTP-only cookies; sign out clears them instantly/i),
    ).toBeVisible();
  });
});
