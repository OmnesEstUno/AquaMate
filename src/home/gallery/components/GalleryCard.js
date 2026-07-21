import React, { useState } from 'react';

// Rewrite full-resolution CC-source URLs to a bounded-width thumbnail so the
// gallery grid loads small images instead of multi-megapixel originals — 24
// originals per page can decode to >1 GB of bitmaps and freeze the machine.
// Hosts we have no rule for (and the user's own R2 images) pass through unchanged.
export function thumbnailize(url, width = 640) {
  if (!url) return url;
  // Wikimedia Commons original -> /thumb/<shard>/<file>/<width>px-<file>
  //   .../commons/c/c0/Name.jpg -> .../commons/thumb/c/c0/Name.jpg/640px-Name.jpg
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

// Presentational gallery card. Router-free so it can be unit-tested directly;
// GalleryGrid supplies onOpen with navigation.
export function GalleryCard({ item, onOpen }) {
  const chain = buildImageChain(item);
  // Index into `chain`; advanced on load error until we run out of URLs.
  const [idx, setIdx] = useState(0);
  const raw = chain[idx] || null;
  const src = raw ? thumbnailize(raw) : null;

  return (
    <div className="card" onClick={onOpen} style={{ cursor: 'pointer' }}>
      {src ? (
        <img
          src={src}
          alt={item.commonName}
          width="640"
          height="480"
          loading="lazy"
          onError={() => setIdx((i) => i + 1)}
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
      <div className="card-info">
        <span>{item.commonName}</span>
      </div>
    </div>
  );
}
