/* eslint-disable @next/next/no-img-element */
import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi, beforeEach } from 'vitest';

import ProfilePage from './page';
import { getCurrentUserProfile, updateUserProfile } from '@/lib/users';

vi.mock('next/image', () => ({
  __esModule: true,

  default: (props: React.ComponentProps<'img'>) => (
    <img alt={props.alt} src={props.src as string} />
  ),
}));

const uploadAvatarMock = vi.fn();
const resetUploadMock = vi.fn();

vi.mock('@/hooks/useAvatarUpload', () => ({
  useAvatarUpload: vi.fn(() => ({
    uploadAvatar: uploadAvatarMock,
    isUploading: false,
    error: null,
    reset: resetUploadMock,
  })),
}));

vi.mock('@/lib/users', () => ({
  getCurrentUserProfile: vi.fn(),
  updateUserProfile: vi.fn(),
}));

const mockedGetProfile = vi.mocked(getCurrentUserProfile);
const mockedUpdateProfile = vi.mocked(updateUserProfile);

const createQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

const renderWithClient = () => {
  const client = createQueryClient();
  return render(
    <QueryClientProvider client={client}>
      <ProfilePage />
    </QueryClientProvider>,
  );
};

describe('ProfilePage', () => {
  beforeEach(() => {
    uploadAvatarMock.mockReset();
    resetUploadMock.mockReset();
    mockedGetProfile.mockReset();
    mockedUpdateProfile.mockReset();
    mockedGetProfile.mockResolvedValue({
      user: {
        id: 'user-1',
        email: 'player@example.com',
        displayName: 'Player One',
        avatarUrl: null,
        avatarObjectKey: null,
      },
      isProfileComplete: false,
    });
    mockedUpdateProfile.mockResolvedValue({
      user: {
        id: 'user-1',
        email: 'player@example.com',
        displayName: 'Player One',
        avatarUrl: null,
        avatarObjectKey: null,
      },
      isProfileComplete: true,
    });
  });

  it('renders profile info and updates the display name', async () => {
    mockedUpdateProfile.mockResolvedValueOnce({
      user: {
        id: 'user-1',
        email: 'player@example.com',
        displayName: 'Arcade Ace',
        avatarUrl: null,
        avatarObjectKey: null,
      },
      isProfileComplete: true,
    });

    renderWithClient();

    await screen.findByDisplayValue('Player One');

    const input = screen.getByPlaceholderText('Pixel Protagonist');
    fireEvent.change(input, { target: { value: 'Arcade Ace' } });

    const saveButton = screen.getByRole('button', { name: /save changes/i });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(mockedUpdateProfile).toHaveBeenCalledWith(
        { displayName: 'Arcade Ace' },
        expect.anything(),
      );
    });
  });

  it('uploads an avatar and submits metadata', async () => {
    uploadAvatarMock.mockResolvedValue({
      objectKey: 'avatars/user-1/avatar.png',
      previewUrl: 'blob:avatar',
      contentType: 'image/png',
      size: 2048,
    });

    renderWithClient();
    await screen.findByDisplayValue('Player One');

    const fileInput = screen.getByLabelText(/choose image/i) as HTMLInputElement;
    const file = new File(['avatar'], 'avatar.png', { type: 'image/png' });

    await act(async () => {
      fireEvent.change(fileInput, { target: { files: [file] } });
    });

    const saveButton = screen.getByRole('button', { name: /save changes/i });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(mockedUpdateProfile).toHaveBeenCalledWith(
        {
          displayName: 'Player One',
          avatarObjectKey: 'avatars/user-1/avatar.png',
          avatarContentType: 'image/png',
          avatarSize: 2048,
        },
        expect.anything(),
      );
    });
  });
});
