import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import PlayPage from './page';
import { ToastProvider } from '@/components/ui/ToastProvider';
import { fetchRomDetails } from '@/lib/roms';
import {
  fetchLatestSaveState,
  persistSaveState,
  type LatestSaveStateResponse,
} from '@/lib/saveStates';
import type { RomDetails } from '@/types/rom';

vi.mock('@/lib/roms');
vi.mock('@/lib/saveStates');

describe('PlayPage control overlay readiness', () => {
  const romDetails: RomDetails = {
    id: 'test-rom',
    title: 'Test Adventure',
    description: 'A testing quest.',
    platformId: 'nes',
    releaseYear: 1990,
    genres: ['Adventure'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    assets: [
      {
        id: 'asset-rom',
        type: 'ROM',
        checksum: 'checksum-123',
        contentType: 'application/octet-stream',
        size: 1024,
        createdAt: new Date().toISOString(),
        url: 'https://assets.treazr.test/rom.bin',
      },
    ],
    isFavorite: false,
  };

  const latestSaveState: LatestSaveStateResponse = {
    saveState: {
      id: 'save-1',
      romId: romDetails.id,
      slot: 1,
      label: 'Auto save',
      size: 256,
      contentType: 'application/octet-stream',
      checksum: 'checksum-save',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    data: 'YmFzZTY0LXNhdmUtc3RhdGU=',
  };

  const fetchRomDetailsMock = vi.mocked(fetchRomDetails);
  const fetchLatestSaveStateMock = vi.mocked(fetchLatestSaveState);
  const persistSaveStateMock = vi.mocked(persistSaveState);

  beforeEach(() => {
    // jsdom does not implement ResizeObserver, so stub it for viewport scaling hooks.
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    );

    fetchRomDetailsMock.mockResolvedValue(romDetails);
    fetchLatestSaveStateMock.mockResolvedValue(latestSaveState);
    persistSaveStateMock.mockResolvedValue(latestSaveState);
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('enables saving after readying up even if the emulator runtime is still loading', async () => {
    const user = userEvent.setup();

    render(
      <ToastProvider>
        <PlayPage params={{ romId: romDetails.id }} />
      </ToastProvider>,
    );

    await user.click(await screen.findByRole('button', { name: 'Ready Up' }));

    const saveButton = await screen.findByRole('button', { name: 'Save State' });
    expect(saveButton).toBeEnabled();

    await user.click(saveButton);

    expect(persistSaveStateMock).not.toHaveBeenCalled();
    await screen.findByText('Emulator not ready');
  });
});
