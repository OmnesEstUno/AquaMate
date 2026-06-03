#!/usr/bin/env node
// Bulk-resolve "needs_review" entries flagged only for LiveAquaria-vs-FishBase
// temperature divergence. If the entry's careNotes explicitly documents the
// divergence (i.e. names both source values or uses "averaged"/"divergence"/
// "divergent" / "spread" / "disagreement" near a temperature phrase), and the
// recorded temperatureC value lands in a plausible aquarium-practical band,
// upgrade dataStatus from "needs_review" to "researched".
//
// Per session decision 2026-06-03: the averaging-and-documenting pattern is
// the playbook's intended resolution for this source-divergence class; the
// needs_review flag was overcautious. The bulk rule clears entries where the
// only flagged concern is this systemic LiveAquaria/FishBase divergence.

const fs = require('fs');
const path = require('path');

const SPECIES_DIR = path.resolve(__dirname, '..', 'species');

function readJson(p) { return JSON.parse(fs.readFileSync(p, 'utf8')); }
function writeJson(p, obj) { fs.writeFileSync(p, JSON.stringify(obj, null, 2) + '\n'); }

// Documents the temp divergence if careNotes references both sources
// or uses divergence-resolution vocabulary near a temperature term.
function documentsTempDivergence(careNotes) {
  if (!careNotes) return false;
  const cn = careNotes.toLowerCase();
  const tempKw = /(?:temperature|temp\b|°c|°f|water[- ]temp)/;
  const divergenceKw = /(?:averag(?:e|ed|ing)|disagree|divergen|spread|differs?|gap between|narrow overlap|non[- ]?overlap|wild[- ]habitat|wild range|wild data|fishbase reports|fishbase records|fishbase recommends|liveaquaria recommends)/;
  // Both must appear within ~250 chars of each other.
  const indices = [];
  let m;
  const tempRe = new RegExp(tempKw.source, 'gi');
  while ((m = tempRe.exec(cn)) !== null) indices.push(m.index);
  for (const i of indices) {
    const window = cn.slice(Math.max(0, i - 250), Math.min(cn.length, i + 250));
    if (divergenceKw.test(window)) return true;
  }
  return false;
}

// Sanity-check that the recorded temp lands in a plausible band.
// Aquarium tropical: roughly 18-30°C; cold-water can go lower.
function tempIsPlausible(temp) {
  if (!temp || typeof temp !== 'object') return false;
  const { min, max } = temp;
  if (typeof min !== 'number' || typeof max !== 'number') return false;
  if (min > max) return false;
  if (min < 5 || max > 35) return false;
  return true;
}

function shouldUpgrade(entry) {
  if (entry.dataStatus !== 'needs_review') return { upgrade: false, reason: 'not flagged' };
  if (!entry.waterParameters || !entry.waterParameters.temperatureC) {
    return { upgrade: false, reason: 'no temperature value to validate' };
  }
  if (!documentsTempDivergence(entry.careNotes || '')) {
    return { upgrade: false, reason: 'careNotes does not document temp divergence' };
  }
  if (!tempIsPlausible(entry.waterParameters.temperatureC)) {
    return { upgrade: false, reason: 'temperatureC value outside plausible band' };
  }
  // Also bail if careNotes mentions a second open concern category.
  const cn = (entry.careNotes || '').toLowerCase();
  // Patterns that mean ANOTHER concern beyond temp would still need review.
  if (/(?:taxonom|undescribed|species[- ]?level (?:ambig|uncert)|trade name collid|trade[- ]?name ambigu|url collid|single source|sole source|fishbase only|liveaquaria has no|liveaquaria does not (?:carry|list)|no dedicated.{0,30}(?:retail|product|aquarium|hobby|source)|inferred from.{0,30}(?:genus|congener|related|family)|consensus across|color form|color morph|colour form|colour morph|wrong species|different species|wholly unrelated|distinct color form|distinguishable color)/.test(cn)) {
    return { upgrade: false, reason: 'careNotes mentions a non-temp open concern' };
  }
  if (/(?:tank.{0,15}(?:disagree|spread|gap|conflict|wide)|adult size.{0,15}(?:disagree|spread|conflict|2x|2[-–]fold)|size.{0,15}(?:disagreement|2[-–]?x|>?2x|data.entry error))/.test(cn)) {
    return { upgrade: false, reason: 'careNotes mentions tank/size disagreement' };
  }
  return { upgrade: true, reason: 'temp-divergence-only, averaged value documented' };
}

function walkFish() {
  const fishDir = path.join(SPECIES_DIR, 'fish');
  return fs.readdirSync(fishDir).map(f => path.join(fishDir, f));
}

if (require.main === module) {
  const files = walkFish();
  let scanned = 0;
  const upgraded = [];
  const kept = [];
  for (const fp of files) {
    const j = readJson(fp);
    if (j.dataStatus !== 'needs_review') continue;
    scanned++;
    const verdict = shouldUpgrade(j);
    if (verdict.upgrade) {
      j.dataStatus = 'researched';
      j.lastReviewed = '2026-06-03';
      writeJson(fp, j);
      upgraded.push(`${j.id}\t${j.commonName}`);
    } else {
      kept.push(`${j.id}\t${j.commonName}\t→ ${verdict.reason}`);
    }
  }
  console.log(`Scanned ${scanned} needs_review fish entries.`);
  console.log(`\n=== UPGRADED to researched (${upgraded.length}) ===`);
  for (const u of upgraded) console.log('  ' + u);
  console.log(`\n=== KEPT as needs_review (${kept.length}) ===`);
  for (const k of kept.slice(0, 100)) console.log('  ' + k);
  if (kept.length > 100) console.log(`  ... +${kept.length - 100} more`);
}
