'use client';

import { useCallback, useState } from 'react';

import { ApiError } from '@/lib/apiClient';
import { requestAvatarUploadGrant } from '@/lib/users';

export interface AvatarUploadResult {
  objectKey: string;
  previewUrl: string;
}

const buildPreviewUrl = (file: File): string => URL.createObjectURL(file);

export function useAvatarUpload() {
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const uploadAvatar = useCallback(async (file: File): Promise<AvatarUploadResult> => {
    setIsUploading(true);
    setError(null);

    try {
      const grant = await requestAvatarUploadGrant({
        filename: file.name,
        contentType: file.type || 'application/octet-stream',
        size: file.size,
      });

      const uploadResponse = await fetch(grant.uploadUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': file.type || 'application/octet-stream',
          ...(grant.headers ?? {}),
        },
        body: file,
      });

      if (!uploadResponse.ok) {
        throw new ApiError('Unable to upload avatar to storage', uploadResponse.status);
      }

      return {
        objectKey: grant.objectKey,
        previewUrl: buildPreviewUrl(file),
      };
    } catch (uploadError) {
      const message =
        uploadError instanceof Error ? uploadError.message : 'Failed to upload avatar';
      setError(message);
      throw uploadError instanceof Error ? uploadError : new Error(message);
    } finally {
      setIsUploading(false);
    }
  }, []);

  const reset = useCallback(() => setError(null), []);

  return { uploadAvatar, isUploading, error, reset };
}
