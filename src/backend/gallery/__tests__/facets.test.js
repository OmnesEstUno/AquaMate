const { computeFacets } = require('../facets');

const CORPUS = [
  { taxon: 'fish', waterType: 'freshwater', careLevel: 'beginner', adultSizeCm: { max: 5 }, tank: { minVolumeLiters: 40 }, compatibility: { temperament: 'peaceful' } },
  { taxon: 'fish', waterType: 'freshwater', careLevel: 'intermediate', adultSizeCm: { max: 15 }, tank: { minVolumeLiters: 200 }, compatibility: { temperament: 'aggressive' } },
  { taxon: 'coral', waterType: 'saltwater', careLevel: 'advanced', adultSizeCm: { max: 30 }, tank: { minVolumeLiters: 400 } },
  { taxon: 'plant', waterType: 'freshwater', careLevel: 'beginner', adultSizeCm: { max: 20 }, tank: { minVolumeLiters: 40 }, plant: { co2: 'optional' } },
];

describe('computeFacets', () => {
  test('empty filters — count is total by option', () => {
    const f = computeFacets(CORPUS, {});
    expect(f.taxa.fish).toBe(2);
    expect(f.taxa.coral).toBe(1);
    expect(f.taxa.plant).toBe(1);
    expect(f.taxa['other-invert']).toBe(0);
    expect(f.waterType.freshwater).toBe(3);
    expect(f.waterType.saltwater).toBe(1);
    expect(f.careLevel.beginner).toBe(2);
    expect(f.careLevel.expert).toBe(0);
  });

  test('facet counts exclude their own dimension from the pre-filter (union semantics)', () => {
    // With waterType=freshwater active, the waterType facet excludes waterType
    // from the pre-filter, then applies each option as if it were ADDED to the
    // current selection (union within dim). So saltwater shows "if I add
    // saltwater to freshwater, I'd have freshwater OR saltwater = 4 matches."
    const f = computeFacets(CORPUS, { waterType: ['freshwater'] });
    expect(f.waterType.freshwater).toBe(3);  // freshwater alone (already selected)
    expect(f.waterType.saltwater).toBe(4);   // union: freshwater OR saltwater = 3 + 1 = 4
  });

  test('other dimensions ARE applied when computing a given dimension', () => {
    // With taxon=fish active, waterType facets should reflect the "fish AND water=x" count.
    const f = computeFacets(CORPUS, { taxa: ['fish'] });
    expect(f.waterType.freshwater).toBe(2);
    expect(f.waterType.saltwater).toBe(0);
  });

  test('option is added to its own dimension for the count', () => {
    // With taxon=fish selected, checking taxon.coral shows "how many if coral WERE ADDED"
    // to the taxa selection: fish OR coral = 3.
    const f = computeFacets(CORPUS, { taxa: ['fish'] });
    expect(f.taxa.coral).toBe(3); // 2 fish + 1 coral (union)
    expect(f.taxa.fish).toBe(2);  // already selected, showing current match
  });

  test('range dimensions are absent from facet output', () => {
    const f = computeFacets(CORPUS, {});
    expect(f.minSize).toBeUndefined();
    expect(f.maxSize).toBeUndefined();
    expect(f.maxTankL).toBeUndefined();
  });
});
