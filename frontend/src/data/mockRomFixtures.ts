import type { LatestSaveStateResponse, SaveStatePayload } from '@/lib/saveStates';
import type { RomDetails } from '@/types/rom';
import type { SaveState } from '@/types/saveState';

const MOCK_ROM_FIXTURES: Record<string, RomDetails> = {
  'romm-prototype': {
    id: 'romm-prototype',
    title: 'ROMM Prototype Drop',
    description:
      'ROMM dossier pulled from Pixellab references. This build fuses neon overlays with EmulatorJS scaffolding.',
    platformId: 'snes',
    releaseYear: 1993,
    genres: ['Action', 'Adventure', 'Prototype'],
    createdAt: '2024-06-01T00:00:00.000Z',
    updatedAt: '2024-06-02T12:00:00.000Z',
    assets: [
      {
        id: 'cover-art',
        type: 'COVER',
        checksum: 'coverchecksum123',
        contentType: 'image/png',
        size: 204800,
        createdAt: '2024-06-01T00:00:00.000Z',
        url: '/themes/pixellab/hero-grid.png',
      },
      {
        id: 'rom-build',
        type: 'ROM',
        checksum: 'romchecksum456',
        contentType: 'application/octet-stream',
        size: 1048576,
        createdAt: '2024-06-01T00:00:00.000Z',
        url: 'https://example.com/romm-prototype.smc',
      },
      {
        id: 'pitch-deck',
        type: 'MANUAL',
        checksum: 'manualchecksum789',
        contentType: 'application/pdf',
        size: 512000,
        createdAt: '2024-06-01T00:00:00.000Z',
        url: 'https://example.com/romm-prototype-notes.pdf',
      },
    ],
  },
};

const favoriteStore = new Map<string, boolean>();
const saveStateStore = new Map<string, LatestSaveStateResponse>();

export function getMockRomDetails(id: string): RomDetails {
  const baseRom = MOCK_ROM_FIXTURES[id] ?? {
    ...MOCK_ROM_FIXTURES['romm-prototype'],
    id,
    title: `Treazr Drop ${id.toUpperCase()}`,
  };

  return {
    ...baseRom,
    isFavorite: favoriteStore.get(id) ?? baseRom.isFavorite ?? false,
  };
}

export function toggleMockFavorite(id: string): { romId: string; isFavorite: boolean } {
  const nextValue = !(favoriteStore.get(id) ?? false);
  favoriteStore.set(id, nextValue);
  return { romId: id, isFavorite: nextValue };
}

export function getMockLatestSaveState(id: string): LatestSaveStateResponse | null {
  return saveStateStore.get(id) ?? null;
}

export function persistMockSaveState(id: string, payload: SaveStatePayload): SaveState {
  const timestamp = new Date().toISOString();
  const saveState: SaveState = {
    id: `mock-save-${Date.now()}`,
    romId: id,
    slot: payload.slot ?? 1,
    label: payload.label ?? 'Session backup',
    size: payload.data.length,
    contentType: payload.contentType,
    checksum: `mock-${payload.data.length}`,
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  saveStateStore.set(id, {
    saveState,
    data: payload.data,
  });

  return saveState;
}
