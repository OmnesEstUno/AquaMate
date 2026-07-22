import React from 'react';

const LABELS = {
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
  expert: 'Expert',
};

/**
 * @param {string|null} level
 * @param {boolean} [active] — whether this level is currently in the careLevel filter
 * @param {function} [onClick] — when provided, badge becomes clickable and calls onClick with (level)
 */
export function CareLevelBadge({ level, active, onClick }) {
  if (!level || !LABELS[level]) return null;
  const clickable = typeof onClick === 'function';
  const classes = [
    'gallery-care',
    `gallery-care--${level}`,
    clickable ? 'is-clickable' : '',
    active ? 'is-active' : '',
  ].filter(Boolean).join(' ');
  const handleClick = clickable
    ? (e) => { e.stopPropagation(); onClick(level); }
    : undefined;
  return (
    <span
      className={classes}
      onClick={handleClick}
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
      aria-pressed={clickable ? !!active : undefined}
      title={clickable ? `Filter by ${LABELS[level]} care level` : undefined}
    >
      {LABELS[level]}
    </span>
  );
}
