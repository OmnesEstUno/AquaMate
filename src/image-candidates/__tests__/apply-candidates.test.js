const fs = require('fs');
const os = require('os');
const path = require('path');
const { globSync } = require('glob');
const { applyCandidates } = require('../apply-candidates');
const { validateOne } = require('../../species-build/validate');
const { isGenusLevel } = require('../lib');

const SPECIES_DIR = path.resolve(__dirname, '../../species');
// Use real, schema-valid species entries as fixtures. The shared schema test
// fixtures (species-schema/__tests__/fixtures) are stale re: newer required
// fields; real catalog data is backfilled and validates cleanly.
const ALL = globSync('**/*.json', { cwd: SPECIES_DIR, absolute: true }).sort();
const SAMPLE = ALL.find((f) => !isGenusLevel(JSON.parse(fs.readFileSync(f, 'utf8')).scientificName));
const GENUS_SAMPLE = ALL.find((f) => isGenusLevel(JSON.parse(fs.readFileSync(f, 'utf8')).scientificName));

function tmpCopy(src = SAMPLE) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'apply-cand-'));
  const dest = path.join(dir, 'entry.json');
  fs.copyFileSync(src, dest);
  return dest;
}

const CAND = {
  url: 'https://upload.wikimedia.org/wikipedia/commons/a/aa/Fish.jpg',
  source: 'Wikimedia Commons', license: 'CC BY-SA 4.0', notes: 'sharp lateral view', recommended: true,
};

test('writes only imageCandidates and leaves primaryImage/gallery untouched', () => {
  const file = tmpCopy();
  const before = JSON.parse(fs.readFileSync(file, 'utf8'));
  applyCandidates(file, [CAND, { ...CAND, recommended: false, url: 'https://upload.wikimedia.org/b/Fish2.jpg' }]);
  const after = JSON.parse(fs.readFileSync(file, 'utf8'));
  expect(after.media.imageCandidates).toHaveLength(2);
  expect(after.media.imageCandidates[0].sourceType).toBe('wikimedia');
  expect(after.media.primaryImage).toEqual(before.media.primaryImage);
  expect(after.media.gallery).toEqual(before.media.gallery);
  expect(validateOne(file).ok).toBe(true);
});

test('empty result writes an empty array and still validates', () => {
  const file = tmpCopy();
  applyCandidates(file, []);
  const after = JSON.parse(fs.readFileSync(file, 'utf8'));
  expect(after.media.imageCandidates).toEqual([]);
  expect(validateOne(file).ok).toBe(true);
});

test('caps at 3 candidates', () => {
  const file = tmpCopy();
  applyCandidates(file, [
    CAND,
    { ...CAND, recommended: false, url: 'https://x/2.jpg' },
    { ...CAND, recommended: false, url: 'https://x/3.jpg' },
    { ...CAND, recommended: false, url: 'https://x/4.jpg' },
  ]);
  expect(JSON.parse(fs.readFileSync(file, 'utf8')).media.imageCandidates).toHaveLength(3);
});

test('rejects a non-commercial license (throws, writes nothing)', () => {
  const file = tmpCopy();
  expect(() => applyCandidates(file, [{ ...CAND, license: 'CC BY-NC 4.0' }])).toThrow(/license/);
});

test('genus entry accepts up to 5 candidates and still validates', () => {
  expect(GENUS_SAMPLE).toBeDefined(); // catalog has genus-level entries
  const file = tmpCopy(GENUS_SAMPLE);
  applyCandidates(file, [
    CAND,
    { ...CAND, recommended: false, url: 'https://x/2.jpg' },
    { ...CAND, recommended: false, url: 'https://x/3.jpg' },
    { ...CAND, recommended: false, url: 'https://x/4.jpg' },
    { ...CAND, recommended: false, url: 'https://x/5.jpg' },
  ]);
  const after = JSON.parse(fs.readFileSync(file, 'utf8'));
  expect(after.media.imageCandidates).toHaveLength(5);
  expect(validateOne(file).ok).toBe(true);
});
