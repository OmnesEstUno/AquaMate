import React from 'react';
import { formatRange, titleCase, depthStat } from './format';

// Build [icon, label, value] rows, skipping anything absent.
function buildStats(item) {
  const wp = item.waterParameters || {};
  const t = item.tank || {};
  const c = item.compatibility || {};
  const rows = [];
  const add = (icon, label, value) => { if (value != null && value !== '') rows.push([icon, label, value]); };
  add('🌡️', 'Temp', formatRange(wp.temperatureC, '°C'));
  add('⚗️', 'pH', formatRange(wp.pH, ''));
  add('💧', 'Hardness', formatRange(wp.gH, 'gH'));
  add('🔬', 'kH', formatRange(wp.kH, ''));
  add('🧂', 'Salinity', formatRange(wp.salinity, 'sg'));
  add('📏', 'Adult size', formatRange(item.adultSizeCm, 'cm'));
  add('⏳', 'Lifespan', formatRange(item.lifespanYears, 'yr'));
  add('🪣', 'Min tank', t.minVolumeLiters != null ? `${t.minVolumeLiters} L` : null);
  add('↔️', 'Min length', t.minLengthCm != null ? `${t.minLengthCm} cm` : null);
  add('🐟', 'Swim zone', t.swimZone && titleCase(t.swimZone));
  add('🍽️', 'Diet', item.diet && item.diet.type && titleCase(item.diet.type));
  add('😐', 'Temperament', c.temperament && titleCase(c.temperament));
  add('👥', 'Grouping', c.grouping && titleCase(c.grouping));
  add('🔢', 'Min group', c.minGroupSize != null && c.minGroupSize > 1 ? `${c.minGroupSize}` : null);
  add('⬇️', 'Depth', depthStat(item.nativeRange && item.nativeRange.depthRangeM));
  return rows;
}

export function VitalStatRail({ item }) {
  const stats = buildStats(item);
  return (
    <div className="species-rail">
      {stats.map(([icon, label, value]) => (
        <div className="species-stat" key={label}>
          <span className="species-stat__ico" aria-hidden="true">{icon}</span>
          <span className="species-stat__txt">
            <span className="species-stat__k">{label}</span>
            <span className="species-stat__v">{value}</span>
          </span>
        </div>
      ))}
    </div>
  );
}
