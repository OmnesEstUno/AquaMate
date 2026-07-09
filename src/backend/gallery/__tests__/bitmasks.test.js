const { encodeTaxa, decodeTaxa, encodeWaterType, decodeWaterType, encodeCareLevel, decodeCareLevel } = require('../bitmasks');

describe('bitmasks: taxa', () => {
  test('empty array encodes to 0', () => {
    expect(encodeTaxa([])).toBe(0);
  });
  test('single value: fish', () => {
    expect(encodeTaxa(['fish'])).toBe(1);
  });
  test('reef-safe inverts (crustacean+mollusc+echinoderm)', () => {
    expect(encodeTaxa(['crustacean', 'mollusc', 'echinoderm'])).toBe(26);
  });
  test('all 9 taxa', () => {
    expect(encodeTaxa([
      'fish', 'crustacean', 'coral', 'mollusc', 'echinoderm',
      'amphibian', 'plant', 'macroalgae', 'other-invert'
    ])).toBe(511);
  });
  test('roundtrip: decode(encode(x)) === x (sorted)', () => {
    const input = ['coral', 'plant', 'fish'];
    const decoded = decodeTaxa(encodeTaxa(input)).sort();
    expect(decoded).toEqual(['coral', 'fish', 'plant']);
  });
  test('unknown taxon in encoder is silently dropped', () => {
    expect(encodeTaxa(['fish', 'nonsense'])).toBe(1);
  });
  test('decode of 26', () => {
    expect(decodeTaxa(26).sort()).toEqual(['crustacean', 'echinoderm', 'mollusc']);
  });
});

describe('bitmasks: waterType', () => {
  test('freshwater+saltwater = 3', () => {
    expect(encodeWaterType(['freshwater', 'saltwater'])).toBe(3);
  });
  test('brackish alone = 4', () => {
    expect(encodeWaterType(['brackish'])).toBe(4);
  });
  test('roundtrip', () => {
    expect(decodeWaterType(encodeWaterType(['saltwater'])).sort()).toEqual(['saltwater']);
  });
});

describe('bitmasks: careLevel', () => {
  test('beginner+intermediate = 3', () => {
    expect(encodeCareLevel(['beginner', 'intermediate'])).toBe(3);
  });
  test('expert alone = 8', () => {
    expect(encodeCareLevel(['expert'])).toBe(8);
  });
});
