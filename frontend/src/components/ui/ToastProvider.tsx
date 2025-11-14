'use client';

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import styles from './ToastProvider.module.css';

export type ToastPayload = {
  title: string;
  description?: string;
  durationMs?: number;
};

type ToastRecord = ToastPayload & { id: number };

type ToastContextValue = {
  pushToast: (toast: ToastPayload) => void;
};

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastRecord[]>([]);

  const dismissToast = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const pushToast = useCallback(
    ({ title, description, durationMs = 4000 }: ToastPayload) => {
      const id = Date.now() + Math.random();
      setToasts((current) => [...current, { id, title, description, durationMs }]);

      if (durationMs > 0) {
        window.setTimeout(() => dismissToast(id), durationMs);
      }
    },
    [dismissToast],
  );

  const contextValue = useMemo<ToastContextValue>(() => ({ pushToast }), [pushToast]);

  return (
    <ToastContext.Provider value={contextValue}>
      {children}
      <div className={styles.toastViewport} role="status" aria-live="assertive">
        {toasts.map((toast) => (
          <div key={toast.id} className={styles.toast}>
            <div>
              <p className={styles.toastTitle}>{toast.title}</p>
              {toast.description && <p className={styles.toastDescription}>{toast.description}</p>}
            </div>
            <button
              type="button"
              className={styles.dismissButton}
              onClick={() => dismissToast(toast.id)}
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);

  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }

  return context;
}
