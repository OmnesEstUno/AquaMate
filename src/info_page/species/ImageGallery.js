import React, { useState, useRef, useEffect, useCallback } from 'react';

export function ImageGallery({ images, alt }) {
  const [expanded, setExpanded] = useState(false);
  const [idx, setIdx] = useState(0);
  const dragStart = useRef(null);
  const dragged = useRef(false);

  const n = images.length;
  const next = useCallback(() => setIdx((i) => (i + 1) % n), [n]);
  const prev = useCallback(() => setIdx((i) => (i - 1 + n) % n), [n]);
  const open = () => { setIdx(0); setExpanded(true); };
  const close = () => setExpanded(false);

  useEffect(() => {
    if (!expanded) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') close();
      else if (e.key === 'ArrowRight') next();
      else if (e.key === 'ArrowLeft') prev();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [expanded, next, prev]);

  if (n === 0) {
    return (
      <figure className="species-fig">
        <div className="species-noimage" role="img" aria-label={`No image available for ${alt}`}>No image yet</div>
      </figure>
    );
  }

  const cur = images[idx];
  const onImgClick = () => {
    if (!expanded) { open(); return; }
    if (dragged.current) { dragged.current = false; return; }
    next();
  };
  const onDown = (e) => { if (expanded) { dragStart.current = e.clientX; dragged.current = false; } };
  const onMove = (e) => { if (dragStart.current != null && Math.abs(e.clientX - dragStart.current) > 10) dragged.current = true; };
  const onUp = (e) => {
    if (dragStart.current == null) return;
    const dx = e.clientX - dragStart.current; dragStart.current = null;
    if (Math.abs(dx) > 40) (dx < 0 ? next() : prev());
  };

  return (
    <figure className={`species-fig ${expanded ? 'is-expanded' : ''}`}>
      <div className="species-gwrap">
        <img
          className="species-hero-img"
          src={expanded ? cur.full : images[0].thumb}
          alt={alt}
          onClick={onImgClick}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
        />
        <button className="species-g-arrow species-g-prev" aria-label="Previous" hidden={!expanded} onClick={(e) => { e.stopPropagation(); prev(); }}>‹</button>
        <button className="species-g-arrow species-g-next" aria-label="Next" hidden={!expanded} onClick={(e) => { e.stopPropagation(); next(); }}>›</button>
        <button className="species-g-close" aria-label="Close" hidden={!expanded} onClick={(e) => { e.stopPropagation(); close(); }}>✕</button>
        <span className="species-g-counter" hidden={!expanded}>{idx + 1} / {n}</span>
      </div>
      <div className="species-g-thumbs" hidden={!expanded}>
        {images.map((im, i) => (
          <img key={i} className={`species-g-thumb ${i === idx ? 'active' : ''}`} src={im.thumb} alt=""
               onClick={() => setIdx(i)} />
        ))}
      </div>
      <figcaption className="species-credit">
        {expanded ? `${cur.credit} · ${idx + 1} of ${n}` : `${images[0].credit} · ${n} photo${n > 1 ? 's' : ''} — click to browse`}
      </figcaption>
    </figure>
  );
}
