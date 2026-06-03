#!/usr/bin/env node
// One-shot migration for the 2026-06-03 schema promotion sweep.
// - Adds nativeRange.depthRangeM, tank.minSandDepthCm to all species files.
// - For fish: replaces protogynous boolean with sexChange enum, adds 5 new boolean fields.
// - Backfills from careNotes/breedingNotes/diet.notes prose where the pattern is unambiguous.
// - For non-fish taxa, just adds the nativeRange/tank fields as null.

const fs = require('fs');
const path = require('path');

const SPECIES_DIR = path.resolve(__dirname, '..', 'species');

function readJson(p) { return JSON.parse(fs.readFileSync(p, 'utf8')); }
function writeJson(p, obj) { fs.writeFileSync(p, JSON.stringify(obj, null, 2) + '\n'); }

function gatherProse(entry) {
  const parts = [
    entry.careNotes || '',
    entry.breedingNotes || '',
    entry.summary || '',
    entry.diet && entry.diet.notes || '',
    entry.nativeRange && entry.nativeRange.habitat || '',
    entry.nativeRange && entry.nativeRange.biotope || ''
  ];
  return parts.join('\n').toLowerCase();
}

// --- Backfill heuristics -----------------------------------------------------

function detectSexChange(prose, existingProtogynous) {
  // Order matters: more specific phrases first.
  if (/bidirectional (?:sex change|hermaphrodit|protogyn)|bi-directional (?:sex change|hermaphrodit)|sex change in either direction|change sex in both directions/.test(prose)) {
    return 'bidirectional';
  }
  if (/simultaneous hermaphrodit|synchronous hermaphrodit|hermaphrodites? simultaneously functioning|functions? (?:simultaneously|as both sexes)/.test(prose)) {
    return 'simultaneous';
  }
  if (/protandrous|male[- ]first|born male|change from male to female/.test(prose)) {
    return 'protandrous';
  }
  if (/protogynous|female[- ]first|born female|change from female to male|sex changing from female|male.{0,20}derived from.{0,10}female/.test(prose)) {
    return 'protogynous';
  }
  // Fall back to the legacy protogynous boolean if present.
  if (existingProtogynous === true) return 'protogynous';
  if (existingProtogynous === false) return 'none';
  return null;
}

function detectSymbioticShrimpPartner(prose) {
  if (/pistol shrimp|alpheid|alpheus|shrimp goby|shrimp[- ]goby|shrimp partner|symbiotic.{0,20}shrimp|burrow.{0,40}shrimp/.test(prose)) return true;
  return null; // leave null if no signal — false would over-claim
}

function detectMouthbrooder(prose) {
  if (/mouthbrooder|mouth[- ]brood|paternal mouthbrood|oral incubat|carry.{0,15}eggs in.{0,15}mouth/.test(prose)) return true;
  return null;
}

function detectConstantGrazer(prose) {
  // High-metabolism multi-daily feeders. Conservative: require explicit per-day or anthias-multi-feeding language.
  if (/(?:three|four|five|3|4|5)[- ]?(?:to[- ]?(?:four|five|six|4|5|6))?[- ]?(?:small )?feedings? per day|multiple.{0,15}feedings.{0,15}(?:per )?day|2[-–]3 (?:small )?feedings per day|feed.{0,30}(?:multiple|several) times (?:per|a) day|requires? frequent.{0,30}feedings/.test(prose)) return true;
  return null;
}

function detectCleanerFish(prose) {
  if (/cleaner (?:wrasse|fish|goby)|cleaning station|removes? parasites from|functions? as a cleaner|cleaner.{0,15}(?:behavior|behaviour)|labroides.{0,20}clean|elacatinus.{0,20}clean/.test(prose)) return true;
  return null;
}

function detectEuryhaline(prose) {
  if (/euryhaline|brackish|estuarine|estuary|tolerates? (?:both )?(?:marine|salt) and (?:brackish|fresh)|salinity range from|broad salinity tolerance/.test(prose)) return true;
  return null;
}

