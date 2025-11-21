/* eslint-disable @next/next/no-img-element */
import { render, screen, within } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

import HomePage from './page';

vi.mock('next/image', () => ({
  __esModule: true,
  default: ({ ...props }: React.ComponentProps<'img'> & { priority?: boolean }) => (
    <img {...props} alt={props.alt ?? ''} />
  ),
}));

vi.mock('next/link', () => ({
  __esModule: true,
  default: ({
    href,
    children,
    ...props
  }: { href: string; children: React.ReactNode } & React.HTMLAttributes<HTMLAnchorElement>) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

describe('HomePage touchpoints', () => {
  it('opens external touchpoints in a new tab without leaking referrer data', () => {
    render(<HomePage />);

    const docsCard = screen
      .getByRole('heading', { name: 'Theme documentation' })
      .closest('article');
    expect(docsCard).not.toBeNull();

    const docsLink = within(docsCard as HTMLElement).getByRole('link', { name: 'Open' });
    expect(docsLink).toHaveAttribute('target', '_blank');
    expect(docsLink).toHaveAttribute('rel', 'noreferrer');
  });

  it('keeps internal touchpoints in the same tab', () => {
    render(<HomePage />);

    const onboardingCard = screen
      .getByRole('heading', { name: 'Crew onboarding' })
      .closest('article');
    expect(onboardingCard).not.toBeNull();

    const onboardingLink = within(onboardingCard as HTMLElement).getByRole('link', {
      name: 'Open',
    });
    expect(onboardingLink).not.toHaveAttribute('target');
    expect(onboardingLink).not.toHaveAttribute('rel');
  });
});
