const { applyFilters, matchesFilters } = require('./filters');
const {
  TAXA, WATER_TYPES, CARE_LEVELS,
  TEMPERAMENTS, GROUPINGS, DIET_TYPES,
  CO2_OPTIONS, LIGHTING_OPTIONS,
} = require('./constants');

// Multi-select enum dimensions and their option lists.
const ENUM_DIMENSIONS = {
  taxa: TAXA,
  waterType: WATER_TYPES,
  careLevel: CARE_LEVELS,
  temperament: TEMPERAMENTS,
  grouping: GROUPINGS,
  dietType: DIET_TYPES,
  co2: CO2_OPTIONS,
  lighting: LIGHTING_OPTIONS,
};

function computeFacets(items, activeFilters) {
  const facets = {};
  for (const [dim, options] of Object.entries(ENUM_DIMENSIONS)) {
    facets[dim] = {};
    // Pre-filter the corpus with all filters EXCEPT this dimension.
    const filtersWithoutDim = { ...activeFilters };
    delete filtersWithoutDim[dim];
    const preFiltered = applyFilters(items, filtersWithoutDim);

    for (const option of options) {
      // Count species that would match if `option` were added (union within dim).
      const currentSel = activeFilters[dim] || [];
      const withOption = currentSel.includes(option) ? currentSel : [...currentSel, option];
      const withFilters = { ...filtersWithoutDim, [dim]: withOption };
      facets[dim][option] = preFiltered.filter(item => matchesFilters(item, withFilters)).length;
    }
  }

  // Boolean-toggle facets.
  facets.reefSafe = {
    true: applyFilters(items, { ...activeFilters, reefSafe: true }).length,
  };
  facets.hideAdvisory = {
    true: applyFilters(items, { ...activeFilters, hideAdvisory: true }).length,
  };

  return facets;
}

module.exports = { computeFacets };