function detectMinSandDepthCm(prose) {
  // Look for explicit sand-bed depth specifications.
  const m1 = prose.match(/(\d+(?:\.\d+)?)[- ]?(?:to[- ]?(\d+(?:\.\d+)?))?\s*cm[- ]?(?:deep[- ]?)?(?:of\s+)?(?:fine\s+)?sand/);
  if (m1) {
    const lo = parseFloat(m1[1]);
    const hi = m1[2] ? parseFloat(m1[2]) : lo;
    return Math.round((lo + hi) / 2);
  }
  const m2 = prose.match(/(\d+(?:\.\d+)?)[- ]?(?:to[- ]?(\d+(?:\.\d+)?))?\s*(?:inch|in)\s+(?:deep[- ]?)?(?:of\s+)?(?:fine\s+)?sand/);
  if (m2) {
    const lo = parseFloat(m2[1]);
    const hi = m2[2] ? parseFloat(m2[2]) : lo;
    return Math.round(((lo + hi) / 2) * 2.54);
  }
  const m3 = prose.match(/sand bed.{0,20}(?:of |at least )?(\d+(?:\.\d+)?)\s*cm/);
  if (m3) return Math.round(parseFloat(m3[1]));
  const m4 = prose.match(/sand bed.{0,20}(?:of |at least )?(\d+(?:\.\d+)?)\s*(?:inch|in)/);
  if (m4) return Math.round(parseFloat(m4[1]) * 2.54);
  return null;
}

function detectDepthRangeM(prose, nativeRangeHabitat) {
  // Look for "X-Y m" or "X-Y meters" or "X to Y m" patterns in the prose.
  // Habitat strings often have this format.
  const all = `${nativeRangeHabitat || ''}\n${prose}`;
  // Patterns like: "at depths of 1-35 m", "20-110 m", "10 to 30 meters"
  const m = all.match(/(?:at depths? of |at |from |between )?(\d+(?:\.\d+)?)\s*(?:[-–to]|to)\s*(\d+(?:\.\d+)?)\s*(?:m\b|meters?\b)/i);
  if (m) {
    const lo = parseFloat(m[1]);
    const hi = parseFloat(m[2]);
    if (lo >= 0 && hi <= 2000 && lo < hi) return { min: lo, max: hi };
  }
  return null;
}

// --- Per-file migration ------------------------------------------------------

