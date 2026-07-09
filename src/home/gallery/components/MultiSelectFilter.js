import React, { useState, useRef, useEffect } from 'react';

/**
 * @param {string} label — e.g. "Taxon"
 * @param {string[]} options — full list of option values
 * @param {string[]} selected — currently selected values
 * @param {Object<string, number>} counts — { optionValue: count } for facet display
 * @param {function(string[]): void} onChange — new selection
 * @param {function(string): string} [labelFor] — optional pretty-print for option values
 */
export function MultiSelectFilter({ label, options, selected, counts, onChange, labelFor = (o) => o }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onClickOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [open]);

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
    <div className="gallery-msf" ref={ref}>
      <button
        type="button"
        className={`gallery-msf__toggle ${selectedCount > 0 ? 'is-active' : ''}`}
        onClick={() => setOpen(o => !o)}
      >
        {buttonLabel} <span className="gallery-msf__chevron">{open ? '▴' : '▾'}</span>
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
