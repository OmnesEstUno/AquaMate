#!/usr/bin/env node
// Retroactive sweep: add Mosaic Macros general care guide URL as a second
// source for macroalgae entries that don't yet reference it. Standardize
// propagation arrays + add sand-bed-melt warning for red/brown algae.
//
// Per session 2026-06-08: user added care guide URL late in the slice,
// so batches 1-5 + most of 5 entries need retroactive normalization.

const fs = require('fs');
const path = require('path');

const DIR = path.resolve(__dirname, '..', 'species', 'macroalgae');
const CARE_GUIDE_URL = 'https://mosaicmacros.com/blogs/macroalgae-care-sheets-compatibility/macroalgae-care-the-basics-of-keeping-macroalgae-in-your-reef';

// Genera that ACCEPT sand-bed placement per Mosaic care guide
const SAND_BED_GENERA = ['Caulerpa', 'Halimeda', 'Penicillus', 'Rhipocephalus', 'Udotea'];
// Calcareous Dasycladales greens that can also go in sand (Mosaic implicit
// from sw-algae-085 Neomeris and sw-algae-055 Cymopolia handling)
const DASYCLADACEAE_SAND = ['Neomeris', 'Cymopolia', 'Acetabularia', 'Batophora'];

const STANDARD_PROPAGATION_ROCK = ['fragmentation', 'wedging', 'zip-tie/fishing line'];
const STANDARD_PROPAGATION_SAND = ['fragmentation', 'wedging', 'zip-tie/fishing line', 'sand-bed'];

function genusOf(scientificName) {
  if (!scientificName) return null;
  const m = scientificName.match(/^([A-Z][a-z]+)/);
  return m ? m[1] : null;
}

function isGreenOrSandAccepted(j) {
  const genus = genusOf(j.scientificName);
  if (!genus) return false;
  if (SAND_BED_GENERA.includes(genus)) return true;
  if (DASYCLADACEAE_SAND.includes(genus)) return true;
  return false;
}

function alreadyHasCareGuide(j) {
  const allText = JSON.stringify(j);
  return allText.includes('mosaicmacros.com/blogs/macroalgae-care-sheets-compatibility');
}

function addCareGuideSource(j) {
  if (!j.sources) j.sources = { primary: null, additional: [] };
  if (!j.sources.additional) j.sources.additional = [];
  // Schema cap is 5 entries
  if (j.sources.additional.length >= 5) {
    // Replace a less-authoritative source if possible, otherwise skip
    // Strategy: replace the LAST entry that's not the primary trade source
    // Actually safer: skip and just log
    return false;
  }
  j.sources.additional.push({
    name: 'Mosaic Macros general macroalgae care guide',
    url: CARE_GUIDE_URL,
    accessedDate: '2026-06-08',
    notes: 'Slice-wide secondary source — provides authoritative Mosaic-wide parameter targets (temp 22-26°C, pH 8.1-8.4, Ca 400-450 ppm, Mg 1250-1350 ppm, NO3 5-20 ppm, PO4 0.02-0.1 ppm) and the 4-method propagation standard. Added retroactively 2026-06-08.',
  });
  return true;
}

function updatePropagation(j) {
  if (!j.macroalgae) return false;
  const current = j.macroalgae.propagation || [];
  // Skip if already standardized (contains "wedging" + "zip-tie/fishing line")
  if (current.includes('wedging') && current.includes('zip-tie/fishing line')) {
    return false;
  }
  // Build new array based on whether species accepts sand
  const isSand = isGreenOrSandAccepted(j);
  const standardized = isSand ? [...STANDARD_PROPAGATION_SAND] : [...STANDARD_PROPAGATION_ROCK];
  // Preserve any existing non-standard methods (like "vegetative tip growth"
  // for Caulerpa, "gametophyte-sporophyte alternation" for Ulva)
  for (const method of current) {
    if (!standardized.includes(method) && method !== 'fragmentation') {
      standardized.push(method);
    }
  }
  j.macroalgae.propagation = standardized;
  return true;
}

const MELT_WARNING = ' Per Mosaic care guide guidance: as a red or brown alga, this species will MELT at the base if buried in sand — attach to rock via superglue, zip-tie/fishing line, or wedging instead. (Sand-bed acceptance per Mosaic is limited to Caulerpa, Halimeda, Penicillus, Rhipocephalus, and Udotea genera, plus some calcified Dasycladales.)';

function addMeltWarning(j) {
  // Only add to red or brown algae entries
  if (isGreenOrSandAccepted(j)) return false;
  // Check by family — red algae families typically include "ceae" suffix
  const family = (j.taxonomy && j.taxonomy.family) || '';
  const greenFamilies = ['Caulerpaceae', 'Halimedaceae', 'Udoteaceae', 'Dasycladaceae',
                         'Polyphysaceae', 'Codiaceae', 'Cladophoraceae', 'Ulvaceae',
                         'Valoniaceae', 'Siphonocladaceae'];
  if (greenFamilies.includes(family)) return false;
  // Skip if already mentions melt warning
  if ((j.careNotes || '').toLowerCase().includes('melt at the base')) return false;
  if ((j.careNotes || '').toLowerCase().includes('sand-bed melt')) return false;
  if (!j.careNotes) j.careNotes = '';
  j.careNotes = j.careNotes.trimEnd() + MELT_WARNING;
  return true;
}

function main() {
  const files = fs.readdirSync(DIR).filter(f => f.endsWith('.json'));
  const stats = {
    scanned: 0,
    skipped_already_has_guide: 0,
    care_guide_added: 0,
    care_guide_skipped_full_sources: 0,
    propagation_updated: 0,
    melt_warning_added: 0,
    files_touched: 0,
  };

  for (const f of files) {
    const fp = path.join(DIR, f);
    const j = JSON.parse(fs.readFileSync(fp, 'utf8'));
    stats.scanned++;
    if (alreadyHasCareGuide(j)) {
      stats.skipped_already_has_guide++;
      continue;
    }
    let touched = false;
    if (addCareGuideSource(j)) {
      stats.care_guide_added++;
      touched = true;
    } else {
      stats.care_guide_skipped_full_sources++;
    }
    if (updatePropagation(j)) {
      stats.propagation_updated++;
      touched = true;
    }
    if (addMeltWarning(j)) {
      stats.melt_warning_added++;
      touched = true;
    }
    if (touched) {
      // Update lastReviewed if existed
      if (j.lastReviewed) j.lastReviewed = '2026-06-08';
      fs.writeFileSync(fp, JSON.stringify(j, null, 2) + '\n');
      stats.files_touched++;
    }
  }

  console.log('Retroactive care guide sweep complete:');
  for (const [k, v] of Object.entries(stats)) console.log(`  ${k}: ${v}`);
}

if (require.main === module) main();
