// Reef-safe helper: matches on nested per-taxon fields (permissive: 'yes' OR 'with caution' pass).
// fish.reefSafe / coral.reefSafe / crustacean.reefSafe / mollusc.reefSafe / macroalgae.reefSafe use the enum.
// echinoderm uses the pre-existing echinoderm.coralSafe boolean instead.
const REEF_SAFE_ENUM = new Set(['yes', 'with caution']);
function isReefSafe(item) {
  if (item.taxon === 'echinoderm') return item.echinoderm?.coralSafe === true;
  const variant = item[item.taxon];
  if (!variant) return false;
  return REEF_SAFE_ENUM.has(variant.reefSafe);
}

function matchesFilters(item, filters) {
  if (!item) return false;

  // Free-text search: case-insensitive substring against commonName,
  // scientificName, and alsoKnownAs entries. Whitespace-only queries ignored.
  if (filters.q && filters.q.trim()) {
    const q = filters.q.toLowerCase().trim();
    const haystack = [
      item.commonName,
      item.scientificName,
      ...(item.alsoKnownAs || []),
    ];
    const hit = haystack.some(str => typeof str === 'string' && str.toLowerCase().includes(q));
    if (!hit) return false;
  }

  // Enum multi-selects: item's value must be in the selected list.
  if (filters.taxa?.length && !filters.taxa.includes(item.taxon)) return false;
  if (filters.waterType?.length && !filters.waterType.includes(item.waterType)) return false;
  if (filters.careLevel?.length) {
    if (!item.careLevel || !filters.careLevel.includes(item.careLevel)) return false;
  }
  if (filters.temperament?.length) {
    const t = item.compatibility?.temperament;
    if (!t || !filters.temperament.includes(t)) return false;
  }
  if (filters.grouping?.length) {
    const g = item.compatibility?.grouping;
    if (!g || !filters.grouping.includes(g)) return false;
  }
  if (filters.dietType?.length) {
    const d = item.diet?.type;
    if (!d || !filters.dietType.includes(d)) return false;
  }
  if (filters.co2?.length) {
    const c = item.plant?.co2 || item.macroalgae?.co2;
    if (!c || !filters.co2.includes(c)) return false;
  }
  if (filters.lighting?.length) {
    const l = item.plant?.lighting || item.macroalgae?.lighting || item.coral?.lighting;
    if (!l || !filters.lighting.includes(l)) return false;
  }

  // Ranges: null excludes.
  if (filters.minSize != null) {
    const s = item.adultSizeCm?.max;
    if (s == null || s < filters.minSize) return false;
  }
  if (filters.maxSize != null) {
    const s = item.adultSizeCm?.max;
    if (s == null || s > filters.maxSize) return false;
  }
  if (filters.maxTankL != null) {
    const t = item.tank?.minVolumeLiters;
    if (t == null || t > filters.maxTankL) return false;
  }

  // Booleans.
  if (filters.reefSafe === true && !isReefSafe(item)) return false;
  if (filters.hideAdvisory === true && item.hobbyistAdvisory != null) return false;

  return true;
}

function applyFilters(items, filters) {
  return items.filter(item => matchesFilters(item, filters));
}

module.exports = { matchesFilters, applyFilters };
