#!/usr/bin/env node
// Finalize the fish-freshwater Stage A manifest:
//   1. Read consolidated.json (558 entries)
//   2. Assign popularity score (source-tier + existing-placeholder bonus)
//   3. Assign slugs and fw-fish-NNN IDs ordered by popularity desc
//   4. Write final manifest to src/species-build/discovery/fish-freshwater.json
//   5. Write dispatch plan to .dispatch-prompts-fish-fw/dispatch.json

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..', '..', '..', '..');
const CONSOLIDATED = path.join(__dirname, 'consolidated.json');
const FINAL_MANIFEST = path.join(ROOT, 'src/species-build/discovery/fish-freshwater.json');
const DISPATCH_DIR = path.join(ROOT, '.dispatch-prompts-fish-fw');
const DISPATCH_FILE = path.join(DISPATCH_DIR, 'dispatch.json');

function readJson(p) { return JSON.parse(fs.readFileSync(p, 'utf8')); }

function slugify(s) {
  return s.toLowerCase()
    .replace(/['"\.]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function popularityScore(e) {
  let score = 0;
  // Source coverage: 4 sources = 8, 3 = 6, 2 = 4, 1 = 2
  const realSources = e.sources.filter(s => s !== 'existing-placeholder');
  if (realSources.length >= 4) score += 8;
  else if (realSources.length === 3) score += 6;
  else if (realSources.length === 2) score += 4;
  else if (realSources.length === 1) score += 2;
  // Existing-placeholder bonus (user-curated)
  if (e.existingPlaceholder) score += 2;
  return score;
}

function main() {
  const cons = readJson(CONSOLIDATED);
  const entries = cons.entries.map(e => ({
    commonName: e.commonName,
    scientificName: e.scientificName,
    family: e.family,
    categoryGroup: e.categoryGroup,
    sources: e.sources,
    sourceCount: e.sourceCount,
    primarySourceUrl: e.primarySourceUrl,
    imageUrl: e.imageUrl,
    existingPlaceholder: e.existingPlaceholder || null,
    popularityScore: popularityScore(e),
    slug: slugify(e.commonName),
    notes: e.notes,
  }));

  // Sort by popularityScore desc, then by commonName
  entries.sort((a, b) => {
    if (b.popularityScore !== a.popularityScore) return b.popularityScore - a.popularityScore;
    return a.commonName.localeCompare(b.commonName);
  });

  // Assign IDs (fw-fish-NNN)
  entries.forEach((e, i) => {
    const num = String(i + 1).padStart(3, '0');
    e.id = `fw-fish-${num}`;
  });

  // Tier distribution
  const tiers = {};
  for (const e of entries) tiers[e.popularityScore] = (tiers[e.popularityScore] || 0) + 1;
  console.log('Tier distribution:');
  for (const [t, c] of Object.entries(tiers).sort((a, b) => b[0] - a[0])) {
    console.log(`  score ${t}: ${c}`);
  }

  // Final manifest
  const manifestOut = {
    meta: {
      slice: 'fish-freshwater',
      generatedDate: '2026-06-08',
      sources: cons.meta.sources,
      seriouslyFishNote: cons.meta.seriouslyFishNote,
      stats: { ...cons.meta.stats, finalCount: entries.length },
      popularityScoring: 'Source-tier (4 src=8, 3=6, 2=4, 1=2) + existing-placeholder bonus (+2)',
    },
    entries,
  };
  fs.writeFileSync(FINAL_MANIFEST, JSON.stringify(manifestOut, null, 2) + '\n');
  console.log(`\nWrote final manifest: ${FINAL_MANIFEST}`);
  console.log(`Total entries: ${entries.length}`);

  // Dispatch plan
  fs.mkdirSync(DISPATCH_DIR, { recursive: true });
  const dispatchPlan = entries.map(e => ({
    id: e.id,
    slug: e.slug,
    commonName: e.commonName,
    scientificName: e.scientificName,
    family: e.family,
    categoryGroup: e.categoryGroup,
    popularityScore: e.popularityScore,
    primaryUrl: e.primarySourceUrl,
    imageUrl: e.imageUrl,
    sources: e.sources,
    existingPlaceholder: e.existingPlaceholder,
    notes: e.notes,
  }));
  fs.writeFileSync(DISPATCH_FILE, JSON.stringify(dispatchPlan, null, 2) + '\n');
  console.log(`\nWrote dispatch plan: ${DISPATCH_FILE}`);
}

if (require.main === module) main();
