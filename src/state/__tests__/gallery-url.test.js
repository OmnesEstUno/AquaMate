const { encodeState, decodeState } = require('../gallery-url');

describe('gallery-url roundtrip', () => {
  const cases = [
    { name: 'empty', state: {}, expected: '' },
    { name: 'seed only', state: { seed: 8472 }, expected: 'sd8472' },
    { name: 'freshwater', state: { waterType: ['freshwater'], seed: 8472 }, expected: 'w1.sd8472' },
    { name: 'reef-safe inverts preset', state: { taxa: ['crustacean', 'mollusc', 'echinoderm'], waterType: ['saltwater'], reefSafe: true, seed: 8472 }, expected: 't26.w2.rs1.sd8472' },
    { name: 'nano plants', state: { taxa: ['plant'], waterType: ['freshwater'], maxSize: 10, maxTankL: 40, seed: 8472 }, expected: 't64.w1.mx10.tk40.sd8472' },
    { name: 'plants + co2 recommended + sort desc', state: { taxa: ['plant'], co2: ['recommended'], sort: 'size-desc', seed: 8472 }, expected: 't64.co4.srsize-desc.sd8472' },
    { name: 'page 2', state: { waterType: ['freshwater'], seed: 8472, page: 2 }, expected: 'w1.sd8472.p2' },
  ];

  for (const { name, state, expected } of cases) {
    test(`encode: ${name}`, () => {
      expect(encodeState(state)).toBe(expected);
    });
    test(`decode: ${name}`, () => {
      const decoded = decodeState(expected);
      for (const key of Object.keys(state)) {
        if (Array.isArray(state[key])) {
          expect(decoded[key].sort()).toEqual(state[key].slice().sort());
        } else {
          expect(decoded[key]).toEqual(state[key]);
        }
      }
    });
  }

  test('decode empty returns defaults', () => {
    const d = decodeState('');
    expect(d.page).toBe(1);
    expect(d.sort).toBe('random');
  });

  test('decode ignores unknown keys', () => {
    const d = decodeState('t1.xxx99');
    expect(d.taxa).toEqual(['fish']);
    expect(d.xxx).toBeUndefined();
  });
});
