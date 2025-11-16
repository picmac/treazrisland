/* eslint-disable @next/next/no-img-element */
import { render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

import HomePage from './page';

const docsUrl = 'https://github.com/treazrisland/treazrisland/blob/main/docs/ui/theme.md';

vi.mock('next/image', () => ({
  __esModule: true,
  default: ({
    priority: _priority,
    ...props
  }: React.ComponentProps<'img'> & { priority?: boolean }) => (
    // Next.js strips the `priority` attribute from the DOM, so mirror that behavior in the mock.
    <img {...props} alt={props.alt ?? ''} />
  ),
}));

describe('HomePage', () => {
  it('renders the navigation landmark and hero heading', () => {
    render(<HomePage />);

    expect(
      screen.getByRole('navigation', {
        name: /primary/i,
      }),
    ).toBeVisible();

    expect(
      screen.getByRole('heading', {
        level: 1,
        name: /treazr island boot screen/i,
      }),
    ).toBeVisible();
  });

  it('links to the theme documentation', () => {
    render(<HomePage />);

    expect(
      screen.getByRole('link', {
        name: /theme mdx notes/i,
      }),
    ).toHaveAttribute('href', docsUrl);
  });
});
