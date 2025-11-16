'use client';

import { useCallback, useState } from 'react';

import { ApiError } from '@/lib/apiClient';
import { registerAdminRom, type AdminRomUploadResponse } from '@/lib/admin';

export interface RomUploadInput {
  title: string;
  description?: string;
  platformId: string;
  releaseYear?: number;
  file: File;
}

const arrayBufferToBase64 = (buffer: ArrayBuffer): string => {
  const bytes = new Uint8Array(buffer);
  let binary = '';

  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });

  return btoa(binary);
};

const arrayBufferToHex = (buffer: ArrayBuffer): string => {
  const bytes = new Uint8Array(buffer);
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
};

const buildAssetPayload = async (file: File) => {
  const buffer = await file.arrayBuffer();
  const digest = await crypto.subtle.digest('SHA-256', buffer);
  const checksum = arrayBufferToHex(digest);

  return {
    type: 'ROM' as const,
    filename: file.name,
    contentType: file.type || 'application/octet-stream',
    data: arrayBufferToBase64(buffer),
    checksum,
  };
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
        const asset = await buildAssetPayload(input.file);
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
