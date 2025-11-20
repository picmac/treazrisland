'use client';

import { useCallback, useState } from 'react';

import { ApiError } from '@/lib/apiClient';
import { registerAdminRom, requestRomUploadGrant, type AdminRomUploadResponse } from '@/lib/admin';

export interface RomUploadInput {
  title: string;
  description?: string;
  platformId: string;
  releaseYear?: number;
  file: File;
}

const arrayBufferToHex = (buffer: ArrayBuffer): string => {
  const bytes = new Uint8Array(buffer);
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
};

const normalizeContentType = (contentType: string) => contentType || 'application/octet-stream';

const uploadRomAsset = async (file: File) => {
  const buffer = await file.arrayBuffer();
  const digest = await crypto.subtle.digest('SHA-256', buffer);
  const checksum = arrayBufferToHex(digest);
  const size = buffer.byteLength;
  const contentType = normalizeContentType(file.type);

  const grant = await requestRomUploadGrant({
    filename: file.name,
    contentType,
    size,
    checksum,
  });

  const uploadHeaders = {
    'Content-Type': contentType,
    'x-amz-meta-checksum': checksum,
    'x-amz-meta-size': size.toString(),
    ...(grant.headers ?? {}),
  } as Record<string, string>;

  const response = await fetch(grant.uploadUrl, {
    method: 'PUT',
    headers: uploadHeaders,
    body: buffer,
  });

  if (!response.ok) {
    throw new Error('Failed to upload ROM asset');
  }

  return {
    type: 'ROM' as const,
    filename: file.name,
    contentType,
    checksum,
    objectKey: grant.objectKey,
    size,
  } as const;
};

export function useRomUpload() {
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AdminRomUploadResponse['rom'] | null>(null);

  const uploadRom = useCallback(
    async (input: RomUploadInput): Promise<AdminRomUploadResponse['rom']> => {
      setIsUploading(true);
      setError(null);

      try {
        const asset = await uploadRomAsset(input.file);
        const response = await registerAdminRom({
          title: input.title,
          description: input.description,
          platformId: input.platformId,
          releaseYear: input.releaseYear,
          asset,
        });

        setResult(response.rom);
        return response.rom;
      } catch (uploadError) {
        const message =
          uploadError instanceof ApiError ? uploadError.message : 'Failed to upload ROM';
        setError(message);
        throw uploadError instanceof Error ? uploadError : new Error(message);
      } finally {
        setIsUploading(false);
      }
    },
    [],
  );

  const reset = useCallback(() => {
    setError(null);
    setResult(null);
  }, []);

  return { uploadRom, isUploading, error, result, reset };
}
