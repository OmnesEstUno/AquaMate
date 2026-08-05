import React, { useState } from 'react';

const CONFIG = {
  'specialist-only':      { label: 'Specialist', icon: '⚠', modifier: 'specialist' },
  'legally-restricted':   { label: 'Restricted', icon: '⚖', modifier: 'restricted' },
  'public-aquarium-only': { label: 'XL',         icon: '⚑', modifier: 'xl' },
  'pond-only':            { label: 'Pond',       icon: '⚘', modifier: 'pond' },
};

export function AdvisoryPill({ advisory, onHoverChange, active, onClick }) {
  const [hovered, setHovered] = useState(false);

  if (!advisory || !CONFIG[advisory.level]) return null;
  const cfg = CONFIG[advisory.level];
  const clickable = typeof onClick === 'function';

  const setHover = (v) => {
    setHovered(v);
    if (onHoverChange) onHoverChange(v);
  };

  const handleClick = clickable
    ? (e) => { e.stopPropagation(); onClick(advisory.level); }
    : undefined;

  const classes = [
    'gallery-advisory',
    `gallery-advisory--${cfg.modifier}`,
    clickable ? 'is-clickable' : '',
    active ? 'is-active' : '',
  ].filter(Boolean).join(' ');

  return (
    <span
      className={classes}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={handleClick}
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
      aria-pressed={clickable ? !!active : undefined}
      title={clickable ? `Filter by ${cfg.label}` : undefined}
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
