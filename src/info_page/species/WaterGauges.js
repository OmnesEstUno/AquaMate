import React from 'react';
import { formatRange } from './format';

// A gauge highlights the tolerated band on a fixed scale.
const SCALES = [
  { key: 'temperatureC', label: 'Temperature', unit: '°C', lo: 15, hi: 32 },
  { key: 'pH', label: 'pH', unit: '', lo: 6, hi: 9 },
  { key: 'gH', label: 'Hardness (gH)', unit: '', lo: 0, hi: 20 },
  { key: 'salinity', label: 'Salinity (sg)', unit: '', lo: 1.015, hi: 1.03 },
];

export function WaterGauges({ waterParameters = {} }) {
  const gauges = SCALES
    .map((s) => ({ ...s, range: waterParameters[s.key] }))
    .filter((s) => s.range && s.range.min != null && s.range.max != null);
  return (
    <>
      {gauges.map(({ key, label, unit, lo, hi, range }) => {
        const left = ((range.min - lo) / (hi - lo)) * 100;
        const width = Math.max(((range.max - range.min) / (hi - lo)) * 100, 3);
        return (
          <div className="species-gauge" key={key}>
            <div className="species-gauge__top"><span>{label}</span><span>{formatRange(range, unit)}</span></div>
            <div className="species-gauge__track"><div className="species-gauge__fill" style={{ left: `${left}%`, width: `${width}%` }} /></div>
          </div>
        );
      })}
    </>
  );
}
