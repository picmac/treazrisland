'use client';

/* eslint-disable @next/next/no-img-element */

import { useEffect, useId, useRef, useState } from 'react';
import type { DragEventHandler } from 'react';

import { useAvatarUpload } from '@/hooks/useAvatarUpload';

interface ImageUploaderProps {
  label: string;
  helperText?: string;
  initialPreviewUrl?: string | null;
  onUploaded?: (result: { objectKey: string; previewUrl: string }) => void;
  disabled?: boolean;
}

export function ImageUploader({
  label,
  helperText,
  initialPreviewUrl,
  onUploaded,
  disabled = false,
}: ImageUploaderProps) {
  const inputId = useId();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(initialPreviewUrl ?? null);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const { uploadAvatar, isUploading, error: uploadError, reset } = useAvatarUpload();

  useEffect(() => {
    return () => {
      if (previewUrl?.startsWith('blob:')) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const handleFiles = async (files: FileList | null | undefined) => {
    if (!files || files.length === 0 || disabled || isUploading) {
      return;
    }

    reset();
    setError(null);
    const [file] = Array.from(files);

    try {
      const result = await uploadAvatar(file);
      setPreviewUrl((current) => {
        if (current?.startsWith('blob:')) {
          URL.revokeObjectURL(current);
        }
        return result.previewUrl;
      });
      onUploaded?.(result);
    } catch (uploadFailure) {
      const message =
        uploadFailure instanceof Error ? uploadFailure.message : 'Failed to upload avatar image';
      setError(message);
    }
  };

  const onDrop: DragEventHandler<HTMLDivElement> = (event) => {
    event.preventDefault();
    setIsDragging(false);
    void handleFiles(event.dataTransfer?.files);
  };

  const onDragOver: DragEventHandler<HTMLDivElement> = (event) => {
    event.preventDefault();
    setIsDragging(true);
  };

  const onDragLeave: DragEventHandler<HTMLDivElement> = (event) => {
    event.preventDefault();
    setIsDragging(false);
  };

  const openFilePicker = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="image-uploader">
      <label htmlFor={inputId} className="image-uploader__label">
        {label}
      </label>
      <div
        className={`image-uploader__dropzone${isDragging ? ' is-dragging' : ''}${isUploading ? ' is-uploading' : ''}`}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        role="button"
        aria-label={`${label} uploader`}
        tabIndex={0}
        onClick={openFilePicker}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            openFilePicker();
          }
        }}
        aria-disabled={disabled || isUploading}
      >
        <input
          id={inputId}
          ref={fileInputRef}
          type="file"
          accept="image/*"
          aria-label={label}
          className="image-uploader__input"
          onChange={(event) => void handleFiles(event.target.files)}
          disabled={disabled || isUploading}
        />
        {previewUrl ? (
          <img src={previewUrl} alt="Profile avatar preview" className="image-uploader__preview" />
        ) : (
          <div className="image-uploader__placeholder">
            <p>Drop an image or click to upload</p>
            <p className="image-uploader__hint">PNG, JPG, or GIF up to 10MB.</p>
          </div>
        )}
      </div>
      {helperText && <p className="image-uploader__helper">{helperText}</p>}
      {(error || uploadError) && (
        <p className="image-uploader__error" role="alert">
          {error ?? uploadError}
        </p>
      )}
      {isUploading && <p className="image-uploader__status">Uploading avatar…</p>}
    </div>
  );
}

export default ImageUploader;
