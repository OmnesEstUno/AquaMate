const { matchesFilters, applyFilters } = require('../filters');

const CHERRY_SHRIMP = {
  taxon: 'crustacean', waterType: 'freshwater', careLevel: 'beginner',
  adultSizeCm: { min: 2.5, max: 4 },
  tank: { minVolumeLiters: 20 },
  compatibility: { temperament: 'peaceful', grouping: 'shoaling' },
  diet: { type: 'omnivore' },
  hobbyistAdvisory: null,
};

const CLOWNFISH = {
  taxon: 'fish', waterType: 'saltwater', careLevel: 'beginner',
  adultSizeCm: { min: 6, max: 11 },
  tank: { minVolumeLiters: 75 },
  compatibility: { temperament: 'semi-aggressive', grouping: 'pair' },
  diet: { type: 'omnivore' },
  fish: { reefSafe: 'yes' },
  hobbyistAdvisory: null,
};

const LEOPARD_WRASSE = {
  taxon: 'fish', waterType: 'saltwater', careLevel: 'expert',
  adultSizeCm: { min: 10, max: 15 },
  tank: { minVolumeLiters: 400 },
  compatibility: { temperament: 'peaceful', grouping: 'shoaling' },
  diet: { type: 'carnivore' },
  fish: { reefSafe: 'yes' },
  hobbyistAdvisory: { level: 'specialist-only', reason: '...' },
};

describe('matchesFilters', () => {
  test('empty filters match everything', () => {
    expect(matchesFilters(CHERRY_SHRIMP, {})).toBe(true);
    expect(matchesFilters(CLOWNFISH, {})).toBe(true);
  });

  test('taxa filter (multi-select) — union within dimension', () => {
    const f = { taxa: ['fish', 'coral'] };
    expect(matchesFilters(CHERRY_SHRIMP, f)).toBe(false);
    expect(matchesFilters(CLOWNFISH, f)).toBe(true);
  });

  test('multiple dimensions intersect (AND)', () => {
    const f = { taxa: ['fish'], waterType: ['freshwater'] };
    expect(matchesFilters(CLOWNFISH, f)).toBe(false); // fish but not FW
    expect(matchesFilters(CHERRY_SHRIMP, f)).toBe(false); // FW but not fish
  });

  test('maxSize filter', () => {
    expect(matchesFilters(CHERRY_SHRIMP, { maxSize: 5 })).toBe(true);
    expect(matchesFilters(CLOWNFISH, { maxSize: 5 })).toBe(false);
  });

  test('minSize filter', () => {
    expect(matchesFilters(CHERRY_SHRIMP, { minSize: 10 })).toBe(false);
    expect(matchesFilters(CLOWNFISH, { minSize: 10 })).toBe(true);
  });

  test('maxTankL filter (user has 40 L tank)', () => {
    expect(matchesFilters(CHERRY_SHRIMP, { maxTankL: 40 })).toBe(true);
    expect(matchesFilters(CLOWNFISH, { maxTankL: 40 })).toBe(false);
  });

  test('reefSafe filter: nested per-taxon lookup (permissive)', () => {
    const REEF_FISH = { ...CLOWNFISH, fish: { reefSafe: 'yes' } };
    const CAUTION_FISH = { ...CLOWNFISH, fish: { reefSafe: 'with caution' } };
    const UNSAFE_FISH = { ...CLOWNFISH, fish: { reefSafe: 'no' } };
    const NULL_FISH = { ...CLOWNFISH, fish: { reefSafe: null } };
    expect(matchesFilters(REEF_FISH, { reefSafe: true })).toBe(true);
    expect(matchesFilters(CAUTION_FISH, { reefSafe: true })).toBe(true);
    expect(matchesFilters(UNSAFE_FISH, { reefSafe: true })).toBe(false);
    expect(matchesFilters(NULL_FISH, { reefSafe: true })).toBe(false);
    expect(matchesFilters(CHERRY_SHRIMP, { reefSafe: true })).toBe(false);

    // Echinoderm uses coralSafe (boolean), not reefSafe.
    const SAFE_URCHIN = { taxon: 'echinoderm', echinoderm: { coralSafe: true } };
    const UNSAFE_URCHIN = { taxon: 'echinoderm', echinoderm: { coralSafe: false } };
    expect(matchesFilters(SAFE_URCHIN, { reefSafe: true })).toBe(true);
    expect(matchesFilters(UNSAFE_URCHIN, { reefSafe: true })).toBe(false);
  });

  test('hideAdvisory hides species with hobbyistAdvisory block', () => {
    expect(matchesFilters(CHERRY_SHRIMP, { hideAdvisory: true })).toBe(true);
    expect(matchesFilters(LEOPARD_WRASSE, { hideAdvisory: true })).toBe(false);
  });

  test('temperament / grouping / dietType', () => {
    expect(matchesFilters(CHERRY_SHRIMP, { temperament: ['peaceful'] })).toBe(true);
    expect(matchesFilters(CLOWNFISH, { temperament: ['peaceful'] })).toBe(false);
    expect(matchesFilters(CHERRY_SHRIMP, { grouping: ['shoaling'] })).toBe(true);
    expect(matchesFilters(CHERRY_SHRIMP, { dietType: ['carnivore'] })).toBe(false);
  });

  test('null field is excluded when filter active', () => {
    const item = { taxon: 'fish', waterType: 'freshwater', adultSizeCm: null, tank: null };
    expect(matchesFilters(item, { maxSize: 10 })).toBe(false);
    expect(matchesFilters(item, { maxTankL: 40 })).toBe(false);
  });
});

describe('applyFilters', () => {
  test('filters the whole list', () => {
    const items = [CHERRY_SHRIMP, CLOWNFISH, LEOPARD_WRASSE];
    expect(applyFilters(items, { waterType: ['freshwater'] })).toEqual([CHERRY_SHRIMP]);
    expect(applyFilters(items, {})).toHaveLength(3);
  });
});
