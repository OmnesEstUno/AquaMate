import React from 'react';

/**
 * @param {string} label
 * @param {number} min
 * @param {number} max
 * @param {number} step
 * @param {'dual' | 'single-max'} mode
 * @param {{min?: number, max?: number}} value
 * @param {function(value): void} onChange
 * @param {function(number): string} [formatValue]
 */
export function RangeSlider({ label, min, max, step = 1, mode = 'dual', value, onChange, formatValue = (n) => `${n}` }) {
  const currentMin = value?.min ?? min;
  const currentMax = value?.max ?? max;

  const handleMin = (e) => {
    const v = Math.min(parseInt(e.target.value, 10), currentMax - step);
    onChange({ min: v, max: currentMax });
  };
  const handleMax = (e) => {
    const v = mode === 'dual' ? Math.max(parseInt(e.target.value, 10), currentMin + step) : parseInt(e.target.value, 10);
    onChange({ min: currentMin, max: v });
  };

  return (
    <div className="gallery-range">
      <div className="gallery-range__label">
        {label}
        <span className="gallery-range__value">
          {mode === 'dual'
            ? `${formatValue(currentMin)}–${formatValue(currentMax)}`
            : `≤ ${formatValue(currentMax)}`}
        </span>
      </div>
      <div className="gallery-range__slider">
        {mode === 'dual' && (
          <input type="range" min={min} max={max} step={step} value={currentMin} onChange={handleMin} />
        )}
        <input type="range" min={min} max={max} step={step} value={currentMax} onChange={handleMax} />
      </div>
    </div>
  );
}
