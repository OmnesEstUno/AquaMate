import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { AdvisoryPill } from '../AdvisoryPill';

describe('AdvisoryPill', () => {
  test('renders nothing when advisory is null', () => {
    const { container } = render(<AdvisoryPill advisory={null} />);
    expect(container.firstChild).toBeNull();
  });

  test('renders nothing when advisory.level is missing', () => {
    const { container } = render(<AdvisoryPill advisory={{ reason: 'x' }} />);
    expect(container.firstChild).toBeNull();
  });

  test.each([
    ['specialist-only',       'Specialist',  '⚠'],
    ['legally-restricted',    'Restricted',  '⚖'],
    ['public-aquarium-only',  'XL',          '⚑'],
    ['pond-only',             'Pond',        '⚘'],
  ])('renders %s → label "%s" with icon %s', (level, label, icon) => {
    render(<AdvisoryPill advisory={{ level, reason: 'x' }} />);
    expect(screen.getByText(label)).toBeInTheDocument();
    expect(screen.getByText(icon)).toBeInTheDocument();
  });

  test('hover shows the reason tooltip', () => {
    render(<AdvisoryPill advisory={{ level: 'specialist-only', reason: 'Demanding diet.' }} />);
    const pill = screen.getByText('Specialist').closest('.gallery-advisory');
    expect(screen.queryByText('Demanding diet.')).toBeNull();
    fireEvent.mouseEnter(pill);
    expect(screen.getByText('Demanding diet.')).toBeInTheDocument();
    fireEvent.mouseLeave(pill);
    expect(screen.queryByText('Demanding diet.')).toBeNull();
  });

  test('calls onHoverChange when hover state toggles', () => {
    const onHoverChange = jest.fn();
    render(<AdvisoryPill advisory={{ level: 'specialist-only', reason: 'x' }} onHoverChange={onHoverChange} />);
    const pill = screen.getByText('Specialist').closest('.gallery-advisory');
    fireEvent.mouseEnter(pill);
    expect(onHoverChange).toHaveBeenCalledWith(true);
    fireEvent.mouseLeave(pill);
    expect(onHoverChange).toHaveBeenCalledWith(false);
  });
});
