'use strict';

const fs = require('fs');
const { buildCandidate, assertCandidateSet, isGenusLevel } = require('./lib');

function applyCandidates(speciesFile, rawCandidates) {
  const data = JSON.parse(fs.readFileSync(speciesFile, 'utf8'));
  if (!data.media || typeof data.media !== 'object') {
    throw new Error(`no media object in ${speciesFile}`);
  }
  // Genus entries get up to 5 (schema max) to show species range; species get 3.
  const max = isGenusLevel(data.scientificName) ? 5 : 3;
  const candidates = (rawCandidates || []).slice(0, max).map(buildCandidate);
  assertCandidateSet(candidates, max);
  // Only touch imageCandidates; leave primaryImage & gallery untouched.
  data.media.imageCandidates = candidates;
  fs.writeFileSync(speciesFile, JSON.stringify(data, null, 2) + '\n');
  return candidates;
}

if (require.main === module) {
  const [speciesFile, candidatesFile] = process.argv.slice(2);
  if (!speciesFile || !candidatesFile) {
    console.error('usage: node apply-candidates.js <speciesFile> <candidatesJsonFile>');
    process.exit(2);
  }
  try {
    const raw = JSON.parse(fs.readFileSync(candidatesFile, 'utf8'));
    const written = applyCandidates(speciesFile, raw);
    console.log(`Wrote ${written.length} candidate(s) to ${speciesFile}`);
  } catch (e) {
    console.error(`Failed: ${e.message}`);
    process.exit(1);
  }
}

module.exports = { applyCandidates };
