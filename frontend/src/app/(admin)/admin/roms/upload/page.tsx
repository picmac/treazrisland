'use client';

import NextLink from 'next/link';
import { useCallback, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type React from 'react';

import {
  directRomUpload,
  registerAdminRom,
  reportRomUploadFailure,
  requestRomUploadGrant,
  verifyRomUpload,
  type AdminRomUploadPayload,
} from '@/lib/admin';

import styles from './page.module.css';

type RomUploadStage =
  | 'idle'
  | 'computing'
  | 'ready'
  | 'uploading'
  | 'verifying'
  | 'registering'
  | 'redirecting'
  | 'error';

const Link = NextLink as unknown as React.FC<React.ComponentProps<typeof NextLink>>;

const toHex = (hashBuffer: ArrayBuffer) =>
  Array.from(new Uint8Array(hashBuffer))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');

async function computeSha256(file: File, onProgress: (percent: number) => void): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onprogress = (event) => {
      if (event.lengthComputable && event.total > 0) {
        const percent = Math.min(100, Math.round((event.loaded / event.total) * 100));
        onProgress(percent);
      }
    };

    reader.onerror = () => reject(new Error('Unable to read file for checksum'));

    reader.onload = async () => {
      try {
        const buffer = reader.result as ArrayBuffer;
        const hash = await crypto.subtle.digest('SHA-256', buffer);
        resolve(toHex(hash));
      } catch (error) {
        reject(error instanceof Error ? error : new Error('Failed to compute checksum'));
      }
    };

    reader.readAsArrayBuffer(file);
  });
}

const splitGenres = (value: string) =>
  value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);

const MAX_DIRECT_UPLOAD_BYTES = 50 * 1024 * 1024;

