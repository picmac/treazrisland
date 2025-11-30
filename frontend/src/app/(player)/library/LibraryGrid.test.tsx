import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import { LibraryGrid } from './LibraryGrid';
import type { RomSummary } from '@/types/rom';

type TestResizeObserverCallback = (
  entries: ResizeObserverEntry[],
  observer: ResizeObserver,
) => void;

const roms: RomSummary[] = [
  {
    id: 'rom-1',
    title: 'First Adventure',
    description: 'Explore the island.',
    platformId: 'nes',
    releaseYear: 1991,
    genres: ['Adventure'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    isFavorite: false,
    lastPlayedAt: new Date().toISOString(),
  },
  {
    id: 'rom-2',
    title: 'Second Puzzle',
    platformId: 'snes',
    releaseYear: 1992,
    genres: ['Puzzle'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    isFavorite: true,
    lastPlayedAt: undefined,
  },
];

class ResizeObserverMock {
  callback: TestResizeObserverCallback;
  constructor(callback: TestResizeObserverCallback) {
    this.callback = callback;
  }
  observe(target: Element) {
    this.callback(
      [{ target, contentRect: { width: 1200, height: 800 } } as ResizeObserverEntry],
      this,
    );
  }
  unobserve() {}
  disconnect() {}
}

describe('LibraryGrid', () => {
  beforeAll(() => {
    global.ResizeObserver = ResizeObserverMock as unknown as typeof ResizeObserver;
  });

  it('renders rom cards and triggers favorite toggle', () => {
    const onToggle = vi.fn();

    render(
      <LibraryGrid
        roms={roms}
        isLoading={false}
        isFetching={false}
        hasNextPage={false}
        fetchNextPage={vi.fn()}
        onToggleFavorite={onToggle}
        favoritePending={false}
      />,
    );

    expect(screen.getAllByTestId('rom-card')).toHaveLength(2);

    fireEvent.click(screen.getAllByTestId('favorite-toggle')[0]);
    expect(onToggle).toHaveBeenCalledWith('rom-1');
  });

  it('supports keyboard navigation between cards', async () => {
    const user = userEvent.setup();

    render(
      <LibraryGrid
        roms={roms}
        isLoading={false}
        isFetching={false}
        hasNextPage={false}
        fetchNextPage={vi.fn()}
        onToggleFavorite={vi.fn()}
      />,
    );

    const wrappers = screen.getAllByRole('gridcell');
    const cards = screen.getAllByTestId('rom-card');
    await user.tab();
    expect(wrappers[0]).toHaveFocus();

    await user.keyboard('{ArrowRight}');
    expect(wrappers[1]).toHaveFocus();
    expect(cards[1]).toBeVisible();
  });
});
