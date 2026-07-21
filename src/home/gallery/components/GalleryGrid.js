import React from 'react';
import { useNavigate } from 'react-router-dom';
import { GalleryCard } from './GalleryCard';

export function GalleryGrid({ items }) {
  const navigate = useNavigate();
  return (
    <div className="gallery">
      {items.map((item) => (
        <GalleryCard
          key={item.id}
          item={item}
          onOpen={() => navigate(`/info/${encodeURIComponent(item.commonName)}`)}
        />
      ))}
    </div>
  );
}
