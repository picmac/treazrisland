import { render, screen, within } from '@testing-library/react';
import React from 'react';
import { describe, expect, it } from 'vitest';

import { ProgressSteps, type ProgressStep } from './ProgressSteps';

describe('ProgressSteps', () => {
  const steps: ProgressStep[] = [
    { title: 'Health check', description: 'Ping API and storage', status: 'completed' },
    { title: 'Profile', description: 'Confirm admin identity', status: 'current' },
    { title: 'Upload ROM', description: 'Seed the catalog', status: 'pending' },
  ];

  it('renders an ordered list with semantic labels', () => {
    render(<ProgressSteps steps={steps} />);

    const list = screen.getByRole('list', { name: /admin onboarding progress/i });
    expect(list.tagName).toBe('OL');

    const items = within(list).getAllByRole('listitem');
    expect(items).toHaveLength(steps.length);
    expect(items[0]).toHaveTextContent('Health check');
    expect(items[1]).toHaveTextContent('Profile');
    expect(items[2]).toHaveTextContent('Upload ROM');
  });

  it('marks completed steps with a checkmark and highlights the current step', () => {
    render(<ProgressSteps steps={steps} />);

    const items = screen.getAllByRole('listitem');
    expect(within(items[0]).getByText('✓')).toBeVisible();
    expect(within(items[1]).getByText('2')).toBeVisible();
    expect(items[1].className).toMatch(/current/);
    expect(items[2].className).toMatch(/pending/);
  });
});
