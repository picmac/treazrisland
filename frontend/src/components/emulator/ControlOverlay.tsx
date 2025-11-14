'use client';

import styles from './ControlOverlay.module.css';

interface ControlOverlayProps {
  romTitle: string;
  lastSavedAt?: Date | null;
  onSaveState: () => void;
  onLoadState: () => void;
  onSyncCloudSave: () => void;
  isSaving?: boolean;
  isLoading?: boolean;
  isSyncing?: boolean;
  disabled?: boolean;
}

export function ControlOverlay({
  romTitle,
  lastSavedAt,
  onSaveState,
  onLoadState,
  onSyncCloudSave,
  isSaving = false,
  isLoading = false,
  isSyncing = false,
  disabled = false,
}: ControlOverlayProps) {
  const saveLabel = isSaving ? 'Saving…' : 'Save State';
  const loadLabel = isLoading ? 'Loading…' : 'Load State';
  const syncLabel = isSyncing ? 'Uploading…' : 'Upload Save';
  const timestampLabel = lastSavedAt
    ? `Saved ${lastSavedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
    : 'No save yet';

  return (
    <div className={styles.overlayRoot} aria-live="polite">
      <div
        className={styles.overlayPanel}
        role="toolbar"
        aria-label={`${romTitle} emulator controls`}
      >
        <div className={styles.overlayHeader}>
          <h2>Session Controls</h2>
          <p>{romTitle}</p>
        </div>
        <div className={styles.overlayActions}>
          <button
            type="button"
            className={styles.overlayButton}
            onClick={onSaveState}
            disabled={disabled || isSaving}
          >
            {saveLabel}
          </button>
          <button
            type="button"
            className={styles.overlayButton}
            onClick={onLoadState}
            disabled={disabled || isLoading}
          >
            {loadLabel}
          </button>
          <button
            type="button"
            className={styles.overlayButton}
            onClick={onSyncCloudSave}
            disabled={disabled || isSyncing}
          >
            {syncLabel}
          </button>
        </div>
        <div className={styles.overlayMeta}>
          <span>{timestampLabel}</span>
          <span className={styles.statusBadge}>{disabled ? 'Paused' : 'Live'}</span>
        </div>
      </div>
    </div>
  );
}
