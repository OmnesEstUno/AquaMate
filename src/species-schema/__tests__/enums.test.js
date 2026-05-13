const enums = require('../enums.json');

describe('enums.json', () => {
  test('defines required vocabulary groups', () => {
    const expected = [
      'kinds', 'taxa', 'waterTypes', 'biotopes', 'careLevels',
      'temperaments', 'groupings', 'swimZones', 'dietTypes',
      'breedingDifficulties', 'conspecificAggression', 'reefSafe',
      'escapeRisk', 'lightingLevels', 'co2Levels', 'plantPlacements',
      'plantSubstrates', 'fertilizationLevels', 'growthRates',
      'algaeForms', 'algaePlacements', 'nutrientUptakeLevels',
      'coralTypes', 'flowLevels', 'coralPlacements', 'feedingFrequencies',
      'molluscSubstrates', 'waterStabilitySensitivity', 'dataStatuses'
    ];
    for (const key of expected) {
      expect(enums).toHaveProperty(key);
      expect(Array.isArray(enums[key])).toBe(true);
      expect(enums[key].length).toBeGreaterThan(0);
    }
  });

  test('kinds is exactly ["fauna","flora"]', () => {
    expect(enums.kinds).toEqual(['fauna', 'flora']);
  });

  test('taxa includes all 8 expected entries', () => {
    expect(enums.taxa.sort()).toEqual([
      'coral', 'crustacean', 'echinoderm', 'fish',
      'macroalgae', 'mollusc', 'other-invert', 'plant'
    ]);
  });

  test('dataStatuses includes all 4 expected values', () => {
    expect(enums.dataStatuses.sort()).toEqual([
      'needs_review', 'placeholder', 'researched', 'reviewed'
    ]);
  });
});
