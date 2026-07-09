import React from 'react';
import { useNavigate } from 'react-router-dom';

export function GalleryGrid({ items }) {
  const navigate = useNavigate();
  return (
    <div className="gallery">
      {items.map((item) => (
        <div
          key={item.id}
          className="card"
          onClick={() => navigate(`/info/${encodeURIComponent(item.commonName)}`)}
          style={{ cursor: 'pointer' }}
        >
          <img src={item.image_url} alt={item.commonName} width="640" height="480" />
          <div className="card-info">
            <span>{item.commonName}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
