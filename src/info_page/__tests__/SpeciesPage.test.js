import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';

// react-router-dom v7's exports map isn't resolvable by CRA's Jest (see
// src/home/gallery/components/__tests__/GalleryCard.test.js for the same
// workaround), so provide a minimal, functional virtual mock: enough
// MemoryRouter/Routes/Route/useParams behavior to drive SpeciesPage by URL.
jest.mock('react-router-dom', () => {
  const ReactLib = require('react');
  const PathContext = ReactLib.createContext('/');
  const ParamsContext = ReactLib.createContext({});

  function matchPath(routePath, actualPath) {
    const routeParts = routePath.split('/').filter(Boolean);
    const actualParts = actualPath.split('/').filter(Boolean);
    if (routeParts.length !== actualParts.length) return null;
    const params = {};
    for (let i = 0; i < routeParts.length; i++) {
      if (routeParts[i].startsWith(':')) {
        params[routeParts[i].slice(1)] = decodeURIComponent(actualParts[i]);
      } else if (routeParts[i] !== actualParts[i]) {
        return null;
      }
    }
    return params;
  }

  function MemoryRouter({ initialEntries = ['/'], children }) {
    return ReactLib.createElement(PathContext.Provider, { value: initialEntries[0] }, children);
  }

  function Routes({ children }) {
    const path = ReactLib.useContext(PathContext);
    const routes = ReactLib.Children.toArray(children);
    for (const route of routes) {
      const params = matchPath(route.props.path, path);
      if (params) {
        return ReactLib.createElement(ParamsContext.Provider, { value: params }, route.props.element);
      }
    }
    return null;
  }

  function Route() { return null; }
  function useParams() { return ReactLib.useContext(ParamsContext); }
  function useNavigate() { return () => {}; }
  function Link({ to, children, ...rest }) { return ReactLib.createElement('a', { href: to, ...rest }, children); }

  return { MemoryRouter, Routes, Route, useParams, useNavigate, Link };
}, { virtual: true });

const { MemoryRouter, Routes, Route } = require('react-router-dom');
const SpeciesPage = require('../SpeciesPage').default;

const record = {
  taxon: 'fish', kind: 'fauna', waterType: 'freshwater', slug: 'angelfish',
  scientificName: 'Pterophyllum scalare', commonName: 'Angelfish', alsoKnownAs: [],
  category: 'Cichlid', careLevel: 'intermediate', taxonomy: { family: 'Cichlidae', order: 'Cichliformes' },
  nativeRange: { regions: ['South America'], countries: ['Brazil'], habitat: 'Rivers.', biotope: 'Amazon', depthRangeM: null },
  waterParameters: { temperatureC: { min: 24, max: 30 }, pH: { min: 6.5, max: 7.5 }, gH: null, kH: null, salinity: null },
  adultSizeCm: { min: 12, max: 15 }, lifespanYears: null,
  tank: { minVolumeLiters: 200, minLengthCm: null, swimZone: 'mid', decorPreferences: [], minSandDepthCm: null },
  diet: { type: 'omnivore', notes: 'Eats flakes.' },
  compatibility: { temperament: 'semi-aggressive', grouping: 'shoaling', minGroupSize: 1, goodWith: ['Tetra'], avoidWith: ['Barb'] },
  media: { primaryImage: null, imageCandidates: [] },
  summary: 'A tall cichlid.', careNotes: 'Tall tank.', breedingNotes: 'Pairs bond.',
  sources: { primary: { name: 'SeriouslyFish', url: 'http://x', accessedDate: '2026-06-08' }, additional: [] },
  fish: { finNippy: false }, hobbyistAdvisory: null,
};

function renderAt(slug) {
  return render(
    <MemoryRouter initialEntries={[`/info/${slug}`]}>
      <Routes><Route path="/info/:slug" element={<SpeciesPage />} /></Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  global.fetch = jest.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({ success: true, item: record }) }));
});
afterEach(() => { jest.resetAllMocks(); });

test('fetches by slug and renders the record', async () => {
  renderAt('angelfish');
  await waitFor(() => expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Pterophyllum scalare'));
  expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('/api/species/angelfish'));
  expect(screen.getByText('A tall cichlid.')).toBeInTheDocument();
  expect(screen.getByText('Tall tank.')).toBeInTheDocument();
  expect(screen.getByText('Tetra')).toBeInTheDocument();
});

test('shows an error state on a failed fetch', async () => {
  global.fetch = jest.fn(() => Promise.resolve({ ok: false }));
  renderAt('nope');
  await waitFor(() => expect(screen.getByText(/couldn.t load|not found|error/i)).toBeInTheDocument());
});
