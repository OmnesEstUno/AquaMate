import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { ImageGallery } from '../ImageGallery';

const imgs = [
  { thumb: 't0', full: 'f0', credit: 'c0' },
  { thumb: 't1', full: 'f1', credit: 'c1' },
  { thumb: 't2', full: 'f2', credit: 'c2' },
];

test('collapsed: shows the first thumb, no controls', () => {
  render(<ImageGallery images={imgs} alt="X" />);
  const img = screen.getByAltText('X');
  expect(img).toHaveAttribute('src', 't0');
  expect(screen.queryByLabelText('Next')).not.toBeVisible?.() ?? true;
});

test('clicking the image expands and advances through fulls', () => {
  render(<ImageGallery images={imgs} alt="X" />);
  const img = screen.getByAltText('X');
  fireEvent.click(img); // expand → shows full of index 0
  expect(img).toHaveAttribute('src', 'f0');
  fireEvent.click(img); // next
  expect(img).toHaveAttribute('src', 'f1');
});

test('arrows cycle and wrap; close returns to thumb', () => {
  render(<ImageGallery images={imgs} alt="X" />);
  const img = screen.getByAltText('X');
  fireEvent.click(img);
  fireEvent.click(screen.getByLabelText('Previous')); // wrap to last
  expect(img).toHaveAttribute('src', 'f2');
  fireEvent.click(screen.getByLabelText('Close'));
  expect(img).toHaveAttribute('src', 't0');
});

test('renders a no-image placeholder when images is empty', () => {
  render(<ImageGallery images={[]} alt="X" />);
  expect(screen.getByText(/no image/i)).toBeInTheDocument();
});
