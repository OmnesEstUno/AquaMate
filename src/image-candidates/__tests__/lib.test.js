const {
  isCommercialFriendly,
  mapSourceType,
  buildCandidate,
  assertCandidateSet,
  isGenusLevel,
} = require('../lib');

describe('isCommercialFriendly', () => {
  test.each([
    'CC0', 'CC0 1.0', 'Public Domain', 'CC BY 4.0', 'cc-by', 'CC BY-SA 4.0', 'cc-by-sa',
    'Creative Commons Attribution 4.0', 'Creative Commons Attribution-ShareAlike 4.0',
    'https://creativecommons.org/licenses/by/4.0/', 'https://creativecommons.org/licenses/by-sa/4.0/',
    'no known copyright', 'PDM',
  ])(
    'accepts %s', (l) => expect(isCommercialFriendly(l)).toBe(true)
  );
  test.each([
    'CC BY-NC 4.0', 'cc-by-nc', 'CC BY-ND 2.0', 'cc-by-nc-sa',
    'All rights reserved', '', null, undefined, 'GFDL',
    'CC BY-NC4.0', 'cc-by-ncnd', 'https://creativecommons.org/licenses/by-nc/4.0/', 'CC BY-NC-ND 4.0',
  ])('rejects %s', (l) => expect(isCommercialFriendly(l)).toBe(false));
});

describe('mapSourceType', () => {
  test('wikimedia', () => expect(mapSourceType('Wikimedia Commons')).toBe('wikimedia'));
  test('inaturalist -> research-site', () => expect(mapSourceType('iNaturalist')).toBe('research-site'));
  test('flickr -> other', () => expect(mapSourceType('Flickr')).toBe('other'));
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
  test('with max=5, accepts 5 (one recommended)', () =>
    expect(() => assertCandidateSet([rec, notRec, notRec, notRec, notRec], 5)).not.toThrow());
  test('with max=5, rejects 6', () =>
    expect(() => assertCandidateSet([rec, notRec, notRec, notRec, notRec, notRec], 5)).toThrow(/at most 5/));
  test('default max is still 3', () =>
    expect(() => assertCandidateSet([rec, notRec, notRec, notRec])).toThrow(/at most 3/));
});

describe('isGenusLevel', () => {
  test.each(['Acropora', 'Acropora sp.', 'Acropora spp.', 'Bucephalandra sp', 'Caulerpa species'])(
    'true for genus %s', (s) => expect(isGenusLevel(s)).toBe(true)
  );
  test.each(['Paracheirodon innesi', 'Caridina multidentata', 'Acropora millepora', '', null, undefined])(
    'false for %s', (s) => expect(isGenusLevel(s)).toBe(false)
  );
});
