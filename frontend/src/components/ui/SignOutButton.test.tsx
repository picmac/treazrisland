import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  AppRouterContext,
  type AppRouterInstance,
} from 'next/dist/shared/lib/app-router-context.shared-runtime';

import { logout } from '@/lib/apiClient';
import { clearStoredAccessToken } from '@/lib/authTokens';
import { SignOutButton } from './SignOutButton';

vi.mock('@/lib/apiClient', () => ({
  logout: vi.fn(),
}));

vi.mock('@/lib/authTokens', () => ({
  clearStoredAccessToken: vi.fn(),
}));

const routerMock: AppRouterInstance = {
  back: vi.fn(),
  forward: vi.fn(),
  refresh: vi.fn(),
  push: vi.fn(),
  replace: vi.fn(),
  prefetch: vi.fn(),
};

const renderWithRouter = (ui = <SignOutButton />) =>
  render(<AppRouterContext.Provider value={routerMock}>{ui}</AppRouterContext.Provider>);

describe('SignOutButton', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls logout and clears stored token', async () => {
    vi.mocked(logout).mockResolvedValueOnce();

    renderWithRouter();

    fireEvent.click(screen.getByRole('button', { name: /sign out/i }));

    await waitFor(() => expect(logout).toHaveBeenCalled());
    expect(clearStoredAccessToken).toHaveBeenCalled();
    expect(routerMock.push).toHaveBeenCalledWith('/login');
  });

  it('shows retry copy when logout fails', async () => {
    vi.mocked(logout).mockRejectedValueOnce(new Error('network'));

    renderWithRouter(<SignOutButton label="Logout" />);

    fireEvent.click(screen.getByRole('button', { name: /logout/i }));

    await waitFor(() => expect(screen.getByRole('button')).toHaveTextContent(/retry/i));
    expect(clearStoredAccessToken).toHaveBeenCalled();
    expect(routerMock.push).toHaveBeenCalledWith('/login');
  });
});
