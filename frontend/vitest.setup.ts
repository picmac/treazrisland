import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';

vi.mock('next/font/google', () => ({
  Press_Start_2P: () => ({
    className: 'press-start-font',
    variable: '--font-pixellab',
    style: {},
  }),
}));
