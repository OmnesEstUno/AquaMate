import React from 'react';

const LABEL_FORMATTERS = {
  taxa: (v) => `Taxa: ${v.join(', ')}`,
  waterType: (v) => `Water: ${v.join(', ')}`,
  careLevel: (v) => `Care: ${v.join(', ')}`,
  temperament: (v) => `Temperament: ${v.join(', ')}`,
  grouping: (v) => `Grouping: ${v.join(', ')}`,
  dietType: (v) => `Diet: ${v.join(', ')}`,
  co2: (v) => `CO₂: ${v.join(', ')}`,
  lighting: (v) => `Lighting: ${v.join(', ')}`,
  minSize: (v) => `≥ ${v} cm`,
  maxSize: (v) => `≤ ${v} cm`,
  maxTankL: (v) => `Tank ≤ ${v} L`,
  reefSafe: () => 'Reef-safe',
  hideAdvisory: () => 'Hide specialist-only',
};

const ORDER = ['taxa', 'waterType', 'careLevel', 'minSize', 'maxSize', 'maxTankL',
                'temperament', 'grouping', 'dietType', 'co2', 'lighting', 'reefSafe', 'hideAdvisory'];

export function ActiveFilterPills({ state, onRemove, onClearAll, onSavePreset }) {
  const active = ORDER.filter(key => {
    const v = state[key];
    if (Array.isArray(v)) return v.length > 0;
    return v != null && v !== false;
  });

  if (active.length === 0) return null;

  return (
    <div className="gallery-pills">
      {active.map(key => (
        <span key={key} className="gallery-pill">
          {LABEL_FORMATTERS[key](state[key])}
          <button type="button" className="gallery-pill__remove" onClick={() => onRemove(key)} aria-label="Remove filter">
            ✕
          </button>
        </span>
      ))}
      <button type="button" className="gallery-pill__action" onClick={onClearAll}>
        ✕ Clear all
      </button>
      {onSavePreset && (
        <button type="button" className="gallery-pill__action gallery-pill__save" onClick={onSavePreset}>
          ★ Save as preset
        </button>
      )}
    </div>
  );
}
