#!/usr/bin/env node
// Finalize the macroalgae-saltwater Stage A manifest:
//   1. Read consolidated.json (101 entries)
//   2. Assign source-tier popularity score (no Wikipedia enrichment — catalog
//      shape unsuitable; many specialty Mosaic-only entries have no Wikipedia
//      article).
//   3. Assign slugs and sw-macro-NNN IDs ordered by popularityScore desc.
//   4. Write final manifest to src/species-build/discovery/macroalgae-saltwater.json
//   5. Write dispatch plan to .dispatch-prompts-macroalgae/dispatch.json

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..', '..', '..', '..');
const CONSOLIDATED = path.join(__dirname, 'consolidated.json');
const FINAL_MANIFEST = path.join(ROOT, 'src/species-build/discovery/macroalgae-saltwater.json');
const DISPATCH_DIR = path.join(ROOT, '.dispatch-prompts-macroalgae');
const DISPATCH_FILE = path.join(DISPATCH_DIR, 'dispatch.json');

function readJson(p) { return JSON.parse(fs.readFileSync(p, 'utf8')); }

function slugify(s) {
  return s.toLowerCase()
    .replace(/['"\.]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function popularityFromSources(sources) {
  const hasAB = sources.includes('AlgaeBarn');
  const hasTS = sources.includes('Top Shelf Aquatics');
  const hasMM = sources.includes('Mosaic Macros');
  const count = sources.length;
  if (count >= 3) return 7;          // Tier S — all three sources
  if (count === 2 && hasAB) return 6; // Tier 1a — AlgaeBarn + (TSA or MM)
  if (count === 2) return 5;          // Tier 1b — TSA + MM (no AlgaeBarn)
  if (hasAB) return 4;                // Tier 2 — AlgaeBarn-only
  if (hasTS) return 3;                // Tier 3 — TSA-only
  if (hasMM) return 2;                // Tier 4 — Mosaic-only (the long tail)
  return 1;                            // Tier 5 — unusual
}

function main() {
  const cons = readJson(CONSOLIDATED);
  const entries = cons.entries.map((e, i) => {
    const popularityScore = popularityFromSources(e.sources);
    const slug = slugify(e.commonName);
    return {
      commonName: e.commonName,
      scientificName: e.scientificName,
      slug,
      popularityScore,
      alsoKnownAs: e.alsoKnownAs || [],
      sources: e.sources,
      primarySourceUrl: e.primarySourceUrl,
      primaryImageUrl: e.primaryImageUrl,
      additionalSourceUrls: e.additionalSourceUrls || [],
      additionalImageUrls: e.additionalImageUrls || [],
      categoryTags: e.categoryTags || [],
      notes: e.notes,
    };
  });

  // Sort by popularityScore desc, then by commonName
  entries.sort((a, b) => {
    if (b.popularityScore !== a.popularityScore) return b.popularityScore - a.popularityScore;
    return a.commonName.localeCompare(b.commonName);
  });

  // Assign IDs
  entries.forEach((e, i) => {
    const num = String(i + 1).padStart(3, '0');
    e.id = `sw-macro-${num}`;
  });

  // Write final manifest
  const manifestOut = {
    meta: {
      slice: 'macroalgae-saltwater',
      generatedDate: '2026-06-08',
      sources: cons.meta.sources,
      consolidationDecisions: cons.meta.consolidationDecisions,
      popularityScoring: 'Source-tier (7=all three sources, 6=AB+other, 5=TSA+MM, 4=AB-only, 3=TSA-only, 2=MM-only, 1=other)',
      stats: cons.meta.stats,
      totalEntries: entries.length,
    },
    entries,
  };
  fs.writeFileSync(FINAL_MANIFEST, JSON.stringify(manifestOut, null, 2) + '\n');
  console.log(`Wrote final manifest: ${FINAL_MANIFEST}`);
  console.log(`Total entries: ${entries.length}`);

  // Tier distribution
  const tiers = {};
  for (const e of entries) tiers[e.popularityScore] = (tiers[e.popularityScore] || 0) + 1;
  console.log('Tier distribution:');
  for (const [t, c] of Object.entries(tiers).sort((a, b) => b[0] - a[0])) {
    console.log(`  tier ${t}: ${c}`);
  }

  // Write dispatch plan
  fs.mkdirSync(DISPATCH_DIR, { recursive: true });
  const dispatchPlan = entries.map(e => ({
    id: e.id,
    slug: e.slug,
    commonName: e.commonName,
    scientificName: e.scientificName,
    popularityScore: e.popularityScore,
    primaryUrl: e.primarySourceUrl,
    primaryImageUrl: e.primaryImageUrl,
    additionalUrls: e.additionalSourceUrls,
    additionalImageUrls: e.additionalImageUrls,
    sources: e.sources,
    alsoKnownAs: e.alsoKnownAs,
    notes: e.notes,
  }));
  fs.writeFileSync(DISPATCH_FILE, JSON.stringify(dispatchPlan, null, 2) + '\n');
  console.log(`\nWrote dispatch plan: ${DISPATCH_FILE}`);
}

if (require.main === module) main();
