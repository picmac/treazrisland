'use client';

import NextLink from 'next/link';
import { useMemo, useState } from 'react';
import type React from 'react';

const Link = NextLink as unknown as React.FC<React.ComponentProps<typeof NextLink>>;

import {
  directRomUpload,
  registerAdminRom,
  requestRomUploadGrant,
  type AdminRomUploadPayload,
} from '@/lib/admin';
import styles from './page.module.css';

type RomUploadStage =
  | 'idle'
  | 'computing'
  | 'ready'
  | 'uploading'
  | 'registering'
  | 'redirecting'
  | 'error';

const toHex = (hashBuffer: ArrayBuffer) =>
  Array.from(new Uint8Array(hashBuffer))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');

const MINIMUM_CHECKSUM_STAGE_MS = 200;
const MAX_DIRECT_UPLOAD_BYTES = 50 * 1024 * 1024;

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

export default function AdminRomUploadPage() {
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
  const [statusMessage, setStatusMessage] = useState('Waiting for ROM drop…');
  const [error, setError] = useState<string | null>(null);
  const [optimisticRomId, setOptimisticRomId] = useState<string | null>(null);

  const contentType = useMemo(() => file?.type || 'application/octet-stream', [file?.type]);

  const handleFileSelection = async (selected: File | null) => {
    setFile(selected);
    setChecksum(null);
    setChecksumProgress(0);
    setUploadProgress(0);
    setError(null);

    if (!selected) {
      setStage('idle');
      setStatusMessage('Waiting for ROM drop…');
      return;
    }

    setStage('computing');
    setStatusMessage('Computing checksum…');

    try {
      const hash = await computeSha256(selected, setChecksumProgress);
      setChecksumProgress(100);
      await new Promise((resolve) => setTimeout(resolve, MINIMUM_CHECKSUM_STAGE_MS));
      setChecksum(hash);
      setStage('ready');
      setStatusMessage('Checksum locked. Ready to upload.');
    } catch (checksumError) {
      const message =
        checksumError instanceof Error ? checksumError.message : 'Unable to calculate checksum';
      setError(message);
      setStage('error');
    }
  };

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

    setStage('uploading');
    setStatusMessage('Requesting upload grant…');

    try {
      const grant = await requestRomUploadGrant({
        filename: file.name,
        contentType,
        size: file.size,
        checksum,
      });

      setUploadProgress(15);
      setStatusMessage('Uploading ROM to storage…');

      const attemptDirectFallback = async (): Promise<string> => {
        if (file.size > MAX_DIRECT_UPLOAD_BYTES) {
          throw new Error('Upload failed and fallback is unavailable for files over 50MB.');
        }

        setStatusMessage('Upload failed; attempting direct fallback…');
        const buffer = await file.arrayBuffer();
        const base64 = btoa(String.fromCharCode(...Array.from(new Uint8Array(buffer))));
        const directResponse = await directRomUpload({
          filename: file.name,
          contentType,
          checksum,
          size: file.size,
          data: base64,
        });

        return directResponse.objectKey;
      };

      let objectKey = grant.objectKey;

      try {
        const uploadResponse = await fetch(grant.uploadUrl, {
          method: 'PUT',
          headers: grant.headers,
          body: file,
        });

        if (!uploadResponse.ok) {
          objectKey = await attemptDirectFallback();
        }
      } catch {
        objectKey = await attemptDirectFallback();
      }

      setUploadProgress(100);
      setStage('registering');
      setStatusMessage('Registering ROM metadata…');

      const romResponse = await registerAdminRom({
        ...payload,
        asset: {
          ...payload.asset,
          objectKey,
        },
      });

      setOptimisticRomId(romResponse.rom.id);
      setStage('redirecting');
      setStatusMessage('Upload complete. Redirecting to ROM dossier…');
      const destination = `/rom/${romResponse.rom.id}`;
      // Use a hard navigation so the dossier page fully loads for both users and automation.
      window.location.assign(destination);
    } catch (uploadError) {
      const message =
        uploadError instanceof Error ? uploadError.message : 'Unable to upload ROM right now';
      setError(message);
      setStage('error');
      setStatusMessage('Upload paused. Review the error message below.');
    }
  };

  return (
    <div className="pixellab-grid">
      <div className="pixellab-content">
        <div className={styles.layout}>
          <header className={styles.header}>
            <div>
              <p className="eyebrow">Admin console</p>
              <h1>New ROM upload</h1>
              <p className={styles.lead}>
                Compute the checksum in-browser, stream the payload to storage, and register the
                dossier without blocking the admin API.
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
          </header>

          <section className={styles.card} aria-labelledby="rom-upload-form-title">
            <div className={styles.cardHeader}>
              <div>
                <p className="eyebrow">ROM payload</p>
                <h2 id="rom-upload-form-title">Upload details</h2>
              </div>
              <p
                className={styles.status}
                role="status"
                aria-live="polite"
                data-testid="rom-upload-status"
              >
                {statusMessage}
              </p>
            </div>

            <form className={styles.form} onSubmit={onSubmit}>
              <div className={styles.fieldGroup}>
                <label htmlFor="rom-file">ROM file</label>
                <input
                  id="rom-file"
                  name="rom-file"
                  type="file"
                  accept=".zip,.nes,.sfc,.bin,.smc"
                  onChange={(event) => {
                    const [selected] = Array.from(event.target.files ?? []);
                    void handleFileSelection(selected ?? null);
                  }}
                  aria-describedby="rom-file-help"
                  disabled={
                    stage === 'uploading' || stage === 'registering' || stage === 'redirecting'
                  }
                />
                <p id="rom-file-help" className={styles.helper}>
                  EmulatorJS ingests .zip, .nes, .sfc, .smc, and .bin files up to 50MB.
                </p>
                <div className={styles.progressRow}>
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
              </div>

              <div className={styles.fieldGrid}>
                <div className={styles.fieldGroup}>
                  <label htmlFor="rom-title">Title</label>
                  <input
                    id="rom-title"
                    name="rom-title"
                    type="text"
                    placeholder="Super Treasure Hunt"
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    required
                  />
                </div>
                <div className={styles.fieldGroup}>
                  <label htmlFor="rom-platform">Platform</label>
                  <input
                    id="rom-platform"
                    name="rom-platform"
                    type="text"
                    placeholder="snes"
                    value={platform}
                    onChange={(event) => setPlatform(event.target.value)}
                    required
                  />
                </div>
                <div className={styles.fieldGroup}>
                  <label htmlFor="rom-year">Release year</label>
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
                </div>
                <div className={styles.fieldGroup}>
                  <label htmlFor="rom-genres">Genres</label>
                  <input
                    id="rom-genres"
                    name="rom-genres"
                    type="text"
                    placeholder="action, prototype"
                    value={genres}
                    onChange={(event) => setGenres(event.target.value)}
                  />
                  <p className={styles.helper}>
                    Comma-separated list. We normalize casing for you.
                  </p>
                </div>
              </div>

              <div className={styles.fieldGroup}>
                <label htmlFor="rom-description">Description</label>
                <textarea
                  id="rom-description"
                  name="rom-description"
                  rows={3}
                  placeholder="Add QA notes, controller quirks, or ESRB guidance."
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                />
              </div>

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
                    stage === 'redirecting'
                  }
                >
                  {stage === 'uploading'
                    ? 'Uploading…'
                    : stage === 'registering'
                      ? 'Finalizing…'
                      : 'Create ROM'}
                </button>
                <button
                  type="button"
                  className={styles.secondary}
                  onClick={() => {
                    setTitle('');
                    setDescription('');
                    setPlatform('');
                    setReleaseYear('');
                    setGenres('');
                    setFile(null);
                    setChecksum(null);
                    setChecksumProgress(0);
                    setUploadProgress(0);
                    setStatusMessage('Waiting for ROM drop…');
                    setStage('idle');
                    setError(null);
                  }}
                >
                  Reset form
                </button>
              </div>
            </form>
          </section>

          <section className={styles.card} aria-live="polite">
            <div className={styles.cardHeader}>
              <div>
                <p className="eyebrow">Optimistic dossier</p>
                <h2>Preview</h2>
              </div>
            </div>
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
      </div>
    </div>
  );
}
