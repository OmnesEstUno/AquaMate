import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { CareLevelBadge } from './CareLevelBadge';
import { AdvisoryPill } from './AdvisoryPill';
import { AKAPill } from './AKAPill';
import { HoverTeaser } from './HoverTeaser';
import { thumbnailize, buildImageChain } from '../../../lib/speciesImages';

export function GalleryCard({ item, query, activeCareLevels, activeAdvisoryLevels, onToggleFilter }) {
  const navigate = useNavigate();
  const [advisoryHovered, setAdvisoryHovered] = useState(false);
  const imgRef = useRef(null);
  const careActive = activeCareLevels?.includes(item.careLevel);
  const advisoryActive = activeAdvisoryLevels?.includes(item.hobbyistAdvisory?.level);
  const handleCareClick = onToggleFilter ? (lvl) => onToggleFilter('careLevel', lvl) : undefined;
  const handleAdvisoryClick = onToggleFilter ? (lvl) => onToggleFilter('advisoryLevel', lvl) : undefined;

  // Image fallback chain: position in `chain` plus whether we've fallen back to
  // the raw original for the current url. On error we first retry the same
  // candidate at full size (covers a thumbnail that 400s — e.g. an original
  // smaller than the thumb width), then advance to the next candidate's thumb.
  const chain = buildImageChain(item);
  const [pos, setPos] = useState({ idx: 0, raw: false });
  const rawUrl = chain[pos.idx] || null;
  const src = rawUrl ? (pos.raw ? rawUrl : thumbnailize(rawUrl)) : null;

  const handleImageError = () => {
    setPos((p) => {
      const cur = chain[p.idx];
      // Showed a thumbnail and a distinct original exists -> try the original.
      if (!p.raw && cur && thumbnailize(cur) !== cur) {
        return { idx: p.idx, raw: true };
      }
      // Otherwise move on to the next candidate (as a thumbnail again).
      return { idx: p.idx + 1, raw: false };
    });
  };

  return (
    <div
      className="card glass-panel--card"
      onClick={() => navigate(`/info/${encodeURIComponent(item.slug)}`)}
      style={{ cursor: 'pointer' }}
    >
      <div className="card__img-wrap" ref={imgRef}>
        {src ? (
          <img
            src={src}
            alt={item.commonName}
            width="640"
            height="480"
            loading="lazy"
            onError={handleImageError}
          />
        ) : (
          <div
            className="card-noimage"
            role="img"
            aria-label={`No image available for ${item.commonName}`}
          >
            No image yet
          </div>
        )}
        <AdvisoryPill
          advisory={item.hobbyistAdvisory}
          onHoverChange={setAdvisoryHovered}
          active={advisoryActive}
          onClick={handleAdvisoryClick}
        />
        <CareLevelBadge
          level={item.careLevel}
          active={careActive}
          onClick={handleCareClick}
        />
        <HoverTeaser summary={item.summary} imageRef={imgRef} suppressed={advisoryHovered} />
      </div>
      <div className="card-info">
        <div className="card-info__row">
          <span className="card-info__name">{item.commonName}</span>
        </div>
        <AKAPill query={query} alsoKnownAs={item.alsoKnownAs} matchedVia={item.matchedVia} />
      </div>
    </div>
  );
}
