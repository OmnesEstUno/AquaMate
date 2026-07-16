'use strict';

// Commercial-friendly only: CC0, Public Domain, CC BY, CC BY-SA (short, long, or URL form).
// Reject NonCommercial (NC), NoDerivatives (ND) — including separator-less variants —
// plus all-rights-reserved and GFDL.
const REJECT_WORDS = /non[- ]?commercial|no[- ]?deriv|all rights reserved|gfdl/i;
const ACCEPT = /cc0|cc[- ]?by|creative commons attribution|public domain|publicdomain|pdm|no known copyright|creativecommons\.org\/(licenses\/by|publicdomain)/i;

// True if any license sub-token contains an "nc"/"nd" modifier, even when mashed with
// version digits or other tokens (e.g. "nc4", "ncnd"). Splitting on separators first
// keeps cross-word false positives out (e.g. "known copyright" never forms "nc").
function hasNcNdToken(s) {
  return s
    .split(/[\s\-_/.()]+/)
    .filter(Boolean)
    .map((t) => t.replace(/[0-9]+/g, ''))
    .some((t) => t.includes('nc') || t.includes('nd'));
}

function isCommercialFriendly(license) {
  if (!license || typeof license !== 'string') return false;
  const s = license.trim().toLowerCase();
  if (!s) return false;
  if (REJECT_WORDS.test(s)) return false;
  if (hasNcNdToken(s)) return false;
  return ACCEPT.test(s);
}

function mapSourceType(source) {
  const s = (source || '').toLowerCase();
  if (s.includes('wikimedia') || s.includes('commons')) return 'wikimedia';
  if (s.includes('inaturalist') || s.includes('inat')) return 'research-site';
  return 'other';
}

const KEYS = ['url', 'source', 'sourceType', 'license', 'notes', 'recommended'];

function buildCandidate(raw) {
  const url = (raw.url || '').trim();
  const source = (raw.source || '').trim();
  if (!url) throw new Error('candidate missing url');
  if (!source) throw new Error('candidate missing source');
  try {
    new URL(url); // fail fast on malformed URLs at the responsible agent, not the batch gate
  } catch (e) {
    throw new Error(`candidate has invalid url: ${url}`);
  }
  return {
    url,
    source,
    sourceType: raw.sourceType || mapSourceType(source),
    license: raw.license ? String(raw.license).trim() : null,
    notes: raw.notes ? String(raw.notes).trim() : null,
    recommended: Boolean(raw.recommended),
  };
}

// Genus-level entries (scientificName is a bare genus like "Acropora" or "Acropora sp.")
// carry more candidates so the gallery can show the range of species in the genus.
function isGenusLevel(scientificName) {
  const s = (scientificName || '').trim();
  if (!s) return false;
  const toks = s.split(/\s+/);
  if (toks.length === 1) return true;
  if (toks.length === 2 && /^(sp|spp|species)\.?$/i.test(toks[1])) return true;
  return false;
}

// Per-entry candidate caps. Species show one image set; bare-genus entries show many
// species; color-morph "umbrella" species (a single binomial with many named variants,
// e.g. Neocaridina davidi) are a small hand-curated allowlist that shows the most.
const SPECIES_MAX = 3;
const GENUS_MAX = 20;
const UMBRELLA_MAX = 24;

// Color-morph umbrella entries by id. Not auto-detectable (alsoKnownAs length is noisy),
// so maintained by hand. Add ids here to grant an entry the umbrella cap.
const UMBRELLA_IDS = new Set([
  'fw-crus-001', // Cherry Shrimp (Neocaridina davidi) — Sakura/Fire Red/Bloody Mary/Blue Dream/Rili/...
  'fw-crus-002', // Crystal Red Shrimp (Caridina cantonensis) — CRS/CBS grades, Taiwan bee morphs
  'fw-crus-003', // Taiwan Bee Shrimp (Caridina mariae) — Blue Bolt/King Kong/Panda/Wine Red/...
]);

function targetCount(entry) {
  const e = entry || {};
  if (UMBRELLA_IDS.has(e.id)) return UMBRELLA_MAX;
  if (isGenusLevel(e.scientificName)) return GENUS_MAX;
  return SPECIES_MAX;
}

function assertCandidateSet(candidates, max = 3) {
  if (!Array.isArray(candidates)) throw new Error('candidates must be an array');
  if (candidates.length > max) throw new Error(`at most ${max} candidates, got ${candidates.length}`);
  const recommended = candidates.filter((c) => c.recommended);
  if (candidates.length > 0 && recommended.length !== 1) {
    throw new Error(`exactly one recommended required when non-empty, got ${recommended.length}`);
  }
  for (const c of candidates) {
    for (const k of KEYS) {
      if (!(k in c)) throw new Error(`candidate missing key: ${k}`);
    }
    if (!isCommercialFriendly(c.license)) {
      throw new Error(`non-commercial-friendly license: ${c.license}`);
    }
  }
}

module.exports = {
  isCommercialFriendly,
  mapSourceType,
  buildCandidate,
  assertCandidateSet,
  isGenusLevel,
  targetCount,
  UMBRELLA_IDS,
};
