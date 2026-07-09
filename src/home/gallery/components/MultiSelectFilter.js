import React, { useState } from 'react';

/**
 * Accordion-style multi-select filter. Options expand INLINE below the toggle
 * (not as a floating dropdown) so nothing gets clipped by a scrolling sidebar.
 *
 * @param {string} label
 * @param {string[]} options
 * @param {string[]} selected
 * @param {Object<string, number>} counts
 * @param {function(string[]): void} onChange
 * @param {function(string): string} [labelFor]
 */
export function MultiSelectFilter({ label, options, selected, counts, onChange, labelFor = (o) => o }) {
  const [open, setOpen] = useState(false);

  const toggle = (option) => {
    const set = new Set(selected);
    if (set.has(option)) set.delete(option); else set.add(option);
    onChange([...set]);
  };

  const selectedCount = selected.length;
  const buttonLabel = selectedCount === 0 ? label
    : selectedCount === 1 ? `${label}: ${labelFor(selected[0])}`
    : `${label} (${selectedCount})`;

  return (
    <div className={`gallery-msf ${open ? 'is-open' : ''}`}>
      <button
        type="button"
        className={`gallery-msf__toggle ${selectedCount > 0 ? 'is-active' : ''}`}
        onClick={() => setOpen(o => !o)}
      >
        <span className="gallery-msf__toggle-label">{buttonLabel}</span>
        <span className="gallery-msf__chevron">{open ? '▴' : '▾'}</span>
      </button>
      {open && (
        <div className="gallery-msf__menu">
          {options.map(option => {
            const count = counts?.[option] ?? 0;
            const isSelected = selected.includes(option);
            return (
              <label
                key={option}
                className={`gallery-msf__option ${count === 0 ? 'is-zero' : ''}`}
              >
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => toggle(option)}
                />
                <span className="gallery-msf__option-name">{labelFor(option)}</span>
                <span className="gallery-msf__option-count">({count})</span>
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}
