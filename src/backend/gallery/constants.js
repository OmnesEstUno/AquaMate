// Single source of truth for filter dimensions. Shared by Worker and frontend.

const TAXA = ['fish', 'crustacean', 'coral', 'mollusc', 'echinoderm', 'amphibian', 'plant', 'macroalgae', 'other-invert'];
const WATER_TYPES = ['freshwater', 'saltwater', 'brackish'];
const CARE_LEVELS = ['beginner', 'intermediate', 'advanced', 'expert'];
const TEMPERAMENTS = ['peaceful', 'semi-aggressive', 'aggressive'];
const GROUPINGS = ['solitary', 'pair', 'shoaling', 'harem'];
const DIET_TYPES = ['carnivore', 'omnivore', 'herbivore', 'algae-eater'];
const CO2_OPTIONS = ['none', 'optional', 'recommended', 'required'];
const LIGHTING_OPTIONS = ['low', 'medium', 'high'];
// hobbyistAdvisory.level enum from species.schema.json — surfaced as a filter dimension
// so users can narrow to "show me the specialist-only species" etc. Matches the AdvisoryPill.
const ADVISORY_LEVELS = ['specialist-only', 'legally-restricted', 'public-aquarium-only', 'pond-only'];

// Which taxa are "fauna" (drives contextual sub-row visibility)
const FAUNA_TAXA = new Set(['fish', 'crustacean', 'coral', 'mollusc', 'echinoderm', 'amphibian', 'other-invert']);

module.exports = {
  TAXA, WATER_TYPES, CARE_LEVELS,
  TEMPERAMENTS, GROUPINGS, DIET_TYPES,
  CO2_OPTIONS, LIGHTING_OPTIONS,
  ADVISORY_LEVELS,
  FAUNA_TAXA,
};
