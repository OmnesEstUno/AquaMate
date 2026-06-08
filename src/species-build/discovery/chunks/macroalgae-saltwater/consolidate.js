#!/usr/bin/env node
// Consolidate the 3 A1 candidate files into one canonical Stage A manifest.
// Per user decisions 2026-06-08:
//   - G. tikvahiae 4 morphs → 1 entry, morphs in alsoKnownAs
//   - Multi-Mosaic genus listings (e.g. 11x Laurencia sp.) → 1 entry per genus
//   - Red Mangrove (Rhizophora mangle) → DROP (vascular plant, not algae)
//   - Coralline → INCLUDE (form=encrusting)
//   - Truly-unknown Mosaic sp. (no genus) → aggregate into 1 'mystery' entry
//     preserving Mosaic SKU URLs for traceability

const fs = require('fs');
const path = require('path');

const DIR = __dirname;
const FILES = [
  'algaebarn-candidates.json',
  'topshelfaquatics-candidates.json',
  'mosaicmacros-candidates.json',
];

function readJson(p) { return JSON.parse(fs.readFileSync(p, 'utf8')); }

function normalizeScientific(sn) {
  if (!sn) return null;
  const cleaned = sn.trim().replace(/\s+/g, ' ');
  return cleaned;
}

function isUnknownGenus(sn) {
  if (!sn) return true;
  const lc = sn.toLowerCase().trim();
  return lc === 'unknown' || lc === 'unknown sp.' || lc === 'unidentified' || lc === 'sp.';
}

function isMangrove(e) {
  return /rhizophora/i.test(e.scientificName || '') || /mangrove/i.test(e.commonName || '');
}

function isBundlePack(e) {
  const cn = (e.commonName || '').toLowerCase();
  const sd = (e.shortDescription || '').toLowerCase();
  return /trifecta|variety pack|starter kit|ultimate.*pack|tank booster|buy \d+ get \d+/.test(cn + ' ' + sd);
}

function tikvahiaeMorph(e) {
  return /gracilaria tikvahiae/i.test(e.scientificName || '');
}

function genusOf(sn) {
  if (!sn) return null;
  const m = sn.match(/^([A-Z][a-z]+)/);
  return m ? m[1] : null;
}

function loadAll() {
  const entries = [];
  for (const f of FILES) {
    const j = readJson(path.join(DIR, f));
    for (const e of j.entries) {
      entries.push({ ...e, _source: j.meta.source, _sourceUrl: j.meta.sourceUrl });
    }
  }
  return entries;
}

