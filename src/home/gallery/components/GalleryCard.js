import React, { useState } from 'react';

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
  const src = chain[idx] || null;

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
