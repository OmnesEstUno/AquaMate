import React from 'react';
import { GalleryCard } from './GalleryCard';

export function GalleryGrid({ items, query, activeCareLevels, activeAdvisoryLevels, onToggleFilter }) {
  return (
    <div className="gallery">
      {items.map((item) => (
        <GalleryCard
          key={item.id}
          item={item}
          query={query}
          activeCareLevels={activeCareLevels}
          activeAdvisoryLevels={activeAdvisoryLevels}
          onToggleFilter={onToggleFilter}
        />
      ))}
    </div>
  );
}
