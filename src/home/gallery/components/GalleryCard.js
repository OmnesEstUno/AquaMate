import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { CareLevelBadge } from './CareLevelBadge';
import { AdvisoryPill } from './AdvisoryPill';
import { AKAPill } from './AKAPill';
import { HoverTeaser } from './HoverTeaser';

// Rewrite full-resolution CC-source URLs to a bounded-width thumbnail so the
// gallery grid loads small images instead of multi-megapixel originals — 24
// originals per page can decode to >1 GB of bitmaps and freeze the machine.
// Hosts we have no rule for (and the user's own R2 images) pass through unchanged.
//
// NOTE: Wikimedia only renders thumbnails at a fixed set of standard widths and
// returns HTTP 400 for anything else (e.g. 640, 320, 800). 500 is an allowed
// size; do not change it to an arbitrary value without re-checking the whitelist.
export function thumbnailize(url, width = 500) {
  if (!url) return url;
  // Wikimedia Commons original -> /thumb/<shard>/<file>/<width>px-<file>
  //   .../commons/c/c0/Name.jpg -> .../commons/thumb/c/c0/Name.jpg/500px-Name.jpg
  const wm = url.match(
    /^(https?:\/\/upload\.wikimedia\.org\/wikipedia\/commons)\/([0-9a-f])\/([0-9a-f]{2})\/([^/?#]+)$/i
  );
  if (wm) {
    const [, base, a, ab, file] = wm;
    const ext = file.split('.').pop().toLowerCase();
    // SVG/TIFF thumbnails are re-encoded, so the thumb filename gains an extension.
    const thumbName = ext === 'svg' ? `${file}.png` : ext === 'tif' || ext === 'tiff' ? `${file}.jpg` : file;
    return `${base}/thumb/${a}/${ab}/${file}/${width}px-${thumbName}`;
  }
  // iNaturalist: original/large (up to full res) -> medium (~500px)
  if (/inaturalist.*\/photos\/\d+\/(original|large)\.\w+/i.test(url)) {
    return url.replace(/\/(original|large)\.(\w+)/i, '/medium.$2');
  }
  return url;
}

// Ordered list of image URLs to try for an item: the server-picked image_url
// first (R2 primary, or a random candidate when there's no primary), then the
// remaining candidate URLs. This lets a broken/404 primary fall back to a
// candidate on the client, since the server can't know a URL will fail to load.
export function buildImageChain(item) {
  const candidateUrls = Array.isArray(item.media?.imageCandidates)
    ? item.media.imageCandidates.map((c) => c && c.url).filter(Boolean)
    : [];
  const chain = [];
  if (item.image_url) chain.push(item.image_url);
  for (const url of candidateUrls) {
    if (!chain.includes(url)) chain.push(url);
  }
  return chain;
}

export function GalleryCard({ item, query }) {
  const navigate = useNavigate();
  const [advisoryHovered, setAdvisoryHovered] = useState(false);
  const imgRef = useRef(null);

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
      className="card"
      onClick={() => navigate(`/info/${encodeURIComponent(item.commonName)}`)}
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
