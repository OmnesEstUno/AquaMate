import { formatRange, titleCase } from './format';

const PROPAGATION_TAXA = new Set(['coral', 'plant', 'macroalgae']);
export function breedingHeading(item) {
  return PROPAGATION_TAXA.has(item.taxon) ? 'Propagation' : 'Breeding';
}

// Boolean flags that, when true, are care-critical hazards → amber "warn" chips.
const WARN_BOOLEANS = {
  venomousSpines: 'Venomous spines', toxicToTank: 'Toxic to tank', caudalScalpel: 'Caudal scalpel',
  copperSensitive: 'Copper-sensitive', finNippy: 'Fin-nippy', eatsPlantsRisk: 'Eats/uproots plants',
  obligateCorallivore: 'Obligate corallivore', hlleSusceptible: 'HLLE-susceptible',
  climbsOutOfTank: 'Climbs out of tank',
};
// Boolean flags that, when true, are neutral traits → cyan "trait" chips.
const TRAIT_BOOLEANS = {
  nocturnal: 'Nocturnal', haremic: 'Haremic', monogamousPairing: 'Monogamous pairs',
  juvenileColorPhase: 'Juvenile colour phase', mouthbrooder: 'Mouthbrooder', constantGrazer: 'Constant grazer',
  cleanerFish: 'Cleaner fish', euryhaline: 'Euryhaline', symbioticShrimpPartner: 'Shrimp-goby symbiont',
  requiresHitchingPost: 'Needs hitching post', speciesOnlyTankRecommended: 'Species-only tank',
  coralSafe: 'Coral-safe',
};
// Enum flags → rating rows (label + Title-cased value).
const RATING_ENUMS = {
  reefSafe: 'Reef-safe', feedingDifficulty: 'Feeding difficulty', conspecificAggression: 'Conspecific aggression',
  escapeRisk: 'Escape risk', sexChange: 'Sex change', skinSensitivity: 'Skin sensitivity',
  chytridRisk: 'Chytrid risk', substrateConstraint: 'Substrate', substrateNeeds: 'Substrate',
  waterStabilitySensitivity: 'Water-stability sensitivity', coralType: 'Coral type', flow: 'Flow',
  placement: 'Placement', feedingFrequency: 'Feeding frequency', lighting: 'Lighting', co2: 'CO₂',
  growthRate: 'Growth rate', form: 'Form', nutrientUptake: 'Nutrient uptake', fertilization: 'Fertilization',
};

// Setup values pulled into the Aquarium-setup KV block (formatted specially).
function setupRows(taxon, b) {
  const rows = [];
  const push = (k, v) => { if (v != null && v !== '') rows.push([k, v]); };
  if (b.lighting && typeof b.lighting === 'object') {
    push('Lighting (PAR)', formatRange({ min: b.lighting.minPAR, max: b.lighting.maxPAR }, ''));
  }
  push('Flow', b.flow && titleCase(b.flow));
  push('Placement', b.placement && titleCase(b.placement));
  push('Feeding frequency', b.feedingFrequency && titleCase(b.feedingFrequency));
  push('Calcium', formatRange(b.calciumPPM, 'ppm'));
  push('Magnesium', formatRange(b.magnesiumPPM, 'ppm'));
  if (b.aggressionRangeCm != null) push('Aggression range', `≥ ${b.aggressionRangeCm} cm spacing`);
  if (typeof b.lighting === 'string') push('Light demand', titleCase(b.lighting));
  push('CO₂', b.co2 && titleCase(b.co2));
  push('Growth rate', b.growthRate && titleCase(b.growthRate));
  push('Substrate', b.substrate && titleCase(b.substrate));
  push('Fertilization', b.fertilization && titleCase(b.fertilization));
  push('Form', b.form && titleCase(b.form));
  push('Nutrient uptake', b.nutrientUptake && titleCase(b.nutrientUptake));
  if (Array.isArray(b.propagation) && b.propagation.length) push('Propagation', b.propagation.join(' · '));
  if (Array.isArray(b.algaeTypesConsumed) && b.algaeTypesConsumed.length) push('Eats algae', b.algaeTypesConsumed.join(' · '));
  if (b.moltingFrequencyDays != null) push('Molting', `~ every ${b.moltingFrequencyDays} days`);
  if (b.minTankAgeMonths != null) push('Min tank age', `${b.minTankAgeMonths} months`);
  return rows;
}

// Setup fields are pulled by setupRows; everything else falls through generic classification.
const SETUP_KEYS = new Set(['lighting', 'flow', 'placement', 'feedingFrequency', 'calciumPPM',
  'magnesiumPPM', 'aggressionRangeCm', 'co2', 'growthRate', 'substrate', 'fertilization', 'form',
  'nutrientUptake', 'propagation', 'algaeTypesConsumed', 'moltingFrequencyDays', 'minTankAgeMonths',
  'coralType']);

export function taxonDisplay(item) {
  const block = item[item.taxon];
  if (!block) return { setup: [], ratings: [], warnChips: [], traitChips: [] };
  const setup = setupRows(item.taxon, block);
  // coralType is a rating too (nice to show), keep it in ratings.
  const ratings = [];
  const warnChips = [];
  const traitChips = [];
  for (const [key, val] of Object.entries(block)) {
    if (val == null) continue;
    if (typeof val === 'boolean') {
      if (val === true && WARN_BOOLEANS[key]) warnChips.push(WARN_BOOLEANS[key]);
      else if (val === true && TRAIT_BOOLEANS[key]) traitChips.push(TRAIT_BOOLEANS[key]);
      continue;
    }
    if (typeof val === 'string' && RATING_ENUMS[key] && !SETUP_KEYS.has(key)) {
      ratings.push([RATING_ENUMS[key], titleCase(val)]);
    }
  }
  return { setup, ratings, warnChips, traitChips };
}
