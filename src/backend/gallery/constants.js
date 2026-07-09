// Single source of truth for filter dimensions. Shared by Worker and frontend.

const TAXA = ['fish', 'crustacean', 'coral', 'mollusc', 'echinoderm', 'amphibian', 'plant', 'macroalgae', 'other-invert'];
const WATER_TYPES = ['freshwater', 'saltwater', 'brackish'];
const CARE_LEVELS = ['beginner', 'intermediate', 'advanced', 'expert'];
const TEMPERAMENTS = ['peaceful', 'semi-aggressive', 'aggressive'];
const GROUPINGS = ['solitary', 'pair', 'shoaling', 'harem'];
const DIET_TYPES = ['carnivore', 'omnivore', 'herbivore', 'algae-eater'];
const CO2_OPTIONS = ['none', 'optional', 'recommended', 'required'];
const LIGHTING_OPTIONS = ['low', 'medium', 'high'];

// Which taxa are "fauna" (drives contextual sub-row visibility)
const FAUNA_TAXA = new Set(['fish', 'crustacean', 'coral', 'mollusc', 'echinoderm', 'amphibian', 'other-invert']);

module.exports = {
  TAXA, WATER_TYPES, CARE_LEVELS,
  TEMPERAMENTS, GROUPINGS, DIET_TYPES,
  CO2_OPTIONS, LIGHTING_OPTIONS,
  FAUNA_TAXA,
};
