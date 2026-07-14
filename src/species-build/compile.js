const fs = require('fs');
const path = require('path');
const { globSync } = require('glob');

function emptyOutput() {
  return {
    fauna: {
      freshwater: { items: [] },
      saltwater:  { items: [] },
      brackish:   { items: [] }
    },
    flora: {
      freshwater: { items: [] },
      saltwater:  { items: [] },
      brackish:   { items: [] }
    }
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Index / detail split
//
// The Worker script size limit on Cloudflare's free tier is 3 MiB compressed.
// The full corpus with prose + sources gzips well past that (~3.4 MiB at 1,696
// species), so we ship a slim "index" bundled with the Worker and store the
// heavy prose as one JSON file per species in R2, fetched on demand by
// /api/species/:slug for detail-page views.
//
// The index keeps every field the gallery filters, facet counts, sort, search,
// and card render touch. Detail-only fields (long prose, research citations)
// are stripped from the index and written to per-species files instead.
// ─────────────────────────────────────────────────────────────────────────────

const DETAIL_ONLY_TOP_LEVEL = new Set([
  'careNotes',
  'breedingNotes',
  'sources',
]);

/**
 * Build the trimmed index record for one species.
 * Everything the runtime gallery touches stays; long-prose detail fields go.
 */
function toIndexRecord(entry) {
  const trimmed = {};
  for (const [key, value] of Object.entries(entry)) {
    if (DETAIL_ONLY_TOP_LEVEL.has(key)) continue;

    // nativeRange: keep structured fields, drop long-prose habitat description.
    if (key === 'nativeRange' && value && typeof value === 'object') {
      const { habitat, ...rest } = value;
      trimmed[key] = rest;
      continue;
    }

    // diet: keep the enum type (used by dietType filter), drop the prose notes.
    if (key === 'diet' && value && typeof value === 'object') {
      const { notes, ...rest } = value;
      trimmed[key] = rest;
      continue;
    }

    trimmed[key] = value;
  }
  return trimmed;
}

function compile({ speciesDir, indexOutPath, detailsOutDir }) {
  const out = emptyOutput();
  const detailFiles = [];

  if (fs.existsSync(speciesDir)) {
    const files = globSync('**/*.json', { cwd: speciesDir, absolute: true });
    for (const filePath of files) {
      const entry = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      const { kind, waterType, slug } = entry;
      if (!out[kind] || !out[kind][waterType]) {
        throw new Error(`Invalid kind/waterType combination in ${filePath}: ${kind}/${waterType}`);
      }
      if (!slug) {
        throw new Error(`Missing slug in ${filePath}`);
      }
      out[kind][waterType].items.push(toIndexRecord(entry));
      detailFiles.push({ slug, kind, entry });
    }
  }

  // Stable ordering — sort by id within each bucket
  for (const k of Object.keys(out)) {
    for (const w of Object.keys(out[k])) {
      out[k][w].items.sort((a, b) => a.id.localeCompare(b.id));
    }
  }

  // Write index
  fs.mkdirSync(path.dirname(indexOutPath), { recursive: true });
  fs.writeFileSync(indexOutPath, JSON.stringify(out, null, 2) + '\n');

  // Write per-species detail files (only if a detailsOutDir is provided).
  // These are uploaded to R2 separately via `npm run upload-species-details`.
  let detailCount = 0;
  if (detailsOutDir) {
    // Clean the target dir so orphan slugs (renamed/removed species) don't linger
    if (fs.existsSync(detailsOutDir)) {
      fs.rmSync(detailsOutDir, { recursive: true, force: true });
    }
    fs.mkdirSync(detailsOutDir, { recursive: true });
    for (const { slug, kind, entry } of detailFiles) {
      const kindDir = path.join(detailsOutDir, kind);
      fs.mkdirSync(kindDir, { recursive: true });
      fs.writeFileSync(
        path.join(kindDir, `${slug}.json`),
        JSON.stringify(entry, null, 2) + '\n'
      );
      detailCount++;
    }
  }

  return { totalItems: countItems(out), detailCount };
}

function countItems(out) {
  let n = 0;
  for (const k of Object.keys(out)) {
    for (const w of Object.keys(out[k])) {
      n += out[k][w].items.length;
    }
  }
  return n;
}

if (require.main === module) {
  const repoRoot = path.resolve(__dirname, '..', '..');
  const report = compile({
    speciesDir: path.join(repoRoot, 'src', 'species'),
    indexOutPath: path.join(repoRoot, 'dist', 'species.json'),
    detailsOutDir: path.join(repoRoot, 'dist', 'species-details'),
  });
  const indexBytes = fs.statSync(path.join(repoRoot, 'dist', 'species.json')).size;
  console.log(`Compiled ${report.totalItems} species entries into dist/species.json (${(indexBytes / 1024).toFixed(0)} KiB).`);
  console.log(`Wrote ${report.detailCount} per-species detail files into dist/species-details/<kind>/<slug>.json.`);
}

module.exports = { compile, emptyOutput, toIndexRecord };