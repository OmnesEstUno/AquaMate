import React from 'react';
import { render, screen } from '@testing-library/react';
import { CareLevelBadge } from '../CareLevelBadge';

describe('CareLevelBadge', () => {
  test('renders nothing when level is null', () => {
    const { container } = render(<CareLevelBadge level={null} />);
    expect(container.firstChild).toBeNull();
  });

  test('renders nothing when level is undefined', () => {
    const { container } = render(<CareLevelBadge level={undefined} />);
    expect(container.firstChild).toBeNull();
  });

  test.each([
    ['beginner',     'Beginner'],
    ['intermediate', 'Intermediate'],
    ['advanced',     'Advanced'],
    ['expert',       'Expert'],
  ])('renders %s with capitalized label', (level, label) => {
    render(<CareLevelBadge level={level} />);
    expect(screen.getByText(label)).toBeInTheDocument();
  });

  test('applies the level class for CSS targeting', () => {
    const { container } = render(<CareLevelBadge level="expert" />);
    expect(container.firstChild).toHaveClass('gallery-care');
    expect(container.firstChild).toHaveClass('gallery-care--expert');
  });
});
