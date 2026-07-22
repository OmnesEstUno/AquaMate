import React from 'react';
import { render, screen } from '@testing-library/react';
import { TankmatesTraits } from '../TankmatesTraits';
import { SourcesList } from '../SourcesList';
import { ProseSection } from '../ProseSection';

test('TankmatesTraits shows good/avoid + warn/trait chips', () => {
  render(<TankmatesTraits good={['Tetra']} avoid={['Barb']} warnChips={['Venomous spines']} traitChips={['Nocturnal']} />);
  expect(screen.getByText('Tetra')).toBeInTheDocument();
  expect(screen.getByText('Barb')).toBeInTheDocument();
  expect(screen.getByText('Venomous spines')).toBeInTheDocument();
  expect(screen.getByText('Nocturnal')).toBeInTheDocument();
});

test('SourcesList renders primary + additional inside a details', () => {
  const sources = { primary: { name: 'SeriouslyFish', url: 'http://x', accessedDate: '2026-06-08' },
    additional: [{ name: 'FishBase', url: 'http://y', accessedDate: '2026-06-08' }] };
  render(<SourcesList sources={sources} />);
  expect(screen.getByText(/SeriouslyFish/)).toBeInTheDocument();
  expect(screen.getByText(/FishBase/)).toBeInTheDocument();
});

test('ProseSection renders nothing when text is empty', () => {
  const { container } = render(<ProseSection title="Care" text={null} />);
  expect(container.firstChild).toBeNull();
});
