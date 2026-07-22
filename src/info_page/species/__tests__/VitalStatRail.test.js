import React from 'react';
import { render, screen } from '@testing-library/react';
import { VitalStatRail } from '../VitalStatRail';

const angelfish = {
  taxon: 'fish',
  waterParameters: { temperatureC: { min: 24, max: 30 }, pH: { min: 6.5, max: 7.5 },
    gH: { min: 3, max: 15 }, kH: { min: 3, max: 12 }, salinity: null },
  adultSizeCm: { min: 12, max: 15 }, lifespanYears: { min: 8, max: 12 },
  tank: { minVolumeLiters: 200, minLengthCm: 100, swimZone: 'mid' },
  diet: { type: 'omnivore' },
  compatibility: { temperament: 'semi-aggressive', grouping: 'shoaling', minGroupSize: 1 },
  nativeRange: { depthRangeM: { min: 0, max: 3 } },
};

test('renders present stats and omits absent ones', () => {
  render(<VitalStatRail item={angelfish} />);
  expect(screen.getByText('24–30 °C')).toBeInTheDocument();
  expect(screen.getByText('3–15 gH')).toBeInTheDocument();
  expect(screen.getByText('Depth')).toBeInTheDocument();
  expect(screen.getByText('0–3 m')).toBeInTheDocument();
  expect(screen.queryByText(/sg/i)).not.toBeInTheDocument(); // no salinity
});
