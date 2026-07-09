import React from 'react';
import { PRESETS } from '../constants';

export function PresetChips({ onApply }) {
  return (
    <div className="gallery-presets">
      {PRESETS.map(p => (
        <button key={p.id} type="button" className="gallery-preset" onClick={() => onApply(p.state)}>
          {p.label}
        </button>
      ))}
    </div>
  );
}
