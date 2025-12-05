'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { sha256 } from '@noble/hashes/sha256';
import { bytesToHex } from '@noble/hashes/utils';

import {
  directRomUpload,
  registerAdminRom,
  reportRomUploadFailure,
  requestRomUploadGrant,
  verifyRomUpload,
  type AdminRomUploadPayload,
} from '@/lib/admin';
import { PixellabNavigation } from '@/components/chrome';
import { SignOutButton } from '@/components/ui/SignOutButton';
import { Button } from '@/components/ui/Button';

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
        const digest = crypto.subtle?.digest
          ? await crypto.subtle.digest('SHA-256', buffer)
          : sha256(new Uint8Array(buffer));
        const hash = digest instanceof ArrayBuffer ? toHex(digest) : bytesToHex(digest);
        resolve(hash);
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
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
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
  const [statusMessage, setStatusMessage] = useState('Attach a ROM to start the upload.');
  const [error, setError] = useState<string | null>(null);
  const [optimisticRomId, setOptimisticRomId] = useState<string | null>(null);
  const presignedDisabledRef = useRef(false);

  useEffect(() => {
    if (stage !== 'redirecting' || !optimisticRomId) {
      return;
    }

    const destination = `/rom/${optimisticRomId}`;
    router.push(destination);

    const fallback = window.setTimeout(() => {
      if (window.location.pathname !== destination) {
        window.location.assign(destination);
      }
    }, 750);

    return () => {
      window.clearTimeout(fallback);
    };
  }, [optimisticRomId, router, stage]);

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
    setStatusMessage('Attach a ROM to start the upload.');
    setOptimisticRomId(null);
  }, []);

  const openFilePicker = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const disabledReason = useMemo(() => {
    if (!file) {
      return 'Select a ROM file to enable Create ROM.';
    }

    if (!checksum) {
      return 'Checksum must finish before creating the ROM.';
    }

    if (['uploading', 'registering', 'redirecting', 'verifying'].includes(stage)) {
      return 'Upload in progress; please wait…';
    }

    return '';
  }, [checksum, file, stage]);

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
    setStatusMessage('Computing checksum…');

    try {
      const hash = await computeSha256(selected, setChecksumProgress);
      setChecksumProgress(100);
      setChecksum(hash);
      setStage('ready');
      setStatusMessage('Checksum ready. You can upload now.');
    } catch (checksumError) {
      const message =
        checksumError instanceof Error ? checksumError.message : 'Unable to calculate checksum';
      setError(message);
      setStage('error');
    }
  }, []);

  const uploadRom = useCallback(
    async (payload: AdminRomUploadPayload, binary: File) => {
      const presignedUploadsEnabled = process.env.NEXT_PUBLIC_USE_PRESIGNED_UPLOAD === 'true';
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

        const toArrayBuffer = async (blob: Blob): Promise<ArrayBuffer> => {
          if (typeof blob.arrayBuffer === 'function') {
            return blob.arrayBuffer();
          }
          const response = await new Response(blob).arrayBuffer();
          return response;
        };

        const attemptDirectFallback = async (): Promise<string> => {
          setStatusMessage('Upload failed; attempting direct fallback via backend…');
          const buffer = await toArrayBuffer(binary);
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

        let response: Response | undefined;

        const normalizedUploadUrl = (() => {
          if (!grant.uploadUrl) return null;
          try {
            return new URL(grant.uploadUrl, window.location.origin).toString();
          } catch (urlError) {
            console.error('Invalid upload URL from grant', urlError);
            return null;
          }
        })();

        const sanitizedHeaders = (() => {
          if (!grant.headers) return {};
          return Object.fromEntries(
            Object.entries(grant.headers).filter(
              ([, value]) => value !== undefined && value !== null,
            ),
          ) as Record<string, string>;
        })();

        const presignedResponse = async () => {
          if (!normalizedUploadUrl) return null;
          if (presignedDisabledRef.current) return null;
          if (!presignedUploadsEnabled) {
            return null;
          }
          try {
            return await fetch(normalizedUploadUrl, {
              method: 'PUT',
              headers: sanitizedHeaders,
              body: binary,
            });
          } catch (uploadFetchError) {
            console.warn('Presigned upload failed, will fallback to direct.', uploadFetchError);
            presignedDisabledRef.current = true;
            return null;
          }
        };

        response = await presignedResponse();
        if (!response || !response.ok) {
          objectKey = await attemptDirectFallback();
        }

        setUploadProgress(80);

        if (response && !response.ok) {
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
        setStatusMessage('Upload complete. Redirecting to the ROM dossier…');

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

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
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
    <div className="page-shell">
      <PixellabNavigation
        links={[
          { href: '/admin/roms/upload', label: 'Upload' },
          { href: '/library', label: 'Library' },
          { href: '/onboarding', label: 'Onboarding' },
        ]}
        eyebrow="Admin console"
        description="Upload ROMs with checksums, presigned storage, and a clear audit trail."
        actions={<SignOutButton />}
      />
      <main className="page-content">
        <div className={styles.shell}>
          <div className={styles.marquee}>
            <div>
              <p className="eyebrow">Admin console</p>
              <h1>ROM upload</h1>
              <p className={styles.lead}>
                Drop a build, verify its checksum, and register metadata without leaving the
                console. Every step shows a status you can trust.
              </p>
            </div>
            <div className={styles.actions}>
              <Button href="/admin/onboarding" variant="ghost">
                Back to onboarding
              </Button>
              <Button href="/library" variant="ghost">
                View library
              </Button>
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
                    event.preventDefault();
                    openFilePicker();
                  }
                }}
                onClick={openFilePicker}
              >
                <div className={styles.dropInner}>
                  <p className={styles.dropLabel}>Drop ROM file or click to browse</p>
                  <p className={styles.helper}>
                    Accepts .zip, .nes, .sfc, .smc, and .bin up to 50MB.
                  </p>
                  <input
                    id="rom-file"
                    name="rom-file"
                    type="file"
                    accept=".zip,.nes,.sfc,.bin,.smc"
                    className={styles.hiddenInput}
                    aria-label="ROM file"
                    ref={fileInputRef}
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
                  <p className={styles.helper}>
                    Comma-separated list. We normalize casing for you.
                  </p>
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
                <Button
                  type="submit"
                  loading={
                    stage === 'uploading' || stage === 'registering' || stage === 'verifying'
                  }
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
                </Button>
                <Button type="button" variant="ghost" onClick={resetForm}>
                  Reset form
                </Button>
                {disabledReason && (
                  <p className={styles.ctaHelper} role="status" aria-live="polite">
                    {disabledReason}{' '}
                    {!file && (
                      <button type="button" className={styles.helperLink} onClick={openFilePicker}>
                        Browse files
                      </button>
                    )}
                  </p>
                )}
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
                  <Button href={`/rom/${optimisticRomId}`} variant="ghost">
                    Open ROM detail
                  </Button>
                )}
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
