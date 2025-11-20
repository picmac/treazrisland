const trimTrailingSlash = (value: string) => value.replace(/\/$/, '');

const deriveEmulatorBase = () => {
  const explicitBase = process.env.NEXT_PUBLIC_EMULATOR_BASE_URL;
  if (explicitBase) {
    return trimTrailingSlash(explicitBase);
  }

  const embedUrl = process.env.NEXT_PUBLIC_EMULATOR_EMBED_URL;
  if (embedUrl) {
    const normalized = embedUrl.replace(/(?:\/dist)?\/embed\.js$/, '');
    return trimTrailingSlash(normalized);
  }

  return '/emulatorjs';
};

export const EMULATOR_BASE_URL = deriveEmulatorBase();
export const EMULATOR_DIST_URL = `${EMULATOR_BASE_URL}/dist`;
export const EMULATOR_EMBED_URL = `${EMULATOR_DIST_URL}/embed.js`;
export const EMULATOR_DATA_URL = `${EMULATOR_DIST_URL}/data`;
export const EMULATOR_VIEWPORT_ID = 'emulator-layer';

export const DEFAULT_KEYBOARD_MAPPING = {
  up: { key: 'ArrowUp', code: 'ArrowUp' },
  down: { key: 'ArrowDown', code: 'ArrowDown' },
  left: { key: 'ArrowLeft', code: 'ArrowLeft' },
  right: { key: 'ArrowRight', code: 'ArrowRight' },
  a: { key: 'x', code: 'KeyX' },
  b: { key: 'z', code: 'KeyZ' },
  x: { key: 's', code: 'KeyS' },
  y: { key: 'a', code: 'KeyA' },
  l: { key: 'q', code: 'KeyQ' },
  r: { key: 'w', code: 'KeyW' },
  start: { key: 'Enter', code: 'Enter' },
  select: { key: 'Shift', code: 'ShiftRight' },
} as const;

export const DEFAULT_GAMEPAD_MAPPING = {
  a: 'B0',
  b: 'B1',
  x: 'B3',
  y: 'B2',
  l: 'B4',
  r: 'B5',
  start: 'B9',
  select: 'B8',
  up: 'H0U',
  down: 'H0D',
  left: 'H0L',
  right: 'H0R',
} as const;

export type KeyboardControl = keyof typeof DEFAULT_KEYBOARD_MAPPING;
