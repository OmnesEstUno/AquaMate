import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { CareLevelBadge } from './CareLevelBadge';
import { AdvisoryPill } from './AdvisoryPill';
import { AKAPill } from './AKAPill';
import { HoverTeaser } from './HoverTeaser';

export function GalleryCard({ item, query }) {
  const navigate = useNavigate();
  const [advisoryHovered, setAdvisoryHovered] = useState(false);
  const imgRef = useRef(null);

  return (
    <div
      className="card"
      onClick={() => navigate(`/info/${encodeURIComponent(item.commonName)}`)}
      style={{ cursor: 'pointer' }}
    >
      <div className="card__img-wrap" ref={imgRef}>
        <img src={item.image_url} alt={item.commonName} width="640" height="480" />
        <AdvisoryPill advisory={item.hobbyistAdvisory} onHoverChange={setAdvisoryHovered} />
        <CareLevelBadge level={item.careLevel} />
        <HoverTeaser summary={item.summary} imageRef={imgRef} suppressed={advisoryHovered} />
      </div>
      <div className="card-info">
        <AKAPill query={query} alsoKnownAs={item.alsoKnownAs} matchedVia={item.matchedVia} />
        <div className="card-info__row">
          <span>{item.commonName}</span>
        </div>
      </div>
    </div>
  );
}
