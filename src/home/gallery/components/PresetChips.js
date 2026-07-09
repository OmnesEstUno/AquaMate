import React from 'react';
import { PRESETS } from '../constants';

export function PresetChips({
  onApply,
  customPresets = [],
  pendingPresetId = null,
  onCommitName,
  onDelete,
}) {
  return (
    <div className="gallery-presets">
      <div className="gallery-presets__title">Presets</div>

      {PRESETS.map(p => (
        <button key={p.id} type="button" className="gallery-preset" onClick={() => onApply(p.state)}>
          {p.label}
        </button>
      ))}

      {customPresets.map(p => (
        p.id === pendingPresetId ? (
          <div key={p.id} className="gallery-preset gallery-preset--editing">
            <input
              type="text"
              autoFocus
              placeholder="Name this preset…"
              onBlur={(e) => onCommitName(p.id, e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') { e.currentTarget.blur(); }
                if (e.key === 'Escape') { onDelete(p.id); }
              }}
            />
          </div>
        ) : (
          <div key={p.id} className="gallery-preset gallery-preset--custom">
            <button
              type="button"
              className="gallery-preset__apply"
              onClick={() => onApply(p.state)}
            >
              {p.label || 'Untitled'}
            </button>
            <button
              type="button"
              className="gallery-preset__delete"
              onClick={() => onDelete(p.id)}
              aria-label={`Delete preset ${p.label || 'Untitled'}`}
              title="Delete preset"
            >
              ✕
            </button>
          </div>
        )
      ))}
    </div>
  );
}
