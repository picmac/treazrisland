import { render, screen } from '@testing-library/react';

import HomePage from './page';

describe('HomePage', () => {
  it('renders the hero heading and copy', () => {
    render(<HomePage />);

    expect(
      screen.getByRole('heading', {
        name: /treazr island/i,
      }),
    ).toBeInTheDocument();

    expect(
      screen.getByText(/pixellab\.ai palette locked in\. awaiting emulatorjs drop-in\./i),
    ).toBeVisible();
  });
});
