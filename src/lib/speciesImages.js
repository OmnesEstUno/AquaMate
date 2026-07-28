// Shared species image helpers, used by the gallery card and the species page.

// R2 public bucket domains by kind (mirror of worker.js R2_DOMAINS). Only needed
// client-side when the detail endpoint returns a raw record without image_url.
export const R2_DOMAINS = {
  fauna: 'https://pub-eaf7b96d5e4d42869407498cf5b931e0.r2.dev',
  flora: 'https://pub-40c047642c084c80857179b0032563e5.r2.dev',
};

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

// Builds the R2 URL for an item's resolved primary image (item.media.primaryImage),
// using the domain keyed by item.kind. Returns null when there's no primary image.
export function resolvePrimaryImageUrl(item, domains = R2_DOMAINS) {
  const primary = item?.media?.primaryImage;
  if (!primary) return null;
  const domain = domains[item?.kind] || domains.fauna;
  const filename = primary.startsWith('/') ? primary.slice(1) : primary;
  return `${domain}/${filename}`;
}

// "<author> · <source> · <license>" — author best-effort parsed from the note's leading clause.
export function candidateCredit(cand) {
  const parts = [];
  if (cand.notes) {
    let author = String(cand.notes)
      .split(/[.;]/)[0]
      .trim()
      .replace(/^\(c\)\s*/i, '')
      .replace(/^©\s*/, '')
      .replace(/^photo(graph)?\s+by\s+/i, '')
      .replace(/^by\s+/i, '')
      .replace(/\s*\(cc[^)]*\)\s*$/i, '')
      .trim();
    if (author && author.length <= 60 && /^[A-Z(]/.test(author)) parts.push(author);
  }
  if (cand.source) parts.push(cand.source);
  if (cand.license) parts.push(cand.license);
  return parts.join(' · ');
}

// Ordered { thumb, full, credit } list for the species detail page: resolved
// primary (R2) first, then each imageCandidate.
// Ordered { thumb, full, credit } list. The CC image candidates are the reliable
// source (the reviewer's `recommended` pick leads); the R2 `primaryImage` is used
// ONLY as a last resort when a species has no candidates. Most `primaryImage`
// files are not (yet) uploaded to R2, so requesting one 404s — which also trips
// Firefox's OpaqueResponseBlocking. Leading with candidates avoids that entirely.
export function buildSpeciesImages(item, domains = R2_DOMAINS) {
  const cands = Array.isArray(item?.media?.imageCandidates) ? item.media.imageCandidates : [];
  const ordered = [...cands].sort(
    (a, b) => (b && b.recommended ? 1 : 0) - (a && a.recommended ? 1 : 0)
  );
  const out = [];
  for (const c of ordered) {
    if (!c || !c.url) continue;
    out.push({ thumb: thumbnailize(c.url), full: c.url, credit: candidateCredit(c) });
  }
  if (out.length) return out;
  const primary = resolvePrimaryImageUrl(item, domains);
  if (primary) return [{ thumb: thumbnailize(primary), full: primary, credit: 'Primary image' }];
  return [];
}
