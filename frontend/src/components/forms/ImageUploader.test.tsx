import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';

import ImageUploader from './ImageUploader';
import { useAvatarUpload } from '@/hooks/useAvatarUpload';

vi.mock('@/hooks/useAvatarUpload');

global.URL.createObjectURL = vi.fn(() => 'blob:preview');
global.URL.revokeObjectURL = vi.fn();

describe('ImageUploader', () => {
  const mockUpload = vi.fn();
  const mockReset = vi.fn();

  beforeEach(() => {
    (useAvatarUpload as unknown as Mock).mockReturnValue({
      uploadAvatar: mockUpload,
      isUploading: false,
      error: null,
      reset: mockReset,
    });
    mockUpload.mockReset();
    mockReset.mockReset();
  });

  it('uploads a dropped image and renders the preview', async () => {
    const onUploaded = vi.fn();
    mockUpload.mockResolvedValue({
      objectKey: 'avatars/user/avatar.png',
      previewUrl: 'blob:preview',
    });

    render(<ImageUploader label="Avatar" onUploaded={onUploaded} />);

    const dropzone = screen.getByRole('button', { name: /avatar uploader/i });
    const file = new File(['avatar'], 'avatar.png', { type: 'image/png' });
    fireEvent.drop(dropzone, { dataTransfer: { files: [file] } });

    await waitFor(() => {
      expect(onUploaded).toHaveBeenCalledWith({
        objectKey: 'avatars/user/avatar.png',
        previewUrl: 'blob:preview',
      });
    });

    expect(screen.getByAltText(/profile avatar preview/i)).toHaveAttribute('src', 'blob:preview');
    expect(mockReset).toHaveBeenCalled();
  });

  it('shows an error when upload fails', async () => {
    mockUpload.mockRejectedValue(new Error('upload failed'));

    render(<ImageUploader label="Avatar" />);

    const dropzone = screen.getByRole('button', { name: /avatar uploader/i });
    const file = new File(['avatar'], 'avatar.png', { type: 'image/png' });
    fireEvent.drop(dropzone, { dataTransfer: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('upload failed');
    });
  });
});
