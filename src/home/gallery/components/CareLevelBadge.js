import React from 'react';

const LABELS = {
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
  expert: 'Expert',
};

export function CareLevelBadge({ level }) {
  if (!level || !LABELS[level]) return null;
  return (
    <span className={`gallery-care gallery-care--${level}`}>
      {LABELS[level]}
    </span>
  );
}
