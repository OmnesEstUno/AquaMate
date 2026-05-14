const fs = require('fs');
const os = require('os');
const path = require('path');
const { compile } = require('../compile');

function withTempDir(fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aquamate-compile-'));
  try { return fn(dir); } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}

function writeSpeciesFile(speciesDir, taxon, slug, overrides) {
  const taxonDir = path.join(speciesDir, taxon);
  fs.mkdirSync(taxonDir, { recursive: true });
  const fixturePath = path.resolve(__dirname, '..', '..', 'species-schema', '__tests__', 'fixtures', 'valid-fish-placeholder.json');
  const base = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
  const entry = { ...base, slug, ...overrides };
  fs.writeFileSync(path.join(taxonDir, `${slug}.json`), JSON.stringify(entry, null, 2));
}

describe('compile.js', () => {
  test('emits the expected top-level structure with all kind/waterType buckets present (empty if no species)', () => {
    withTempDir(speciesDir => {
      withTempDir(distDir => {
        const outPath = path.join(distDir, 'species.json');
        compile({ speciesDir, outPath });
        const out = JSON.parse(fs.readFileSync(outPath, 'utf8'));
        expect(out).toEqual({
          fauna: { freshwater: { items: [] }, saltwater: { items: [] }, brackish: { items: [] } },
          flora: { freshwater: { items: [] }, saltwater: { items: [] }, brackish: { items: [] } }
        });
      });
    });
  });

  test('groups fish entries under fauna.freshwater', () => {
    withTempDir(speciesDir => {
      writeSpeciesFile(speciesDir, 'fish', 'a', { id: 'fw-100', commonName: 'A', kind: 'fauna', taxon: 'fish', waterType: 'freshwater' });
      writeSpeciesFile(speciesDir, 'fish', 'b', { id: 'fw-101', commonName: 'B', kind: 'fauna', taxon: 'fish', waterType: 'freshwater' });
      withTempDir(distDir => {
        const outPath = path.join(distDir, 'species.json');
        compile({ speciesDir, outPath });
        const out = JSON.parse(fs.readFileSync(outPath, 'utf8'));
        expect(out.fauna.freshwater.items).toHaveLength(2);
        expect(out.fauna.saltwater.items).toHaveLength(0);
        expect(out.flora.freshwater.items).toHaveLength(0);
      });
    });
  });

  test('groups coral entries under fauna.saltwater', () => {
    withTempDir(speciesDir => {
      writeSpeciesFile(speciesDir, 'coral', 'c', { id: 'sw-coral-001', commonName: 'C', kind: 'fauna', taxon: 'coral', waterType: 'saltwater' });
      withTempDir(distDir => {
        const outPath = path.join(distDir, 'species.json');
        compile({ speciesDir, outPath });
        const out = JSON.parse(fs.readFileSync(outPath, 'utf8'));
        expect(out.fauna.saltwater.items).toHaveLength(1);
      });
    });
  });

  test('groups plant entries under flora.freshwater', () => {
    withTempDir(speciesDir => {
      writeSpeciesFile(speciesDir, 'plant', 'd', { id: 'fl-001', commonName: 'D', kind: 'flora', taxon: 'plant', waterType: 'freshwater' });
      withTempDir(distDir => {
        const outPath = path.join(distDir, 'species.json');
        compile({ speciesDir, outPath });
        const out = JSON.parse(fs.readFileSync(outPath, 'utf8'));
        expect(out.flora.freshwater.items).toHaveLength(1);
      });
    });
  });

  test('creates dist directory if missing', () => {
    withTempDir(speciesDir => {
      writeSpeciesFile(speciesDir, 'fish', 'e', { id: 'fw-200', commonName: 'E', kind: 'fauna', taxon: 'fish', waterType: 'freshwater' });
      withTempDir(parent => {
        const distDir = path.join(parent, 'doesnt', 'exist', 'yet');
        const outPath = path.join(distDir, 'species.json');
        compile({ speciesDir, outPath });
        expect(fs.existsSync(outPath)).toBe(true);
      });
    });
  });
});
