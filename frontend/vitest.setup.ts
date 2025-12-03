import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';

vi.mock('next/font/google', () => ({
  Press_Start_2P: () => ({
    className: 'press-start-font',
    variable: '--font-pixellab',
    style: {},
  }),
  Space_Grotesk: () => ({
    className: 'space-grotesk-font',
    variable: '--font-body',
    style: {},
  }),
  Manrope: () => ({
    className: 'manrope-font',
    variable: '--font-body',
    style: {},
  }),
}));
