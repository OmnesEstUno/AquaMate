const fs = require('fs');
const os = require('os');
const path = require('path');
const { globSync } = require('glob');
const { applyCandidates } = require('../apply-candidates');
const { validateOne } = require('../../species-build/validate');

const SPECIES_DIR = path.resolve(__dirname, '../../species');
// Use a real, schema-valid species entry as the fixture. The shared schema test
// fixtures (species-schema/__tests__/fixtures) are stale re: newer required
// fields; real catalog data is backfilled and validates cleanly.
const SAMPLE = globSync('fish/*.json', { cwd: SPECIES_DIR, absolute: true }).sort()[0];

function tmpCopy() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'apply-cand-'));
  const dest = path.join(dir, 'entry.json');
  fs.copyFileSync(SAMPLE, dest);
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
