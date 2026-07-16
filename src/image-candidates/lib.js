'use strict';

// Commercial-friendly only: CC0, Public Domain, CC BY, CC BY-SA.
// Reject NonCommercial (NC), NoDerivatives (ND), all-rights-reserved, GFDL, unknown.
const REJECT = /\bnc\b|\bnd\b|non[- ]?commercial|no[- ]?deriv|all rights reserved|gfdl/i;
const ACCEPT = /(^|[^a-z])(cc0|cc[- ]?by([- ]?sa)?|public domain|pdm|no known copyright)([^a-z]|$)/i;

function isCommercialFriendly(license) {
  if (!license || typeof license !== 'string') return false;
  const s = license.trim().toLowerCase();
  if (!s) return false;
  if (REJECT.test(s)) return false;
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
  return {
    url,
    source,
    sourceType: raw.sourceType || mapSourceType(source),
    license: raw.license ? String(raw.license).trim() : null,
    notes: raw.notes ? String(raw.notes).trim() : null,
    recommended: Boolean(raw.recommended),
  };
}

function assertCandidateSet(candidates) {
  if (!Array.isArray(candidates)) throw new Error('candidates must be an array');
  if (candidates.length > 3) throw new Error(`at most 3 candidates, got ${candidates.length}`);
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

module.exports = { isCommercialFriendly, mapSourceType, buildCandidate, assertCandidateSet };
