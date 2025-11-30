import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import PlayerRomPage from './page';
import { fetchRomDetails } from '@/lib/roms';
import type { RomDetails } from '@/types/rom';

vi.mock('@/lib/roms', () => ({
  fetchRomDetails: vi.fn(),
  resolveRomId: vi.fn((value: string) => value),
}));

vi.mock('next/image', () => ({
  __esModule: true,
  default: (props: React.ComponentProps<'img'> & { priority?: boolean }) => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { priority: _priority, ...rest } = props;
    // eslint-disable-next-line @next/next/no-img-element
    return <img {...rest} alt={rest.alt ?? ''} />;
  },
}));

vi.mock('next/link', () => ({
  __esModule: true,
  default: ({
    href,
    children,
    ...props
  }: { href: string; children: React.ReactNode } & React.HTMLAttributes<HTMLAnchorElement>) => (
    <a
      href={href}
      {...props}
      onClick={(event) => {
        event.preventDefault();
        props.onClick?.(event);
      }}
    >
      {children}
    </a>
  ),
}));

describe('Player ROM detail page', () => {
  const romDetails: RomDetails = {
    id: 'rom-88',
    title: 'Star Fortress',
    description: 'A 16-bit sortie through cosmic battlements.',
    platformId: 'snes',
    platform: { id: 'snes', name: 'Super NES', slug: 'snes' },
    releaseYear: 1994,
    genres: ['Shooter', 'Adventure'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    assets: [
      {
        id: 'asset-1',
        type: 'ARTWORK',
        checksum: 'abc123',
        contentType: 'image/png',
        size: 2048,
        createdAt: new Date().toISOString(),
        url: 'https://cdn.treazr.test/art.png',
      },
    ],
    isFavorite: true,
    saveStateSummary: {
      total: 2,
      latest: {
        id: 'save-77',
        slot: 5,
        label: 'Boss rush',
        size: 4096,
        contentType: 'application/octet-stream',
        checksum: 'deadbeef',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    },
  };

  const fetchRomDetailsMock = vi.mocked(fetchRomDetails);

  beforeEach(() => {
    fetchRomDetailsMock.mockResolvedValue(romDetails);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders ROM metadata with retro copy', async () => {
    render(<PlayerRomPage params={{ id: romDetails.id }} />);

    await screen.findByRole('heading', { name: romDetails.title });

    expect(screen.getByText('Super NES')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Save crystals/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Play Now' })).toHaveAttribute(
      'href',
      `/play/${romDetails.id}`,
    );
  });

  it('keeps the CTA wired to the play route', async () => {
    const user = userEvent.setup();
    render(<PlayerRomPage params={{ id: romDetails.id }} />);

    const cta = await screen.findByRole('link', { name: 'Play Now' });
    await user.click(cta);

    expect(cta).toHaveAttribute('href', `/play/${romDetails.id}`);
  });

  it('shows a loading skeleton while fetching the dossier', async () => {
    let resolveRom: (value: RomDetails | null) => void = () => {};
    fetchRomDetailsMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveRom = resolve;
        }),
    );

    render(<PlayerRomPage params={{ id: romDetails.id }} />);

    expect(screen.getByTestId('rom-loading-skeleton')).toBeInTheDocument();

    resolveRom(romDetails);
    await screen.findByRole('heading', { name: romDetails.title });
  });

  it('surfaces an error panel when the ROM is missing', async () => {
    fetchRomDetailsMock.mockResolvedValueOnce(null);

    render(<PlayerRomPage params={{ id: romDetails.id }} />);

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('cartridge');
  });
});
