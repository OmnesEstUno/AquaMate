import { taxonDisplay, breedingHeading } from '../taxonFields';

const coral = {
  taxon: 'coral',
  coral: { coralType: 'SPS', lighting: { minPAR: 150, maxPAR: 500 }, flow: 'high',
    placement: 'upper', aggressionRangeCm: 5, feedingFrequency: 'weekly',
    calciumPPM: { min: 380, max: 450 }, magnesiumPPM: { min: 1250, max: 1450 }, reefSafe: 'with caution' },
};
const fish = {
  taxon: 'fish',
  fish: { venomousSpines: true, nocturnal: true, finNippy: false, reefSafe: 'with caution',
    feedingDifficulty: 'moderate', conspecificAggression: 'high', escapeRisk: 'low',
    monogamousPairing: null, copperSensitive: null, sexChange: null },
};

describe('breedingHeading', () => {
  test('coral/plant/macroalgae → Propagation', () => {
    expect(breedingHeading({ taxon: 'coral' })).toBe('Propagation');
    expect(breedingHeading({ taxon: 'plant' })).toBe('Propagation');
  });
  test('fauna → Breeding', () => {
    expect(breedingHeading({ taxon: 'fish' })).toBe('Breeding');
  });
});

describe('taxonDisplay(coral)', () => {
  const d = taxonDisplay(coral);
  test('setup KV includes PAR + calcium', () => {
    const labels = d.setup.map(([k]) => k);
    expect(labels).toEqual(expect.arrayContaining(['Lighting (PAR)', 'Calcium', 'Magnesium', 'Flow']));
  });
  test('reefSafe surfaces as a rating', () => {
    expect(d.ratings).toEqual(expect.arrayContaining([['Reef-safe', 'With caution']]));
  });
});

describe('taxonDisplay(fish)', () => {
  const d = taxonDisplay(fish);
  test('true hazards become warn chips, neutral true flags become trait chips', () => {
    expect(d.warnChips).toEqual(expect.arrayContaining(['Venomous spines']));
    expect(d.traitChips).toEqual(expect.arrayContaining(['Nocturnal']));
  });
  test('false / null booleans are omitted', () => {
    expect(d.warnChips).not.toEqual(expect.arrayContaining(['Fin-nippy']));
    expect(JSON.stringify(d)).not.toContain('Monogamous');
  });
  test('rating enums render (feeding, aggression, escape)', () => {
    const labels = d.ratings.map(([k]) => k);
    expect(labels).toEqual(expect.arrayContaining(['Reef-safe', 'Feeding difficulty', 'Conspecific aggression', 'Escape risk']));
  });
});
