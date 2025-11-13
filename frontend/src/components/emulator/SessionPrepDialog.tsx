'use client';

import { useId } from 'react';
import styles from './SessionPrepDialog.module.css';

type MappingItem = {
  action: string;
  binding: string;
};

interface SessionPrepDialogProps {
  open: boolean;
  romTitle?: string;
  mappings?: MappingItem[];
  onConfirm: () => void;
  onCancel?: () => void;
}

const DEFAULT_MAPPINGS: MappingItem[] = [
  { action: 'D-Pad', binding: 'Arrow Keys / WASD' },
  { action: 'A', binding: 'X' },
  { action: 'B', binding: 'Z' },
  { action: 'Start', binding: 'Enter' },
  { action: 'Select', binding: 'Shift' }
];

export function SessionPrepDialog({
  open,
  romTitle,
  mappings = DEFAULT_MAPPINGS,
  onConfirm,
  onCancel
}: SessionPrepDialogProps) {
  const titleId = useId();
  const descriptionId = useId();

  if (!open) {
    return null;
  }

  return (
    <div className={styles.backdrop} role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={descriptionId}>
      <div className={styles.dialog}>
        <h1 id={titleId}>Controller Check</h1>
        <p id={descriptionId}>
          {romTitle ? `Confirm your controls before diving into ${romTitle}.` : 'Confirm your controls before starting your session.'}
          {' '}
          Plug in a gamepad now or stick with the keyboard defaults below.
        </p>
        <ul className={styles.mappingList}>
          {mappings.map((mapping) => (
            <li key={mapping.action} className={styles.mappingItem}>
              <span>{mapping.action}</span>
              <span>{mapping.binding}</span>
            </li>
          ))}
        </ul>
        <div className={styles.actions}>
          {onCancel && (
            <button type="button" className={styles.secondaryButton} onClick={onCancel}>
              Cancel
            </button>
          )}
          <button type="button" className={styles.primaryButton} onClick={onConfirm}>
            Ready Up
          </button>
        </div>
      </div>
    </div>
  );
}
