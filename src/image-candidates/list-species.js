'use strict';

const fs = require('fs');
const path = require('path');
const { globSync } = require('glob');

const SPECIES_DIR = path.resolve(__dirname, '..', 'species');

function buildWorklist(speciesDir = SPECIES_DIR) {
  const files = globSync('**/*.json', { cwd: speciesDir, absolute: true });
  return files
    .map((file) => {
      const e = JSON.parse(fs.readFileSync(file, 'utf8'));
      return {
        file,
        id: e.id,
        slug: e.slug,
        taxon: e.taxon,
        waterType: e.waterType,
        commonName: e.commonName,
        scientificName: e.scientificName,
        alsoKnownAs: e.alsoKnownAs || [],
      };
    })
    .sort((a, b) => String(a.id).localeCompare(String(b.id)));
}

if (require.main === module) {
  process.stdout.write(JSON.stringify(buildWorklist(), null, 2) + '\n');
}

module.exports = { buildWorklist };
