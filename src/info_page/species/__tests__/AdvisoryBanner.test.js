import React from 'react';
import { render, screen } from '@testing-library/react';
import { AdvisoryBanner } from '../AdvisoryBanner';

test('renders nothing when advisory is null', () => {
  const { container } = render(<AdvisoryBanner advisory={null} />);
  expect(container.firstChild).toBeNull();
});
test('renders level label + reason, with the level class', () => {
  render(<AdvisoryBanner advisory={{ level: 'specialist-only', reason: 'Demanding.' }} />);
  expect(screen.getByText(/Specialist-only/i)).toBeInTheDocument();
  expect(screen.getByText('Demanding.')).toBeInTheDocument();
  expect(document.querySelector('.species-advisory.specialist-only')).toBeInTheDocument();
});
