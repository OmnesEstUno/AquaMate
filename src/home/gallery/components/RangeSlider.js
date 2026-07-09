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

  const clampMin = (v) => Math.max(min, Math.min(v, currentMax - step));
  const clampMax = (v) => {
    if (mode === 'dual') return Math.min(max, Math.max(v, currentMin + step));
    return Math.max(min, Math.min(v, max));
  };

  const setMin = (v) => onChange({ min: clampMin(v), max: currentMax });
  const setMax = (v) => onChange({ min: currentMin, max: clampMax(v) });

  const StepperRow = ({ value: v, onDec, onInc, canDec, canInc }) => (
    <div className="gallery-range__stepper-row">
      <button
        type="button"
        className="gallery-range__step-btn"
        onClick={onDec}
        disabled={!canDec}
        aria-label="Decrease"
      >−</button>
      <span className="gallery-range__step-value">{formatValue(v)}</span>
      <button
        type="button"
        className="gallery-range__step-btn"
        onClick={onInc}
        disabled={!canInc}
        aria-label="Increase"
      >+</button>
    </div>
  );

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
          <>
            <StepperRow
              value={currentMin}
              onDec={() => setMin(currentMin - step)}
              onInc={() => setMin(currentMin + step)}
              canDec={currentMin > min}
              canInc={currentMin + step < currentMax}
            />
            <input type="range" min={min} max={max} step={step} value={currentMin} onChange={(e) => setMin(parseInt(e.target.value, 10))} />
          </>
        )}
        <input type="range" min={min} max={max} step={step} value={currentMax} onChange={(e) => setMax(parseInt(e.target.value, 10))} />
        <StepperRow
          value={currentMax}
          onDec={() => setMax(currentMax - step)}
          onInc={() => setMax(currentMax + step)}
          canDec={mode === 'dual' ? currentMax - step > currentMin : currentMax > min}
          canInc={currentMax < max}
        />
      </div>
    </div>
  );
}