function migrateOne(filePath) {
  const entry = readJson(filePath);
  const prose = gatherProse(entry);
  const changes = [];

  // nativeRange.depthRangeM (all taxa)
  if (entry.nativeRange && !('depthRangeM' in entry.nativeRange)) {
    const detected = detectDepthRangeM(prose, entry.nativeRange.habitat);
    entry.nativeRange.depthRangeM = detected;
    changes.push(detected ? `depthRange=${detected.min}-${detected.max}m` : 'depthRange=null');
  }

  // tank.minSandDepthCm (all taxa)
  if (entry.tank && !('minSandDepthCm' in entry.tank)) {
    const detected = detectMinSandDepthCm(prose);
    entry.tank.minSandDepthCm = detected;
    changes.push(detected ? `sandDepth=${detected}cm` : 'sandDepth=null');
  }

  // Fish-only changes
  if (entry.taxon === 'fish' && entry.fish) {
    const f = entry.fish;

    // sexChange enum (replaces protogynous boolean)
    if (!('sexChange' in f)) {
      const detected = detectSexChange(prose, f.protogynous);
      f.sexChange = detected;
      changes.push(detected ? `sexChange=${detected}` : 'sexChange=null');
    }
    // Remove the old protogynous field if it exists (schema no longer allows it).
    if ('protogynous' in f) {
      delete f.protogynous;
      changes.push('removed protogynous');
    }

    // Five new boolean fields. Each defaults to null; backfill where unambiguous.
    if (!('symbioticShrimpPartner' in f)) {
      f.symbioticShrimpPartner = detectSymbioticShrimpPartner(prose);
      if (f.symbioticShrimpPartner) changes.push('shrimpPartner=true');
    }
    if (!('mouthbrooder' in f)) {
      f.mouthbrooder = detectMouthbrooder(prose);
      if (f.mouthbrooder) changes.push('mouthbrooder=true');
    }
    if (!('constantGrazer' in f)) {
      f.constantGrazer = detectConstantGrazer(prose);
      if (f.constantGrazer) changes.push('constantGrazer=true');
    }
    if (!('cleanerFish' in f)) {
      f.cleanerFish = detectCleanerFish(prose);
      if (f.cleanerFish) changes.push('cleanerFish=true');
    }
    if (!('euryhaline' in f)) {
      f.euryhaline = detectEuryhaline(prose);
      if (f.euryhaline) changes.push('euryhaline=true');
    }

    // Re-order fish properties to match schema declaration order for tidiness.
    const order = ['breedingDifficulty', 'breedingNotes', 'conspecificAggression', 'finNippy', 'reefSafe', 'escapeRisk', 'venomousSpines', 'sexChange', 'haremic', 'caudalScalpel', 'nocturnal', 'juvenileColorPhase', 'copperSensitive', 'speciesOnlyTankRecommended', 'requiresHitchingPost', 'monogamousPairing', 'hlleSusceptible', 'toxicToTank', 'feedingDifficulty', 'symbioticShrimpPartner', 'mouthbrooder', 'constantGrazer', 'cleanerFish', 'euryhaline'];
    const reordered = {};
    for (const k of order) if (k in f) reordered[k] = f[k];
    for (const k of Object.keys(f)) if (!(k in reordered)) reordered[k] = f[k]; // shouldn't happen but safe
    entry.fish = reordered;
  }

  writeJson(filePath, entry);
  return changes;
}

// --- Walk + report -----------------------------------------------------------

function walkSpecies() {
  const taxa = fs.readdirSync(SPECIES_DIR);
  const files = [];
  for (const taxon of taxa) {
    const taxonDir = path.join(SPECIES_DIR, taxon);
    if (!fs.statSync(taxonDir).isDirectory()) continue;
    for (const f of fs.readdirSync(taxonDir)) {
      if (f.endsWith('.json')) files.push(path.join(taxonDir, f));
    }
  }
  return files;
}

if (require.main === module) {
  const files = walkSpecies();
  console.log(`Migrating ${files.length} species files...`);
  const summary = {
    files: 0,
    depthBackfilled: 0,
    sandDepthBackfilled: 0,
    sexChangeBackfilled: 0,
    shrimpPartnerBackfilled: 0,
    mouthbrooderBackfilled: 0,
    constantGrazerBackfilled: 0,
    cleanerFishBackfilled: 0,
    euryhalineBackfilled: 0
  };
  for (const f of files) {
    const changes = migrateOne(f);
    summary.files++;
    for (const c of changes) {
      if (c.startsWith('depthRange=') && c !== 'depthRange=null') summary.depthBackfilled++;
      if (c.startsWith('sandDepth=') && c !== 'sandDepth=null') summary.sandDepthBackfilled++;
      if (c.startsWith('sexChange=') && c !== 'sexChange=null' && c !== 'sexChange=none') summary.sexChangeBackfilled++;
      if (c === 'shrimpPartner=true') summary.shrimpPartnerBackfilled++;
      if (c === 'mouthbrooder=true') summary.mouthbrooderBackfilled++;
      if (c === 'constantGrazer=true') summary.constantGrazerBackfilled++;
      if (c === 'cleanerFish=true') summary.cleanerFishBackfilled++;
      if (c === 'euryhaline=true') summary.euryhalineBackfilled++;
    }
  }
  console.log('Done.');
  console.log(JSON.stringify(summary, null, 2));
}

module.exports = { migrateOne };
