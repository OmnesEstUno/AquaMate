const fs = require('fs');
const path = require('path');

function normalizeCommonName(name) {
  return String(name).trim().toLowerCase().replace(/\s+/g, ' ');
}

function readJsonFilesRecursive(dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...readJsonFilesRecursive(full));
    } else if (entry.isFile() && entry.name.endsWith('.json')) {
      out.push(full);
    }
  }
  return out;
}

function buildDedupList({ speciesDir, kind, waterType }) {
  const files = readJsonFilesRecursive(speciesDir);
  const seen = new Set();
  const out = [];
  for (const file of files) {
    let species;
    try {
      species = JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch (err) {
      throw new Error(`Failed to parse ${file}: ${err.message}`);
    }
    if (species.kind !== kind || species.waterType !== waterType) continue;
    const scientificName = species.scientificName == null || species.scientificName === ''
      ? null
      : species.scientificName;
    const commonNameNormalized = normalizeCommonName(species.commonName);
    const key = `${scientificName ?? '<none>'}|${commonNameNormalized}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ scientificName, commonNameNormalized });
  }
  out.sort((a, b) => {
    const sa = a.scientificName ?? '';
    const sb = b.scientificName ?? '';
    if (sa !== sb) return sa < sb ? -1 : 1;
    return a.commonNameNormalized < b.commonNameNormalized ? -1 : a.commonNameNormalized > b.commonNameNormalized ? 1 : 0;
  });
  return out;
}

module.exports = { buildDedupList, normalizeCommonName };
