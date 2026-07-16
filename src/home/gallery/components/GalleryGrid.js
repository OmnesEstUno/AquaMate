import React from 'react';
import { GalleryCard } from './GalleryCard';

export function GalleryGrid({ items, query }) {
  return (
    <div className="gallery">
      {items.map((item) => (
        <GalleryCard key={item.id} item={item} query={query} />
      ))}
    </div>
  );
}
