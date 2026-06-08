#!/usr/bin/env node
// Consolidate the 4 A1 candidate files + existing 118 placeholders into one
// canonical Stage A manifest for fish-freshwater.

const fs = require('fs');
const path = require('path');

const DIR = __dirname;
const SPECIES_DIR = path.resolve(DIR, '..', '..', '..', '..', 'species', 'fish');

const FILES = [
  'aquariumcoop-candidates.json',
  'seriouslyfish-candidates.json', // may not exist (timeout)
  'fishbase-candidates.json',
  'practicalfishkeeping-candidates.json',
  'tfh-candidates.json',
];

function readJson(p) { return JSON.parse(fs.readFileSync(p, 'utf8')); }

function normalizeScientific(sn) {
  if (!sn) return null;
  return sn.trim().replace(/\s+/g, ' ');
}

function normalizeCommon(cn) {
  if (!cn) return null;
  return cn.trim().replace(/\s+/g, ' ').toLowerCase();
}

function loadAll() {
  const entries = [];
  for (const f of FILES) {
    const fp = path.join(DIR, f);
    if (!fs.existsSync(fp)) continue;
    const j = readJson(fp);
    for (const e of j.entries) {
      entries.push({ ...e, _source: j.meta.source });
    }
  }
  return entries;
}

function loadPlaceholders() {
  const placeholders = [];
  for (const f of fs.readdirSync(SPECIES_DIR)) {
    const j = readJson(path.join(SPECIES_DIR, f));
    if (j.waterType === 'freshwater' && j.dataStatus === 'placeholder') {
      placeholders.push({
        commonName: j.commonName,
        scientificName: j.scientificName || null,
        slug: j.slug,
        id: j.id,
        _source: 'existing-placeholder',
      });
    }
  }
  return placeholders;
}

function consolidate(raw, placeholders) {
  // Group by canonical scientificName (preferred) or commonName as fallback
  const bySN = new Map();
  const byCN = new Map();
  for (const e of raw) {
    const sn = normalizeScientific(e.scientificName);
    const cn = normalizeCommon(e.commonName);
    if (sn && sn.toLowerCase().match(/^[a-z]+\s+[a-z]+/)) {
      const key = sn.toLowerCase();
      if (!bySN.has(key)) bySN.set(key, []);
      bySN.get(key).push(e);
    } else if (cn) {
      // No species-level scientificName — group by commonName
      if (!byCN.has(cn)) byCN.set(cn, []);
      byCN.get(cn).push(e);
    }
  }

  // Build consolidated entries
  const consolidated = [];
  for (const [key, group] of bySN) {
    const primary = group[0];
    const sources = [...new Set(group.map(e => e._source))];
    consolidated.push({
      commonName: primary.commonName,
      scientificName: primary.scientificName,
      family: primary.family || null,
      categoryGroup: primary.categoryGroup || null,
      sources,
      sourceCount: sources.length,
      primarySourceUrl: primary.careGuideUrl || primary.speciesUrl ||
                        primary.articleUrl || primary.fishbaseUrl ||
                        primary.productUrl || null,
      imageUrl: primary.imageUrl || null,
      notes: group.length > 1 ? `${group.length} listings consolidated.` : null,
    });
  }
  // Genus-only entries
  for (const [cn, group] of byCN) {
    const primary = group[0];
    const sources = [...new Set(group.map(e => e._source))];
    consolidated.push({
      commonName: primary.commonName,
      scientificName: primary.scientificName || null,
      family: primary.family || null,
      categoryGroup: primary.categoryGroup || null,
      sources,
      sourceCount: sources.length,
      primarySourceUrl: primary.careGuideUrl || primary.speciesUrl ||
                        primary.articleUrl || primary.fishbaseUrl ||
                        primary.productUrl || null,
      imageUrl: primary.imageUrl || null,
      notes: 'No species-level scientific name in sources; grouped by common name.',
    });
  }

  // Now merge in placeholders
  // For each placeholder, try to match by scientificName first, then by commonName
  const placeholderMatched = [];
  const placeholderUnmatched = [];
  for (const ph of placeholders) {
    let matched = false;
    if (ph.scientificName) {
      const phSn = normalizeScientific(ph.scientificName).toLowerCase();
      const match = consolidated.find(e =>
        e.scientificName && normalizeScientific(e.scientificName).toLowerCase() === phSn
      );
      if (match) {
        match.existingPlaceholder = { slug: ph.slug, id: ph.id };
        placeholderMatched.push(ph);
        matched = true;
      }
    }
    if (!matched) {
      // Try by commonName (looser match)
      const phCn = normalizeCommon(ph.commonName);
      const match = consolidated.find(e => normalizeCommon(e.commonName) === phCn);
      if (match) {
        match.existingPlaceholder = { slug: ph.slug, id: ph.id };
        placeholderMatched.push(ph);
        matched = true;
      }
    }
    if (!matched) {
      placeholderUnmatched.push(ph);
    }
  }
  // Add unmatched placeholders as their own entries
  for (const ph of placeholderUnmatched) {
    consolidated.push({
      commonName: ph.commonName,
      scientificName: ph.scientificName || null,
      family: null,
      categoryGroup: null,
      sources: ['existing-placeholder'],
      sourceCount: 1,
      primarySourceUrl: null,
      imageUrl: null,
      notes: 'Pre-existing placeholder in src/species/fish/; not present in A1 sources. Likely user-curated; preserved.',
      existingPlaceholder: { slug: ph.slug, id: ph.id },
    });
  }

  return {
    consolidated,
    stats: {
      raw: raw.length,
      uniqueScientificNames: bySN.size,
      commonNameOnly: byCN.size,
      placeholdersScanned: placeholders.length,
      placeholdersMatchedToSource: placeholderMatched.length,
      placeholdersUnmatched: placeholderUnmatched.length,
      finalCount: consolidated.length,
    },
  };
}

if (require.main === module) {
  const raw = loadAll();
  const placeholders = loadPlaceholders();
  const { consolidated, stats } = consolidate(raw, placeholders);
  console.log('Consolidation stats:');
  for (const [k, v] of Object.entries(stats)) console.log(`  ${k}: ${v}`);

  const out = {
    meta: {
      slice: 'fish-freshwater',
      generatedDate: '2026-06-08',
      sources: ['Aquarium Co-Op', 'FishBase', 'Practical Fishkeeping', 'TFH/Wikipedia', 'existing-placeholders'],
      seriouslyFishNote: 'SeriouslyFish crawl timed out at 40 minutes (196 tool uses); not included. May redispatch as gap-fill if dedup yields < 600 entries.',
      stats,
    },
    entries: consolidated,
  };
  fs.writeFileSync(path.join(DIR, 'consolidated.json'), JSON.stringify(out, null, 2) + '\n');
  console.log(`\nWrote ${consolidated.length} consolidated entries to consolidated.json`);
}
