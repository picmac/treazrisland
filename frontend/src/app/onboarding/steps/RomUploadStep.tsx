'use client';

import { ChangeEvent, FormEvent, useEffect, useState } from 'react';

import { useRomUpload, type RomUploadInput } from '@/hooks/useRomUpload';

import type { RomUploadResult, StepStatus } from '../types';
import styles from '../page.module.css';

const PLATFORMS = [
  { id: 'nes', label: 'NES' },
  { id: 'snes', label: 'SNES' },
  { id: 'genesis', label: 'Genesis / Mega Drive' },
];

interface RomUploadStepProps {
  state: StepStatus<RomUploadResult>;
  onComplete: (result: RomUploadResult) => void;
}

export function RomUploadStep({ state, onComplete }: RomUploadStepProps) {
  const [title, setTitle] = useState(state.data?.title ?? '');
  const [platformId, setPlatformId] = useState(PLATFORMS[0].id);
  const [releaseYear, setReleaseYear] = useState('');
  const [description, setDescription] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const { uploadRom, isUploading, error, result, reset } = useRomUpload();

  useEffect(() => {
    if (state.data) {
      setTitle(state.data.title);
      setSuccessMessage(`ROM uploaded on ${new Date(state.data.uploadedAt).toLocaleString()}`);
    }
  }, [state.data]);

  useEffect(() => {
    if (result) {
      setSuccessMessage(`ROM ${result.title} uploaded.`);
    }
  }, [result]);

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files.length > 0) {
      setSelectedFile(event.target.files[0]);
      setFormError(null);
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!selectedFile) {
      setFormError('Select a ROM or zip file to continue.');
      setSuccessMessage(null);
      return;
    }

    try {
      const parsedReleaseYear = releaseYear ? Number(releaseYear) : undefined;
      const safeReleaseYear =
        typeof parsedReleaseYear === 'number' && !Number.isNaN(parsedReleaseYear)
          ? parsedReleaseYear
          : undefined;

      const trimmedDescription = description.trim();
      const romPayload: RomUploadInput = {
        title,
        platformId,
        releaseYear: safeReleaseYear,
        file: selectedFile,
      };

      if (trimmedDescription.length > 0) {
        romPayload.description = trimmedDescription;
      }

      const response = await uploadRom(romPayload);

      const resultPayload: RomUploadResult = {
        romId: response.id,
        title: response.title,
        filename: selectedFile.name,
        uploadedAt: new Date().toISOString(),
      };

      onComplete(resultPayload);
      setSuccessMessage(`Uploaded ${response.title} (${selectedFile.name})`);
      setFormError(null);
      setSelectedFile(null);
    } catch {
      setSuccessMessage(null);
    }
  };

  const handleReset = () => {
    reset();
    setTitle('');
    setPlatformId(PLATFORMS[0].id);
    setReleaseYear('');
    setDescription('');
    setSelectedFile(null);
    setSuccessMessage(null);
    setFormError(null);
  };

  return (
    <div className={styles.stepCard}>
      <div className={styles.stepHeader}>
        <h2>4. Upload your first ROM</h2>
        <p>Use the admin upload API so EmulatorJS has something to boot.</p>
      </div>

      <form className={styles.formGrid} onSubmit={handleSubmit}>
        <label>
          ROM title
          <input
            type="text"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Treaz test build"
          />
        </label>

        <label>
          Platform
          <select value={platformId} onChange={(event) => setPlatformId(event.target.value)}>
            {PLATFORMS.map((platform) => (
              <option key={platform.id} value={platform.id}>
                {platform.label}
              </option>
            ))}
          </select>
        </label>

        <label>
          Release year
          <input
            type="number"
            value={releaseYear}
            onChange={(event) => setReleaseYear(event.target.value)}
            placeholder="1993"
          />
        </label>

        <label className={styles.fullWidthField}>
          Description
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={3}
          />
        </label>

        <label className={styles.fullWidthField}>
          ROM file
          <input type="file" accept=".zip,.nes,.sfc,.bin" onChange={handleFileChange} />
        </label>

        <div className={styles.inlineActions}>
          <button type="button" className={styles.secondaryButton} onClick={handleReset}>
            Reset form
          </button>
          <button
            type="submit"
            className={styles.primaryButton}
            disabled={isUploading || !title || !selectedFile}
          >
            {isUploading ? 'Uploading…' : 'Upload ROM'}
          </button>
        </div>
      </form>

      {(error || formError) && (
        <p role="alert" className={styles.errorMessage}>
          {formError ?? error}
        </p>
      )}

      {successMessage && <p className={styles.successMessage}>{successMessage}</p>}
    </div>
  );
}
