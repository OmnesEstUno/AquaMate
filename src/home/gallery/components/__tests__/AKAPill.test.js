import React from 'react';
import { render, screen } from '@testing-library/react';
import { AKAPill } from '../AKAPill';

describe('AKAPill', () => {
  const AKA = ['Red Neon Tetra', 'Cardinal'];

  test('renders nothing when query is empty', () => {
    const { container } = render(<AKAPill query="" alsoKnownAs={AKA} matchedVia="alsoKnownAs" />);
    expect(container.firstChild).toBeNull();
  });

  test('renders nothing when matchedVia is commonName', () => {
    const { container } = render(<AKAPill query="cardinal" alsoKnownAs={AKA} matchedVia="commonName" />);
    expect(container.firstChild).toBeNull();
  });

  test('renders nothing when alsoKnownAs is empty', () => {
    const { container } = render(<AKAPill query="anything" alsoKnownAs={[]} matchedVia="alsoKnownAs" />);
    expect(container.firstChild).toBeNull();
  });

  test('renders the first matching AKA entry when matchedVia is alsoKnownAs', () => {
    render(<AKAPill query="neon" alsoKnownAs={AKA} matchedVia="alsoKnownAs" />);
    expect(screen.getByText(/also known as/i)).toBeInTheDocument();
    expect(screen.getByText(/Red Neon Tetra/i)).toBeInTheDocument();
  });

  test('case-insensitive matching', () => {
    render(<AKAPill query="RED" alsoKnownAs={AKA} matchedVia="alsoKnownAs" />);
    expect(screen.getByText(/Red Neon Tetra/i)).toBeInTheDocument();
  });

  test('silent when matchedVia says alsoKnownAs but no entry actually contains the query', () => {
    // Safety guard — server said match came via AKA, but the array has no substring hit.
    const { container } = render(<AKAPill query="xyz" alsoKnownAs={AKA} matchedVia="alsoKnownAs" />);
    expect(container.firstChild).toBeNull();
  });
});
