import React from 'react';

const LABELS = {
  'specialist-only': 'Specialist-only',
  'legally-restricted': 'Legally-restricted',
  'public-aquarium-only': 'Public-aquarium-only',
  'pond-only': 'Pond-only',
};

export function AdvisoryBanner({ advisory }) {
  if (!advisory || !advisory.level) return null;
  return (
    <div className={`species-advisory ${advisory.level}`} role="note">
      <span className="species-advisory__ic" aria-hidden="true">⚠️</span>
      <span>
        <b>Hobbyist advisory — {LABELS[advisory.level] || advisory.level}</b>
        {advisory.reason}
      </span>
    </div>
  );
}
