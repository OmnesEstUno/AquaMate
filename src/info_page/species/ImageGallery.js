import React, { useState, useRef, useEffect, useCallback } from 'react';

// Find the next non-broken index in `dir` direction, or return `from` if none.
function stepLive(from, dir, brokenMap, len) {
  let i = from;
  for (let k = 0; k < len; k++) {
    i = (i + dir + len) % len;
    if (!brokenMap[i]) return i;
  }
  return from;
}

export function ImageGallery({ images, alt }) {
  const [expanded, setExpanded] = useState(false);
  const [idx, setIdx] = useState(0);
  const [broken, setBroken] = useState({}); // original index -> failed to load
  const [raw, setRaw] = useState({});       // original index -> use full instead of thumb
  const dragStart = useRef(null);
  const dragged = useRef(false);
  const brokenRef = useRef(broken);
  brokenRef.current = broken;

  const n = images.length;
  const next = useCallback(() => setIdx((i) => stepLive(i, +1, brokenRef.current, n)), [n]);
  const prev = useCallback(() => setIdx((i) => stepLive(i, -1, brokenRef.current, n)), [n]);
  const open = () => setExpanded(true);
  const close = () => {
    setExpanded(false);
    const f = images.findIndex((_, i) => !brokenRef.current[i]);
    setIdx(f < 0 ? 0 : f);
  };

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

  const allBroken = n > 0 && Object.keys(broken).length >= n;
  if (n === 0 || allBroken) {
    return (
      <figure className="species-fig">
        <div className="species-noimage" role="img" aria-label={`No image available for ${alt}`}>No image yet</div>
      </figure>
    );
  }

  const cur = images[idx] || images[0];
  const src = (expanded || raw[idx]) ? cur.full : cur.thumb;

  const handleError = () => {
    // Collapsed thumbnail that failed (e.g. a Wikimedia upscale 400) — retry full-res first.
    if (!expanded && !raw[idx] && cur.full !== cur.thumb) {
      setRaw((r) => ({ ...r, [idx]: true }));
      return;
    }
    // Otherwise mark broken and skip to the next image that still loads.
    setBroken((b) => {
      const nb = { ...b, [idx]: true };
      brokenRef.current = nb;
      const nxt = stepLive(idx, +1, nb, n);
      if (nxt !== idx) setIdx(nxt);
      return nb;
    });
  };

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
          src={src}
          alt={alt}
          onError={handleError}
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
          <img key={i} className={`species-g-thumb ${i === idx ? 'active' : ''}`} src={im.thumb} alt="" hidden={!!broken[i]}
               onClick={() => setIdx(i)} />
        ))}
      </div>
      <figcaption className="species-credit">
        {expanded ? `${cur.credit} · ${idx + 1} of ${n}` : `${cur.credit} · ${n} photo${n > 1 ? 's' : ''} — click to browse`}
      </figcaption>
    </figure>
  );
}
