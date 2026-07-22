import React from 'react';
import { isMesophotic } from './format';

export function LocationChips({ regions = [], countries = [], depth }) {
  const [first, ...rest] = countries;
  return (
    <div className="species-range-chips">
      {regions.map((r) => <span key={r} className="species-rchip">🌎 {r}</span>)}
      {first && <span className="species-rchip">{first}</span>}
      {rest.length > 0 && (
        <span className="species-rchip species-rchip--more" tabIndex={0}>
          +{rest.length}
          <span className="species-more-pop">{rest.join(' · ')}</span>
        </span>
      )}
      {isMesophotic(depth) && (
        <span className="species-rchip species-rchip--meso">Mesophotic — dim light, decompression-sensitive</span>
      )}
    </div>
  );
}
