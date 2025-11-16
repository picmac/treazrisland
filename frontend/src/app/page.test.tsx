import { render, screen } from '@testing-library/react';

import HomePage from './page';

const docsUrl = 'https://github.com/treazrisland/treazrisland/blob/main/docs/ui/theme.md';

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
