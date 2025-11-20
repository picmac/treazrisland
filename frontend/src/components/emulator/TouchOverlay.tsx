'use client';

import { useEffect, useState } from 'react';
import type { PointerEvent } from 'react';

import { DEFAULT_KEYBOARD_MAPPING, type KeyboardControl } from '@/lib/config';

import styles from './TouchOverlay.module.css';

type TouchOverlayProps = {
  enabled: boolean;
};

export function TouchOverlay({ enabled }: TouchOverlayProps) {
  const [supportsTouch, setSupportsTouch] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    const canTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    setSupportsTouch(canTouch);
  }, []);

  if (!enabled || !supportsTouch) {
    return null;
  }

  const createHandlers = (control: KeyboardControl) => {
    const handlePress = (event: PointerEvent<HTMLButtonElement>) => {
      if (!enabled) {
        return;
      }
      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      emitInput(control, 'keydown');
    };

    const handleRelease = (event: PointerEvent<HTMLButtonElement>) => {
      if (!enabled) {
        return;
      }
      event.preventDefault();
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
      emitInput(control, 'keyup');
    };

    return {
      onPointerDown: handlePress,
      onPointerUp: handleRelease,
      onPointerCancel: handleRelease,
      onPointerLeave: handleRelease,
    };
  };

  return (
    <div className={`${styles.touchOverlay} ${styles.touchOverlayVisible}`} aria-hidden="true">
      <div className={styles.touchOverlay__shoulders}>
        <button
          type="button"
          className={`${styles.touchOverlay__button} ${styles.touchOverlay__shoulderButton}`}
          aria-label="Left shoulder button"
          {...createHandlers('l')}
        >
          L
        </button>
        <button
          type="button"
          className={`${styles.touchOverlay__button} ${styles.touchOverlay__shoulderButton}`}
          aria-label="Right shoulder button"
          {...createHandlers('r')}
        >
          R
        </button>
      </div>

      <div className={styles.touchOverlay__body}>
        <div className={`${styles.touchOverlay__cluster} ${styles.touchOverlay__clusterColumn}`}>
          <div className={styles.touchOverlay__dpad}>
            <span />
            <button
              type="button"
              className={styles.touchOverlay__button}
              aria-label="Move up"
              {...createHandlers('up')}
            >
              ↑
            </button>
            <span />
            <button
              type="button"
              className={styles.touchOverlay__button}
              aria-label="Move left"
              {...createHandlers('left')}
            >
              ←
            </button>
            <span />
            <button
              type="button"
              className={styles.touchOverlay__button}
              aria-label="Move right"
              {...createHandlers('right')}
            >
              →
            </button>
            <span />
            <button
              type="button"
              className={styles.touchOverlay__button}
              aria-label="Move down"
              {...createHandlers('down')}
            >
              ↓
            </button>
            <span />
          </div>
        </div>

        <div className={`${styles.touchOverlay__cluster} ${styles.touchOverlay__clusterRow}`}>
          <button
            type="button"
            className={styles.touchOverlay__button}
            aria-label="Y button"
            {...createHandlers('y')}
          >
            Y
          </button>
          <button
            type="button"
            className={styles.touchOverlay__button}
            aria-label="X button"
            {...createHandlers('x')}
          >
            X
          </button>
          <button
            type="button"
            className={styles.touchOverlay__button}
            aria-label="B button"
            {...createHandlers('b')}
          >
            B
          </button>
          <button
            type="button"
            className={styles.touchOverlay__button}
            aria-label="A button"
            {...createHandlers('a')}
          >
            A
          </button>
        </div>
      </div>

      <div
        className={`${styles.touchOverlay__meta} ${styles.touchOverlay__cluster} ${styles.touchOverlay__clusterRow}`}
      >
        <button
          type="button"
          className={`${styles.touchOverlay__button} ${styles.touchOverlay__buttonSecondary}`}
          aria-label="Select button"
          {...createHandlers('select')}
        >
          Select
        </button>
        <button
          type="button"
          className={`${styles.touchOverlay__button} ${styles.touchOverlay__buttonSecondary}`}
          aria-label="Start button"
          {...createHandlers('start')}
        >
          Start
        </button>
      </div>
    </div>
  );
}

function emitInput(control: KeyboardControl, type: 'keydown' | 'keyup') {
  if (typeof window === 'undefined') {
    return;
  }
  const binding = DEFAULT_KEYBOARD_MAPPING[control];
  if (!binding) {
    return;
  }

  const event = new KeyboardEvent(type, {
    key: binding.key,
    code: binding.code,
    bubbles: true,
    cancelable: true,
  });

  window.dispatchEvent(event);
}
