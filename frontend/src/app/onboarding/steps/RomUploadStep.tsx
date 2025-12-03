'use client';

import { ChangeEvent, FormEvent, useEffect, useState } from 'react';

import { useRomUpload, type RomUploadInput } from '@/hooks/useRomUpload';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { FormField } from '@/components/ui/FormField';
import { StatusPill } from '@/components/ui/StatusPill';

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
    <Card
      as="article"
      className={styles.stepCard}
      title="4. Upload your first ROM"
      description="Use the admin upload API so EmulatorJS has something to boot."
    >
      <form className={styles.formGrid} onSubmit={handleSubmit}>
        <FormField
          label="ROM title"
          inputProps={{
            type: 'text',
            value: title,
            onChange: (event) => setTitle(event.target.value),
            placeholder: 'Treaz test build',
          }}
        />

        <FormField
          label="Platform"
          inputSlot={
            <select
              value={platformId}
              onChange={(event) => setPlatformId(event.target.value)}
              className={styles.select}
            >
              {PLATFORMS.map((platform) => (
                <option key={platform.id} value={platform.id}>
                  {platform.label}
                </option>
              ))}
            </select>
          }
        />

        <FormField
          label="Release year"
          inputProps={{
            type: 'number',
            value: releaseYear,
            onChange: (event) => setReleaseYear(event.target.value),
            placeholder: '1993',
          }}
        />

        <FormField
          label="Description"
          inputSlot={
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={3}
              className={styles.textarea}
            />
          }
        />

        <FormField
          label="ROM file"
          description="Accepts .zip, .nes, .sfc, .bin with checksum verification."
          inputProps={{
            type: 'file',
            accept: '.zip,.nes,.sfc,.bin',
            onChange: handleFileChange,
          }}
        />

        <div className={styles.inlineActions}>
          <Button type="button" variant="ghost" onClick={handleReset}>
            Reset form
          </Button>
          <Button type="submit" loading={isUploading} disabled={!title || !selectedFile}>
            {isUploading ? 'Uploading…' : 'Upload ROM'}
          </Button>
        </div>
      </form>

      <div className={styles.inlineActions}>
        {(error || formError) && (
          <StatusPill tone="danger" role="alert">
            {formError ?? error}
          </StatusPill>
        )}
        {successMessage && <StatusPill tone="success">{successMessage}</StatusPill>}
      </div>
    </Card>
  );
}
