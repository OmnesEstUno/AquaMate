import React, { useState } from 'react';

const CONFIG = {
  'specialist-only':      { label: 'Specialist', icon: '⚠', modifier: 'specialist' },
  'legally-restricted':   { label: 'Restricted', icon: '⚖', modifier: 'restricted' },
  'public-aquarium-only': { label: 'XL',         icon: '⚑', modifier: 'xl' },
  'pond-only':            { label: 'Pond',       icon: '⚘', modifier: 'pond' },
};

export function AdvisoryPill({ advisory, onHoverChange }) {
  const [hovered, setHovered] = useState(false);

  if (!advisory || !CONFIG[advisory.level]) return null;
  const cfg = CONFIG[advisory.level];

  const setHover = (v) => {
    setHovered(v);
    if (onHoverChange) onHoverChange(v);
  };

  return (
    <span
      className={`gallery-advisory gallery-advisory--${cfg.modifier}`}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <span className="gallery-advisory__icon" aria-hidden="true">{cfg.icon}</span>
      <span className="gallery-advisory__label">{cfg.label}</span>
      {hovered && advisory.reason && (
        <span className="gallery-advisory__reason" role="tooltip">
          {advisory.reason}
        </span>
      )}
    </span>
  );
}
