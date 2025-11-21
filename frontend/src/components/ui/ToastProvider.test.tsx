import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { describe, expect, it } from 'vitest';

import { ToastProvider, useToast } from './ToastProvider';

describe('ToastProvider', () => {
  function TestConsumer({ durationMs = 50 }: { durationMs?: number }) {
    const { pushToast } = useToast();

    return (
      <button
        type="button"
        onClick={() => pushToast({ title: 'Saved', description: 'State persisted', durationMs })}
      >
        Push toast
      </button>
    );
  }

  it('renders pushed toasts and auto-dismisses them after the configured duration', async () => {
    render(
      <ToastProvider>
        <TestConsumer />
      </ToastProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: /push toast/i }));

    expect(await screen.findByText('Saved')).toBeVisible();
    expect(screen.getByText('State persisted')).toBeVisible();

    await waitFor(() => expect(screen.queryByText('Saved')).not.toBeInTheDocument(), {
      timeout: 2000,
    });
  });

  it('allows manual dismissal when the close button is clicked', async () => {
    render(
      <ToastProvider>
        <TestConsumer durationMs={0} />
      </ToastProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: /push toast/i }));
    const toast = await screen.findByText('Saved');

    fireEvent.click(screen.getByRole('button', { name: '×' }));
    await waitFor(() => expect(toast).not.toBeInTheDocument());
  });
});
