const { whichFieldMatched } = require('../filters');

describe('whichFieldMatched', () => {
  const CARDINAL = {
    commonName: 'Cardinal Tetra',
    scientificName: 'Paracheirodon axelrodi',
    alsoKnownAs: ['Red Neon Tetra', 'Cardinal'],
  };
  const SAMMARA = {
    commonName: 'Sammara Squirrelfish',
    scientificName: 'Neoniphon sammara',
    alsoKnownAs: [],
  };
  const NEON = {
    commonName: 'Neon Tetra',
    scientificName: 'Paracheirodon innesi',
    alsoKnownAs: [],
  };

  test('empty query returns null', () => {
    expect(whichFieldMatched(CARDINAL, '')).toBeNull();
    expect(whichFieldMatched(CARDINAL, '   ')).toBeNull();
    expect(whichFieldMatched(CARDINAL, null)).toBeNull();
  });

  test('commonName hit wins over scientificName hit', () => {
    // "neon" matches Neon Tetra's commonName; also matches Neoniphon (scientific).
    expect(whichFieldMatched(NEON, 'neon')).toBe('commonName');
  });

  test('scientificName only', () => {
    // "neoniphon" only in scientificName:
    expect(whichFieldMatched(SAMMARA, 'neoniphon')).toBe('scientificName');
  });

  test('alsoKnownAs when common+scientific miss', () => {
    // "red neon" matches Cardinal Tetra's alsoKnownAs "Red Neon Tetra"
    expect(whichFieldMatched(CARDINAL, 'red neon')).toBe('alsoKnownAs');
  });

  test('priority: common > scientific > AKA', () => {
    // "cardinal" is in commonName AND alsoKnownAs. Expect commonName wins.
    expect(whichFieldMatched(CARDINAL, 'cardinal')).toBe('commonName');
  });

  test('case-insensitive', () => {
    expect(whichFieldMatched(CARDINAL, 'CARDINAL')).toBe('commonName');
    expect(whichFieldMatched(CARDINAL, 'RED NEON')).toBe('alsoKnownAs');
  });

  test('no match returns null', () => {
    expect(whichFieldMatched(CARDINAL, 'clownfish')).toBeNull();
  });

  test('null/missing fields do not crash', () => {
    const ITEM = { commonName: null, scientificName: null, alsoKnownAs: null };
    expect(whichFieldMatched(ITEM, 'anything')).toBeNull();
  });
});
