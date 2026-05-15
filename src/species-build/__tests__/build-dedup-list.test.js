const fs = require('fs');
const os = require('os');
const path = require('path');
const { buildDedupList, normalizeCommonName } = require('../build-dedup-list');

function withTempDir(fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aquamate-dedup-'));
  try { return fn(dir); } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}

function writeSpecies(speciesDir, taxon, slug, payload) {
  const taxonDir = path.join(speciesDir, taxon);
  fs.mkdirSync(taxonDir, { recursive: true });
  fs.writeFileSync(path.join(taxonDir, `${slug}.json`), JSON.stringify(payload, null, 2));
}

describe('build-dedup-list', () => {
  test('normalizeCommonName lowercases, trims, and collapses whitespace', () => {
    expect(normalizeCommonName('  Neon  Tetra ')).toBe('neon tetra');
    expect(normalizeCommonName('Cherry-Shrimp')).toBe('cherry-shrimp');
    expect(normalizeCommonName("Betta splendens")).toBe('betta splendens');
  });

  test('returns empty list when no species match the slice', () => {
    withTempDir(speciesDir => {
      const out = buildDedupList({ speciesDir, kind: 'fauna', waterType: 'freshwater' });
      expect(out).toEqual([]);
    });
  });

  test('returns entries whose kind+waterType match the slice', () => {
    withTempDir(speciesDir => {
      writeSpecies(speciesDir, 'fish', 'neon-tetra', {
        commonName: 'Neon Tetra', scientificName: 'Paracheirodon innesi',
        kind: 'fauna', waterType: 'freshwater'
      });
      writeSpecies(speciesDir, 'fish', 'clownfish', {
        commonName: 'Clownfish', scientificName: 'Amphiprion ocellaris',
        kind: 'fauna', waterType: 'saltwater'
      });
      writeSpecies(speciesDir, 'plant', 'java-fern', {
        commonName: 'Java Fern', scientificName: 'Microsorum pteropus',
        kind: 'flora', waterType: 'freshwater'
      });
      const out = buildDedupList({ speciesDir, kind: 'fauna', waterType: 'freshwater' });
      expect(out).toEqual([
        { scientificName: 'Paracheirodon innesi', commonNameNormalized: 'neon tetra' }
      ]);
    });
  });

  test('filters across all taxon folders, not just one', () => {
    withTempDir(speciesDir => {
      writeSpecies(speciesDir, 'fish',       'a', { commonName: 'A', scientificName: 'Genus a', kind: 'fauna', waterType: 'freshwater' });
      writeSpecies(speciesDir, 'crustacean', 'b', { commonName: 'B', scientificName: 'Genus b', kind: 'fauna', waterType: 'freshwater' });
      writeSpecies(speciesDir, 'mollusc',    'c', { commonName: 'C', scientificName: 'Genus c', kind: 'fauna', waterType: 'freshwater' });
      const out = buildDedupList({ speciesDir, kind: 'fauna', waterType: 'freshwater' });
      expect(out).toHaveLength(3);
    });
  });

  test('emits scientificName: null when species lacks one', () => {
    withTempDir(speciesDir => {
      writeSpecies(speciesDir, 'fish', 'mystery', {
        commonName: 'Mystery Fish', scientificName: null,
        kind: 'fauna', waterType: 'freshwater'
      });
      const out = buildDedupList({ speciesDir, kind: 'fauna', waterType: 'freshwater' });
      expect(out).toEqual([
        { scientificName: null, commonNameNormalized: 'mystery fish' }
      ]);
    });
  });

  test('emits scientificName: null when species omits the field entirely', () => {
    withTempDir(speciesDir => {
      writeSpecies(speciesDir, 'fish', 'mystery', {
        commonName: 'Mystery Fish',
        kind: 'fauna', waterType: 'freshwater'
      });
      const out = buildDedupList({ speciesDir, kind: 'fauna', waterType: 'freshwater' });
      expect(out).toEqual([
        { scientificName: null, commonNameNormalized: 'mystery fish' }
      ]);
    });
  });

  test('deduplicates identical (scientificName, normalizedCommonName) tuples', () => {
    withTempDir(speciesDir => {
      writeSpecies(speciesDir, 'fish', 'neon-1', {
        commonName: 'Neon Tetra', scientificName: 'Paracheirodon innesi',
        kind: 'fauna', waterType: 'freshwater'
      });
      writeSpecies(speciesDir, 'fish', 'neon-2', {
        commonName: 'NEON tetra', scientificName: 'Paracheirodon innesi',
        kind: 'fauna', waterType: 'freshwater'
      });
      const out = buildDedupList({ speciesDir, kind: 'fauna', waterType: 'freshwater' });
      expect(out).toHaveLength(1);
    });
  });

  test('sorts output by scientificName then commonNameNormalized for stable diffs', () => {
    withTempDir(speciesDir => {
      writeSpecies(speciesDir, 'fish', 'b', { commonName: 'B', scientificName: 'Genus b', kind: 'fauna', waterType: 'freshwater' });
      writeSpecies(speciesDir, 'fish', 'a', { commonName: 'A', scientificName: 'Genus a', kind: 'fauna', waterType: 'freshwater' });
      const out = buildDedupList({ speciesDir, kind: 'fauna', waterType: 'freshwater' });
      expect(out[0].scientificName).toBe('Genus a');
      expect(out[1].scientificName).toBe('Genus b');
    });
  });
});
