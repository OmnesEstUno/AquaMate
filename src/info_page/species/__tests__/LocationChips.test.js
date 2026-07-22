import React from 'react';
import { render, screen } from '@testing-library/react';
import { LocationChips } from '../LocationChips';

test('shows regions, first country, and a +N chip for the rest', () => {
  render(<LocationChips regions={['South America']} countries={['Brazil', 'Peru', 'Colombia']} depth={null} />);
  expect(screen.getByText(/South America/)).toBeInTheDocument();
  expect(screen.getByText('Brazil')).toBeInTheDocument();
  expect(screen.getByText('+2')).toBeInTheDocument();
  expect(screen.queryByText('Peru')).not.toBeInTheDocument(); // hidden until hover-reveal markup
});

test('single country shows no +N chip', () => {
  render(<LocationChips regions={[]} countries={['China']} depth={null} />);
  expect(screen.getByText('China')).toBeInTheDocument();
  expect(screen.queryByText(/^\+/)).not.toBeInTheDocument();
});

test('mesophotic chip appears when depth.min > 30', () => {
  render(<LocationChips regions={[]} countries={[]} depth={{ min: 40, max: 80 }} />);
  expect(screen.getByText(/Mesophotic/i)).toBeInTheDocument();
});
