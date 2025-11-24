import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi, type Mock } from 'vitest';

import { useAvatarUpload } from './useAvatarUpload';
import { requestAvatarUploadGrant } from '@/lib/users';

global.URL.createObjectURL = vi.fn(() => 'blob:preview-url');

vi.mock('@/lib/users', () => ({
  requestAvatarUploadGrant: vi.fn(),
}));

describe('useAvatarUpload', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('requests a signed URL and uploads the avatar file', async () => {
    const file = new File(['avatar'], 'avatar.png', { type: 'image/png' });
    (requestAvatarUploadGrant as unknown as Mock).mockResolvedValue({
      uploadUrl: 'https://upload.example.com',
      objectKey: 'avatars/user/avatar.png',
      headers: { 'X-Test': 'true' },
    });
    global.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200 }) as unknown as typeof fetch;

    const { result } = renderHook(() => useAvatarUpload());
    let uploadResult: {
      objectKey: string;
      previewUrl: string;
      contentType: string;
      size: number;
    } | null = null;

    await act(async () => {
      uploadResult = await result.current.uploadAvatar(file);
    });

    expect(uploadResult).toEqual({
      objectKey: 'avatars/user/avatar.png',
      previewUrl: 'blob:preview-url',
      contentType: 'image/png',
      size: file.size,
    });

    expect(requestAvatarUploadGrant).toHaveBeenCalledWith({
      filename: 'avatar.png',
      contentType: 'image/png',
      size: file.size,
    });

    expect(global.fetch).toHaveBeenCalledWith('https://upload.example.com', {
      method: 'PUT',
      headers: { 'Content-Type': 'image/png', 'X-Test': 'true' },
      body: file,
    });

    await waitFor(() => {
      expect(result.current.isUploading).toBe(false);
      expect(result.current.error).toBeNull();
    });
  });

  it('returns an error when the upload fails', async () => {
    const file = new File(['avatar'], 'avatar.png', { type: 'image/png' });
    (requestAvatarUploadGrant as unknown as Mock).mockResolvedValue({
      uploadUrl: 'https://upload.example.com',
      objectKey: 'avatars/user/avatar.png',
      headers: {},
    });
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500 }) as unknown as typeof fetch;

    const { result } = renderHook(() => useAvatarUpload());

    let thrown: unknown;
    await act(async () => {
      try {
        await result.current.uploadAvatar(file);
      } catch (error) {
        thrown = error;
      }
    });

    expect(thrown).toBeInstanceOf(Error);
    expect((thrown as Error).message).toBe('Unable to upload avatar to storage');
    await waitFor(() => {
      expect(result.current.error).toBe('Unable to upload avatar to storage');
    });
  });
});
