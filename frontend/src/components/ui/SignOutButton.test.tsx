import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { logout } from '@/lib/apiClient';
import { clearStoredAccessToken } from '@/lib/authTokens';
import { SignOutButton } from './SignOutButton';

vi.mock('@/lib/apiClient', () => ({
  logout: vi.fn(),
}));

vi.mock('@/lib/authTokens', () => ({
  clearStoredAccessToken: vi.fn(),
}));

describe('SignOutButton', () => {
  it('calls logout and clears stored token', async () => {
    vi.mocked(logout).mockResolvedValueOnce();

    render(<SignOutButton />);

    fireEvent.click(screen.getByRole('button', { name: /sign out/i }));

    await waitFor(() => expect(logout).toHaveBeenCalled());
    expect(clearStoredAccessToken).toHaveBeenCalled();
    expect(screen.getByRole('button')).toHaveTextContent(/signed out/i);
  });

  it('shows retry copy when logout fails', async () => {
    vi.mocked(logout).mockRejectedValueOnce(new Error('network'));

    render(<SignOutButton label="Logout" />);

    fireEvent.click(screen.getByRole('button', { name: /logout/i }));

    await waitFor(() => expect(screen.getByRole('button')).toHaveTextContent(/retry/i));
  });
});