export default function AdminRomUploadPage() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [platform, setPlatform] = useState('');
  const [releaseYear, setReleaseYear] = useState('');
  const [genres, setGenres] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [checksum, setChecksum] = useState<string | null>(null);
  const [checksumProgress, setChecksumProgress] = useState(0);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [stage, setStage] = useState<RomUploadStage>('idle');
  const [statusMessage, setStatusMessage] = useState('Drop your ROM to begin…');
  const [error, setError] = useState<string | null>(null);
  const [optimisticRomId, setOptimisticRomId] = useState<string | null>(null);

  const contentType = useMemo(() => file?.type || 'application/octet-stream', [file?.type]);

  const resetForm = useCallback(() => {
    setTitle('');
    setDescription('');
    setPlatform('');
    setReleaseYear('');
    setGenres('');
    setFile(null);
    setChecksum(null);
    setChecksumProgress(0);
    setUploadProgress(0);
    setStage('idle');
    setError(null);
    setStatusMessage('Drop your ROM to begin…');
    setOptimisticRomId(null);
  }, []);

  const handleFileSelection = useCallback(async (selected: File | null) => {
    setFile(selected);
    setChecksum(null);
    setChecksumProgress(0);
    setUploadProgress(0);
    setError(null);

    if (!selected) {
      setStage('idle');
      setStatusMessage('Drop your ROM to begin…');
      return;
    }

    setStage('computing');
    setStatusMessage('Computing SHA-256 checksum…');

    try {
      const hash = await computeSha256(selected, setChecksumProgress);
      setChecksumProgress(100);
      setChecksum(hash);
      setStage('ready');
      setStatusMessage('Checksum locked. Ready to upload.');
    } catch (checksumError) {
      const message =
        checksumError instanceof Error ? checksumError.message : 'Unable to calculate checksum';
      setError(message);
      setStage('error');
    }
  }, []);

  const uploadRom = useCallback(
    async (payload: AdminRomUploadPayload, binary: File) => {
      setStage('uploading');
      setStatusMessage('Requesting upload slot…');

      let objectKey = '';

      try {
        const grant = await requestRomUploadGrant({
          filename: binary.name,
          contentType,
          size: binary.size,
          checksum: payload.asset.checksum,
        });

        objectKey = grant.objectKey;
        payload.asset.objectKey = grant.objectKey;
        setUploadProgress(20);
        setStatusMessage('Streaming ROM to storage…');

        const attemptDirectFallback = async (): Promise<string> => {
          if (binary.size > MAX_DIRECT_UPLOAD_BYTES) {
            throw new Error('Upload failed and fallback is unavailable for files over 50MB.');
          }

          setStatusMessage('Upload failed; attempting direct fallback…');
          const buffer = await binary.arrayBuffer();
          const base64 = btoa(String.fromCharCode(...Array.from(new Uint8Array(buffer))));
          const directResponse = await directRomUpload({
            filename: binary.name,
            contentType,
            checksum: payload.asset.checksum,
            size: binary.size,
            data: base64,
          });

          return directResponse.objectKey;
        };

        const response = await fetch(grant.uploadUrl, {
          method: 'PUT',
          headers: grant.headers,
          body: binary,
        });

        setUploadProgress(80);

        if (!response.ok) {
          objectKey = await attemptDirectFallback();
        }

        if (objectKey !== grant.objectKey) {
          payload.asset.objectKey = objectKey;
        }

        setStage('verifying');
        setStatusMessage('Verifying checksum against storage…');

        const verification = await verifyRomUpload({
          objectKey: payload.asset.objectKey,
          checksum: payload.asset.checksum,
        });

        if (!verification.valid) {
          throw new Error('Checksum verification failed in storage.');
        }

        setUploadProgress(100);
        setStage('registering');
        setStatusMessage('Persisting ROM metadata…');

        const romResponse = await registerAdminRom(payload);
        setOptimisticRomId(romResponse.rom.id);
        setStage('redirecting');
        setStatusMessage('Upload complete. Redirecting to dossier…');

        return romResponse.rom.id;
      } catch (uploadError) {
        if (objectKey) {
          void reportRomUploadFailure({
            objectKey,
            reason: uploadError instanceof Error ? uploadError.message : 'unknown-error',
          });
        }

        throw uploadError;
      }
    },
    [contentType],
  );

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (!file || !checksum) {
      setError('Select a ROM file and wait for checksum to finish.');
      return;
    }

    const numericYear = releaseYear ? Number.parseInt(releaseYear, 10) : undefined;
    const payload: AdminRomUploadPayload = {
      title: title || file.name,
      description: description || undefined,
      platformId: platform || 'unknown-platform',
      releaseYear: Number.isNaN(numericYear) ? undefined : numericYear,
      genres: splitGenres(genres),
      asset: {
        type: 'ROM',
        filename: file.name,
        contentType,
        checksum,
        objectKey: '',
        size: file.size,
      },
    };

    try {
      const romId = await uploadRom(payload, file);
      const destination = `/rom/${romId}`;
      router.push(destination);
    } catch (uploadError) {
      const message =
        uploadError instanceof Error ? uploadError.message : 'Unable to upload ROM right now';
      setError(message);
      setStage('error');
      setStatusMessage('Upload paused. Review the error message below.');
    }
  };

  return (
    <div className={styles.shell}>
      <div className={styles.marquee}>
        <div>
          <p className="eyebrow">Admin console</p>
          <h1>16-bit ROM uplink</h1>
          <p className={styles.lead}>
            Drag a payload into the uplink bay, verify its checksum, and persist metadata without
            blocking the admin API.
          </p>
        </div>
        <div className={styles.actions}>
          <Link href="/admin/onboarding" className={styles.secondary}>
            Back to onboarding
          </Link>
          <Link href="/library" className={styles.secondary}>
            View public library
          </Link>
        </div>
      </div>

      <section className={styles.panel}>
        <header className={styles.panelHeader}>
          <div>
            <p className="eyebrow">ROM payload</p>
            <h2>Upload details</h2>
          </div>
          <p
            className={styles.status}
            role="status"
            aria-live="polite"
            data-testid="rom-upload-status"
          >
            {statusMessage}
          </p>
        </header>

        <form className={styles.form} onSubmit={onSubmit}>
          <div
            className={styles.dropzone}
            onDragOver={(event) => {
              event.preventDefault();
            }}
            onDrop={(event) => {
              event.preventDefault();
              const [dropped] = Array.from(event.dataTransfer.files ?? []);
              void handleFileSelection(dropped ?? null);
            }}
            role="button"
            tabIndex={0}
            data-testid="rom-dropzone"
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                const input = document.getElementById('rom-file');
                input?.click();
              }
            }}
          >
            <div className={styles.dropInner}>
              <p className={styles.dropLabel}>Drop ROM file or click to browse</p>
              <p className={styles.helper}>Accepts .zip, .nes, .sfc, .smc, and .bin up to 50MB.</p>
              <input
                id="rom-file"
                name="rom-file"
                type="file"
                accept=".zip,.nes,.sfc,.bin,.smc"
                className={styles.hiddenInput}
                aria-label="ROM file"
                onChange={(event) => {
                  const [selected] = Array.from(event.target.files ?? []);
                  void handleFileSelection(selected ?? null);
                }}
              />
              {file && (
                <div className={styles.fileBadge}>
                  <span>{file.name}</span>
                  <span>{Math.round(file.size / 1024)} KB</span>
                </div>
              )}
            </div>
          </div>

          <div className={styles.progressGrid}>
            <div>
              <p className={styles.progressLabel}>Checksum</p>
              <progress
                className={styles.progress}
                max={100}
                value={checksum ? 100 : checksumProgress}
                aria-valuetext={checksum ? 'Checksum ready' : `${checksumProgress}% complete`}
              />
              {checksum && <p className={styles.code}>{checksum}</p>}
            </div>
            <div>
              <p className={styles.progressLabel}>Upload</p>
              <progress
                className={styles.progress}
                max={100}
                value={uploadProgress}
                aria-valuetext={`${uploadProgress}% uploaded`}
              />
            </div>
          </div>

          <div className={styles.fieldGrid}>
            <label className={styles.field}>
              <span>Title</span>
              <input
                id="rom-title"
                name="rom-title"
                type="text"
                placeholder="Super Treasure Hunt"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                required
              />
            </label>
            <label className={styles.field}>
              <span>Platform</span>
              <input
                id="rom-platform"
                name="rom-platform"
                type="text"
                placeholder="snes"
                value={platform}
                onChange={(event) => setPlatform(event.target.value)}
                required
              />
            </label>
            <label className={styles.field}>
              <span>Release year</span>
              <input
                id="rom-year"
                name="rom-year"
                type="number"
                min="1950"
                max={new Date().getFullYear()}
                placeholder="1993"
                value={releaseYear}
                onChange={(event) => setReleaseYear(event.target.value)}
              />
            </label>
            <label className={styles.field}>
              <span>Genres</span>
              <input
                id="rom-genres"
                name="rom-genres"
                type="text"
                placeholder="action, prototype"
                value={genres}
                onChange={(event) => setGenres(event.target.value)}
              />
              <p className={styles.helper}>Comma-separated list. We normalize casing for you.</p>
            </label>
          </div>

          <label className={styles.field}>
            <span>Description</span>
            <textarea
              id="rom-description"
              name="rom-description"
              rows={3}
              placeholder="Add QA notes, controller quirks, or ESRB guidance."
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </label>

          {error && (
            <div className={styles.error} role="alert">
              {error}
            </div>
          )}

          <div className={styles.ctaRow}>
            <button
              type="submit"
              disabled={
                !file ||
                !checksum ||
                stage === 'uploading' ||
                stage === 'registering' ||
                stage === 'redirecting' ||
                stage === 'verifying'
              }
            >
              {stage === 'uploading'
                ? 'Uploading…'
                : stage === 'registering'
                  ? 'Finalizing…'
                  : stage === 'verifying'
                    ? 'Verifying…'
                    : 'Create ROM'}
            </button>
            <button type="button" className={styles.secondary} onClick={resetForm}>
              Reset form
            </button>
          </div>
        </form>
      </section>

      <section className={styles.panel} aria-live="polite">
        <header className={styles.panelHeader}>
          <div>
            <p className="eyebrow">Optimistic dossier</p>
            <h2>Preview</h2>
          </div>
        </header>
        <div className={styles.previewGrid}>
          <div>
            <p className={styles.previewLabel}>Title</p>
            <p className={styles.previewValue}>{title || file?.name || 'Untitled ROM'}</p>
          </div>
          <div>
            <p className={styles.previewLabel}>Platform</p>
            <p className={styles.previewValue}>{platform || 'pending-platform'}</p>
          </div>
          <div>
            <p className={styles.previewLabel}>Release year</p>
            <p className={styles.previewValue}>{releaseYear || 'TBD'}</p>
          </div>
          <div>
            <p className={styles.previewLabel}>Genres</p>
            <p className={styles.previewValue}>
              {genres ? splitGenres(genres).join(', ') : 'No genres captured yet'}
            </p>
          </div>
          <div className={styles.previewSpan}>
            <p className={styles.previewLabel}>Checksum</p>
            <p className={styles.previewValue}>{checksum ?? 'Computing…'}</p>
          </div>
          <div className={styles.previewSpan}>
            <p className={styles.previewLabel}>Upload state</p>
            <p className={styles.previewValue}>
              {stage === 'redirecting' && optimisticRomId
                ? 'Redirecting to dossier…'
                : statusMessage}
            </p>
            {optimisticRomId && (
              <Link
                href={{ pathname: '/rom/[id]', query: { id: optimisticRomId } }}
                className={styles.secondary}
              >
                Open ROM detail
              </Link>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
