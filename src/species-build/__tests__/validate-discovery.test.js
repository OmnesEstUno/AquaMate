const fs = require('fs');
const os = require('os');
const path = require('path');
const { validateDiscoveryDir, validateOneManifest } = require('../validate-discovery');

const validFixturePath = path.resolve(__dirname, '..', '..', 'species-schema', '__tests__', 'fixtures', 'valid-manifest.json');

function loadValid() {
  return JSON.parse(JSON.stringify(JSON.parse(fs.readFileSync(validFixturePath, 'utf8'))));
}

function withTempDir(fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aquamate-vd-'));
  try { return fn(dir); } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}

function writeManifest(dir, name, payload) {
  fs.writeFileSync(path.join(dir, name), JSON.stringify(payload, null, 2));
}

describe('validate-discovery', () => {
  test('validateOneManifest accepts the valid fixture', () => {
    const result = validateOneManifest(loadValid());
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  test('validateOneManifest rejects unknown top-level fields', () => {
    const m = loadValid();
    m.surprise = 1;
    const result = validateOneManifest(m);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  test('validateDiscoveryDir returns ok=true for an empty discovery dir', () => {
    withTempDir(dir => {
      const result = validateDiscoveryDir(dir);
      expect(result.ok).toBe(true);
      expect(result.fileResults).toEqual([]);
    });
  });

  test('validateDiscoveryDir returns ok=true when every manifest is valid', () => {
    withTempDir(dir => {
      writeManifest(dir, 'fish-freshwater.json', loadValid());
      const m2 = loadValid();
      m2.meta.taxon = 'coral';
      m2.meta.waterType = 'saltwater';
      writeManifest(dir, 'coral-saltwater.json', m2);
      const result = validateDiscoveryDir(dir);
      expect(result.ok).toBe(true);
      expect(result.fileResults).toHaveLength(2);
      expect(result.fileResults.every(r => r.valid)).toBe(true);
    });
  });

  test('validateDiscoveryDir returns ok=false when any manifest is invalid', () => {
    withTempDir(dir => {
      writeManifest(dir, 'good.json', loadValid());
      const bad = loadValid();
      bad.entries[0].popularityScore = 99;
      writeManifest(dir, 'bad.json', bad);
      const result = validateDiscoveryDir(dir);
      expect(result.ok).toBe(false);
      const badResult = result.fileResults.find(r => r.file.endsWith('bad.json'));
      expect(badResult.valid).toBe(false);
      expect(badResult.errors.length).toBeGreaterThan(0);
    });
  });

  test('validateDiscoveryDir ignores non-JSON files', () => {
    withTempDir(dir => {
      writeManifest(dir, 'fish-freshwater.json', loadValid());
      fs.writeFileSync(path.join(dir, 'README.md'), '# notes');
      const result = validateDiscoveryDir(dir);
      expect(result.fileResults).toHaveLength(1);
      expect(result.ok).toBe(true);
    });
  });
});
