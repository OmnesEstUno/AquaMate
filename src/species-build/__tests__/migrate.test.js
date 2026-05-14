const fs = require('fs');
const os = require('os');
const path = require('path');
const { migrate } = require('../migrate-from-legacy');

const FIXTURES = path.resolve(__dirname, 'fixtures');

function withTempDir(fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aquamate-migrate-'));
  try { return fn(dir); } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}

describe('migrate-from-legacy', () => {
  test('emits per-species files into <speciesDir>/<taxon>/<slug>.json', () => {
    withTempDir(speciesDir => {
      const report = migrate({
        faunaPath: path.join(FIXTURES, 'legacy-fauna-mini.json'),
        floraPath: path.join(FIXTURES, 'legacy-flora-mini.json'),
        speciesDir
      });
      expect(report.written.length).toBeGreaterThan(0);
      const neonPath = path.join(speciesDir, 'fish', 'neon-tetra.json');
      expect(fs.existsSync(neonPath)).toBe(true);
    });
  });

  test('infers taxon "crustacean" from "shrimp" keyword', () => {
    withTempDir(speciesDir => {
      migrate({
        faunaPath: path.join(FIXTURES, 'legacy-fauna-mini.json'),
        floraPath: path.join(FIXTURES, 'legacy-flora-mini.json'),
        speciesDir
      });
      const cherryPath = path.join(speciesDir, 'crustacean', 'cherry-shrimp.json');
      expect(fs.existsSync(cherryPath)).toBe(true);
      const cherry = JSON.parse(fs.readFileSync(cherryPath, 'utf8'));
      expect(cherry.taxon).toBe('crustacean');
      expect(cherry.kind).toBe('fauna');
    });
  });

  test('defaults to taxon "fish" for fauna entries without keyword matches', () => {
    withTempDir(speciesDir => {
      migrate({
        faunaPath: path.join(FIXTURES, 'legacy-fauna-mini.json'),
        floraPath: path.join(FIXTURES, 'legacy-flora-mini.json'),
        speciesDir
      });
      const neon = JSON.parse(fs.readFileSync(path.join(speciesDir, 'fish', 'neon-tetra.json'), 'utf8'));
      expect(neon.taxon).toBe('fish');
    });
  });

  test('flora entries default to taxon "plant"', () => {
    withTempDir(speciesDir => {
      migrate({
        faunaPath: path.join(FIXTURES, 'legacy-fauna-mini.json'),
        floraPath: path.join(FIXTURES, 'legacy-flora-mini.json'),
        speciesDir
      });
      const fern = JSON.parse(fs.readFileSync(path.join(speciesDir, 'plant', 'java-fern.json'), 'utf8'));
      expect(fern.taxon).toBe('plant');
      expect(fern.kind).toBe('flora');
    });
  });

  test('preserves id verbatim, moves image_url to media.primaryImage, moves description to summary', () => {
    withTempDir(speciesDir => {
      migrate({
        faunaPath: path.join(FIXTURES, 'legacy-fauna-mini.json'),
        floraPath: path.join(FIXTURES, 'legacy-flora-mini.json'),
        speciesDir
      });
      const neon = JSON.parse(fs.readFileSync(path.join(speciesDir, 'fish', 'neon-tetra.json'), 'utf8'));
      expect(neon.id).toBe('fw-001');
      expect(neon.media.primaryImage).toBe('neon_tetra.webp');
      expect(neon.summary).toBe('Placeholder description for Neon Tetra.');
    });
  });

  test('sets dataStatus to "placeholder"', () => {
    withTempDir(speciesDir => {
      migrate({
        faunaPath: path.join(FIXTURES, 'legacy-fauna-mini.json'),
        floraPath: path.join(FIXTURES, 'legacy-flora-mini.json'),
        speciesDir
      });
      const neon = JSON.parse(fs.readFileSync(path.join(speciesDir, 'fish', 'neon-tetra.json'), 'utf8'));
      expect(neon.dataStatus).toBe('placeholder');
    });
  });

  test('produces output that passes placeholder-mode schema validation', () => {
    withTempDir(speciesDir => {
      const report = migrate({
        faunaPath: path.join(FIXTURES, 'legacy-fauna-mini.json'),
        floraPath: path.join(FIXTURES, 'legacy-flora-mini.json'),
        speciesDir
      });
      const { validateOne } = require('../validate');
      for (const filePath of report.written) {
        const result = validateOne(filePath);
        if (!result.ok) {
          throw new Error(`Validation failed for ${filePath}:\n${JSON.stringify(result.errors, null, 2)}`);
        }
      }
    });
  });

  test('handles slug collisions by suffixing -2, -3, ...', () => {
    withTempDir(speciesDir => {
      // legacy-fauna-mini has two entries named "Neon Tetra" to exercise this
      migrate({
        faunaPath: path.join(FIXTURES, 'legacy-fauna-mini.json'),
        floraPath: path.join(FIXTURES, 'legacy-flora-mini.json'),
        speciesDir
      });
      expect(fs.existsSync(path.join(speciesDir, 'fish', 'neon-tetra.json'))).toBe(true);
      expect(fs.existsSync(path.join(speciesDir, 'fish', 'neon-tetra-2.json'))).toBe(true);
    });
  });

  test('classifies "Coral Beauty" (Angelfish) as fish, not coral', () => {
    withTempDir(speciesDir => {
      const os = require('os');
      const tmpFaunaDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aquamate-coral-beauty-'));
      const tmpFauna = path.join(tmpFaunaDir, 'fauna.json');
      try {
        const legacyFauna = {
          saltwater: {
            pages: [{
              page: 1,
              items: [{
                id: 'sw-054',
                commonName: 'Coral Beauty',
                scientificName: 'Centropyge bispinosa',
                category: 'Angelfish',
                image_url: 'coral_beauty.jpg',
                description: 'A dwarf angelfish, not a coral.'
              }]
            }]
          }
        };
        fs.writeFileSync(tmpFauna, JSON.stringify(legacyFauna));
        migrate({
          faunaPath: tmpFauna,
          floraPath: path.join(FIXTURES, 'legacy-flora-mini.json'),
          speciesDir
        });
        expect(fs.existsSync(path.join(speciesDir, 'fish', 'coral-beauty.json'))).toBe(true);
        expect(fs.existsSync(path.join(speciesDir, 'coral', 'coral-beauty.json'))).toBe(false);
      } finally {
        fs.rmSync(tmpFaunaDir, { recursive: true, force: true });
      }
    });
  });
});