function consolidate(raw) {
  // Phase 1a: drop mangrove
  let entries = raw.filter(e => !isMangrove(e));
  const droppedMangrove = raw.length - entries.length;

  // Phase 1b: drop bundle packs (variety packs, trifectas, etc.)
  const beforeBundle = entries.length;
  entries = entries.filter(e => !isBundlePack(e));
  const droppedBundles = beforeBundle - entries.length;

  // Phase 2: consolidate G. tikvahiae morphs
  const tikvahiae = entries.filter(tikvahiaeMorph);
  const others1 = entries.filter(e => !tikvahiaeMorph(e));
  let tikvahiaeEntry = null;
  if (tikvahiae.length) {
    const akaSet = new Set();
    const galleryUrls = [];
    for (const e of tikvahiae) {
      if (e.commonName) akaSet.add(e.commonName);
      if (e.imageUrl) galleryUrls.push(e.imageUrl);
    }
    tikvahiaeEntry = {
      commonName: 'Green Ogo (Gracilaria tikvahiae)',
      scientificName: 'Gracilaria tikvahiae',
      alsoKnownAs: [...akaSet],
      primarySourceUrl: tikvahiae[0].productUrl,
      primaryImageUrl: tikvahiae[0].imageUrl,
      additionalSourceUrls: tikvahiae.slice(1).map(e => e.productUrl).filter(Boolean),
      additionalImageUrls: galleryUrls.slice(1),
      sources: [...new Set(tikvahiae.map(e => e._source))],
      categoryTags: [...new Set(tikvahiae.flatMap(e => e.categoryTags || []))],
      notes: `Sold under multiple color-morph trade names: ${[...akaSet].join('; ')}. All ${tikvahiae.length} are Gracilaria tikvahiae color forms.`,
    };
  }

  // Phase 3: split truly-unknown vs known-genus entries
  const trulyUnknown = others1.filter(e => isUnknownGenus(e.scientificName));
  const known = others1.filter(e => !isUnknownGenus(e.scientificName));

  // Phase 4: aggregate truly-unknown into one entry
  let mysteryEntry = null;
  if (trulyUnknown.length) {
    mysteryEntry = {
      commonName: 'Mosaic Macros Mystery Forms (unidentified)',
      scientificName: 'Unknown sp.',
      alsoKnownAs: [...new Set(trulyUnknown.map(e => e.commonName).filter(Boolean))],
      primarySourceUrl: trulyUnknown[0].productUrl,
      primaryImageUrl: trulyUnknown[0].imageUrl,
      additionalSourceUrls: trulyUnknown.slice(1).map(e => e.productUrl).filter(Boolean),
      additionalImageUrls: trulyUnknown.slice(1).map(e => e.imageUrl).filter(Boolean),
      sources: [...new Set(trulyUnknown.map(e => e._source))],
      categoryTags: [...new Set(trulyUnknown.flatMap(e => e.categoryTags || []))],
      notes: `Aggregate entry for ${trulyUnknown.length} Mosaic Macros SKUs with no genus identification. Each SKU preserves a different specimen/color form; Mosaic themselves do not identify the genus. Listed for trade completeness only — Stage C research will likely flag as needs_review or be skipped.`,
    };
  }

  // Phase 5: group known by canonical scientificName
  const byScientific = new Map();
  for (const e of known) {
    const sn = normalizeScientific(e.scientificName);
    const key = sn.toLowerCase();
    if (!byScientific.has(key)) byScientific.set(key, []);
    byScientific.get(key).push(e);
  }

  const consolidated = [];
  for (const [key, group] of byScientific) {
    // Pick primary source: AlgaeBarn > Top Shelf > Mosaic Macros
    const algaebarn = group.find(e => e._source === 'AlgaeBarn');
    const topshelf = group.find(e => e._source === 'Top Shelf Aquatics');
    const mosaic = group.find(e => e._source === 'Mosaic Macros');
    const primary = algaebarn || topshelf || mosaic || group[0];

    const akaSet = new Set();
    const galleryUrls = [];
    const additionalUrls = [];
    for (const e of group) {
      if (e.commonName) akaSet.add(e.commonName);
      if (e.imageUrl && e.imageUrl !== primary.imageUrl) galleryUrls.push(e.imageUrl);
      if (e.productUrl && e.productUrl !== primary.productUrl) additionalUrls.push(e.productUrl);
    }
    // Pick a common name: prefer the primary's
    consolidated.push({
      commonName: primary.commonName,
      scientificName: primary.scientificName,
      alsoKnownAs: [...akaSet].filter(n => n !== primary.commonName),
      primarySourceUrl: primary.productUrl,
      primaryImageUrl: primary.imageUrl,
      additionalSourceUrls: additionalUrls,
      additionalImageUrls: galleryUrls,
      sources: [...new Set(group.map(e => e._source))],
      categoryTags: [...new Set(group.flatMap(e => e.categoryTags || []))],
      notes: group.length > 1
        ? `Consolidated from ${group.length} listings: ${group.map(e => `${e._source} (${e.commonName})`).join(', ')}.`
        : null,
    });
  }

  // Phase 6: post-merge dedup — when same commonName has both genus-sp. and
  // genus-species_epithet entries, promote to the species-level (more specific
  // taxonomy wins) and merge sources/images.
  const byCommon = new Map();
  for (const e of consolidated) {
    const cn = (e.commonName || '').toLowerCase().trim();
    if (!cn) continue;
    if (!byCommon.has(cn)) byCommon.set(cn, []);
    byCommon.get(cn).push(e);
  }
  let postMerged = 0;
  for (const [cn, group] of byCommon) {
    if (group.length < 2) continue;
    // Find species-level vs genus-only
    const speciesLevel = group.filter(e => /^[A-Z][a-z]+\s+[a-z]+/.test(e.scientificName||''));
    const genusOnly = group.filter(e => /\bsp\.$/i.test(e.scientificName||''));
    if (!speciesLevel.length || !genusOnly.length) continue;
    // Only merge if same genus
    const speciesGenus = genusOf(speciesLevel[0].scientificName);
    const genusOnlyGenus = genusOf(genusOnly[0].scientificName);
    if (speciesGenus !== genusOnlyGenus) continue;
    // Merge genusOnly into the first species-level entry
    const target = speciesLevel[0];
    for (const g of genusOnly) {
      target.sources = [...new Set([...target.sources, ...g.sources])];
      if (g.primarySourceUrl) target.additionalSourceUrls.push(g.primarySourceUrl);
      if (g.primaryImageUrl) target.additionalImageUrls.push(g.primaryImageUrl);
      target.additionalSourceUrls.push(...(g.additionalSourceUrls || []));
      target.additionalImageUrls.push(...(g.additionalImageUrls || []));
      target.alsoKnownAs = [...new Set([...(target.alsoKnownAs||[]), ...(g.alsoKnownAs||[]), g.commonName].filter(Boolean))]
        .filter(n => n !== target.commonName);
      target.categoryTags = [...new Set([...(target.categoryTags||[]), ...(g.categoryTags||[])])];
      postMerged++;
    }
    target.notes = (target.notes || '') +
      ` Merged ${genusOnly.length} genus-level (${genusOnlyGenus} sp.) listing(s) sharing the common name '${target.commonName}'.`;
    // Mark genus-only entries for removal
    for (const g of genusOnly) g._merged = true;
  }
  const final1 = consolidated.filter(e => !e._merged);

  // Phase 7: assemble final list
  const final = [];
  if (tikvahiaeEntry) final.push(tikvahiaeEntry);
  final.push(...final1);
  if (mysteryEntry) final.push(mysteryEntry);

  return {
    final,
    stats: {
      raw: raw.length,
      droppedMangrove,
      droppedBundles,
      tikvahiaeMorphsCollapsed: tikvahiae.length,
      trulyUnknownAggregated: trulyUnknown.length,
      consolidatedFromScientific: consolidated.length,
      postMergedGenusToSpecies: postMerged,
      finalCount: final.length,
    },
  };
}

if (require.main === module) {
  const raw = loadAll();
  const { final, stats } = consolidate(raw);
  console.log('Consolidation stats:');
  for (const [k, v] of Object.entries(stats)) console.log(`  ${k}: ${v}`);

  const out = {
    meta: {
      slice: 'macroalgae-saltwater',
      generatedDate: '2026-06-08',
      sources: ['AlgaeBarn (primary)', 'Top Shelf Aquatics (secondary)', 'Mosaic Macros (tertiary)'],
      consolidationDecisions: [
        'Gracilaria tikvahiae 4 morphs → 1 entry, morphs in alsoKnownAs',
        'Multi-source genus-only listings (e.g. Laurencia sp. ×11) → 1 entry per genus',
        'Truly-unknown sp. (no genus) → 1 aggregate "Mystery Forms" entry',
        'Red Mangrove (Rhizophora mangle) dropped (vascular plant, not algae)',
        'Coralline included (form=encrusting)',
      ],
      stats,
    },
    entries: final,
  };
  fs.writeFileSync(path.join(DIR, 'consolidated.json'), JSON.stringify(out, null, 2) + '\n');
  console.log(`\nWrote ${final.length} consolidated entries to consolidated.json`);
}
