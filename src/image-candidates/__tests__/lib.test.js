const {
  isCommercialFriendly,
  mapSourceType,
  buildCandidate,
  assertCandidateSet,
  isGenusLevel,
  targetCount,
} = require('../lib');

describe('isCommercialFriendly', () => {
  test.each([
    'CC0', 'CC0 1.0', 'Public Domain', 'CC BY 4.0', 'cc-by', 'CC BY-SA 4.0', 'cc-by-sa',
    'Creative Commons Attribution 4.0', 'Creative Commons Attribution-ShareAlike 4.0',
    'https://creativecommons.org/licenses/by/4.0/', 'https://creativecommons.org/licenses/by-sa/4.0/',
    'no known copyright', 'PDM',
    'CC_BY_4.0', 'CC_BY_SA_4.0', 'cc_by',
  ])(
    'accepts %s', (l) => expect(isCommercialFriendly(l)).toBe(true)
  );
  test.each([
    'CC BY-NC 4.0', 'cc-by-nc', 'CC BY-ND 2.0', 'cc-by-nc-sa',
    'All rights reserved', '', null, undefined, 'GFDL',
    'CC BY-NC4.0', 'cc-by-ncnd', 'https://creativecommons.org/licenses/by-nc/4.0/', 'CC BY-NC-ND 4.0',
    'CC_BY_NC_4.0', 'CC_BY_NC_SA_4.0',
  ])('rejects %s', (l) => expect(isCommercialFriendly(l)).toBe(false));
});

describe('mapSourceType', () => {
  test('wikimedia', () => expect(mapSourceType('Wikimedia Commons')).toBe('wikimedia'));
  test('inaturalist -> research-site', () => expect(mapSourceType('iNaturalist')).toBe('research-site'));
  test('gbif -> research-site', () => expect(mapSourceType('GBIF')).toBe('research-site'));
  test('eol -> research-site', () => expect(mapSourceType('Encyclopedia of Life')).toBe('research-site'));
  test('flickr -> other', () => expect(mapSourceType('Flickr')).toBe('other'));
  test('flickr commons -> other (not wikimedia)', () => expect(mapSourceType('Flickr Commons')).toBe('other'));
});

describe('buildCandidate', () => {
  test('normalizes to six keys', () => {
    const c = buildCandidate({ url: ' http://x/a.jpg ', source: 'Wikimedia Commons', license: 'CC BY 4.0', notes: 'n', recommended: true });
    expect(c).toEqual({
      url: 'http://x/a.jpg', source: 'Wikimedia Commons', sourceType: 'wikimedia',
      license: 'CC BY 4.0', notes: 'n', recommended: true,
    });
  });
  test('throws without url', () => expect(() => buildCandidate({ source: 'x' })).toThrow(/url/));
  test('throws without source', () => expect(() => buildCandidate({ url: 'http://x' })).toThrow(/source/));
  test('throws on malformed url', () => expect(() => buildCandidate({ url: 'not-a-url', source: 'x' })).toThrow(/invalid url/));
});

describe('assertCandidateSet', () => {
  const ok = { url: 'http://x/a.jpg', source: 'Wikimedia Commons', sourceType: 'wikimedia', license: 'CC BY 4.0', notes: null, recommended: true };
  test('accepts empty', () => expect(() => assertCandidateSet([])).not.toThrow());
  test('accepts one recommended', () => expect(() => assertCandidateSet([ok])).not.toThrow());
  test('rejects more than 3', () => expect(() => assertCandidateSet([ok, ok, ok, ok])).toThrow(/at most 3/));
  test('rejects zero recommended in non-empty set', () =>
    expect(() => assertCandidateSet([{ ...ok, recommended: false }])).toThrow(/exactly one recommended/));
  test('rejects two recommended', () =>
    expect(() => assertCandidateSet([ok, { ...ok, recommended: true }])).toThrow(/exactly one recommended/));
  test('rejects non-commercial license', () =>
    expect(() => assertCandidateSet([{ ...ok, license: 'CC BY-NC 4.0' }])).toThrow(/license/));

  const rec = ok;
  const notRec = { ...ok, recommended: false };
  const many = (n) => [rec, ...Array.from({ length: n - 1 }, () => notRec)];
  test('with max=20, accepts 20 (one recommended)', () =>
    expect(() => assertCandidateSet(many(20), 20)).not.toThrow());
  test('with max=20, rejects 21', () =>
    expect(() => assertCandidateSet(many(21), 20)).toThrow(/at most 20/));
  test('default max is still 3', () =>
    expect(() => assertCandidateSet(many(4))).toThrow(/at most 3/));
});

describe('targetCount', () => {
  test('species entry -> 3', () =>
    expect(targetCount({ id: 'fw-fish-001', scientificName: 'Paracheirodon innesi' })).toBe(3));
  test('genus entry -> 20', () =>
    expect(targetCount({ id: 'sw-coral-001', scientificName: 'Acropora' })).toBe(20));
  test('genus sp. entry -> 20', () =>
    expect(targetCount({ id: 'fw-plant-016', scientificName: 'Bucephalandra sp.' })).toBe(20));
  test('umbrella allowlist id -> 24 (even though binomial)', () =>
    expect(targetCount({ id: 'fw-crus-001', scientificName: 'Neocaridina davidi' })).toBe(24));
});

describe('isGenusLevel', () => {
  test.each(['Acropora', 'Acropora sp.', 'Acropora spp.', 'Bucephalandra sp', 'Caulerpa species'])(
    'true for genus %s', (s) => expect(isGenusLevel(s)).toBe(true)
  );
  test.each(['Paracheirodon innesi', 'Caridina multidentata', 'Acropora millepora', '', null, undefined])(
    'false for %s', (s) => expect(isGenusLevel(s)).toBe(false)
  );
});
