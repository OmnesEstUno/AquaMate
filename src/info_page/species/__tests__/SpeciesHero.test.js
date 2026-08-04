import React from 'react';
import { render, screen } from '@testing-library/react';
import { SpeciesHero } from '../SpeciesHero';

const item = {
  taxon: 'fish', kind: 'fauna', waterType: 'freshwater',
  scientificName: 'Pterophyllum scalare', commonName: 'Angelfish',
  alsoKnownAs: ['Scalare'], category: 'Cichlid', careLevel: 'intermediate',
  taxonomy: { family: 'Cichlidae', order: 'Cichliformes' },
  nativeRange: { regions: ['South America'], countries: ['Brazil', 'Peru'],
    habitat: 'Slow rivers.', biotope: 'Amazon basin', depthRangeM: null },
  media: { primaryImage: null, imageCandidates: [] },
};

test('renders sci name as title, common name, category, biotope', () => {
  render(<SpeciesHero item={item} images={[]} />);
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Pterophyllum scalare');
  expect(screen.getByText('Angelfish')).toBeInTheDocument();
  expect(screen.getByText(/Cichlidae/)).toBeInTheDocument();
  expect(screen.getByText(/Amazon basin/)).toBeInTheDocument(); // biotope now sits in the hero text
});
