import React from 'react';

export function AKAPill({ query, alsoKnownAs, matchedVia }) {
  if (!query || !query.trim()) return null;
  if (matchedVia !== 'alsoKnownAs') return null;
  const list = Array.isArray(alsoKnownAs) ? alsoKnownAs : [];
  if (list.length === 0) return null;
  const needle = query.toLowerCase().trim();
  const matched = list.find(x => typeof x === 'string' && x.toLowerCase().includes(needle));
  if (!matched) return null;
  return (
    <span className="gallery-aka">
      also known as: <span className="gallery-aka__name">{matched}</span>
    </span>
  );
}
