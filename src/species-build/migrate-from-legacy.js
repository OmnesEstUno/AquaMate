const fs = require('fs');
const path = require('path');

const TAXON_KEYWORDS = [
  { taxon: 'crustacean', patterns: [/shrimp/i, /crayfish/i, /crab/i, /lobster/i] },
  { taxon: 'coral',      patterns: [/coral/i, /anemone/i, /zoanthid/i, /polyp/i] },
  { taxon: 'mollusc',    patterns: [/snail/i, /clam/i, /conch/i, /nerite/i, /mystery/i] },
  { taxon: 'echinoderm', patterns: [/starfish/i, /sea star/i, /urchin/i, /sea cucumber/i] }
];

// Explicit allowlist of legacy category values that unambiguously indicate fish.
// Protects against commonName false positives (e.g. "Coral Beauty" is an Angelfish,
// "Coral Catshark" is a Shark — both would wrongly match /coral/i without this guard).
const FISH_CATEGORIES = new Set([
  'Angelfish', 'Anthias', 'Barb', 'Blenny', 'Butterflyfish', 'Cardinalfish',
  'Catfish', 'Chromis', 'Cichlid', 'Clownfish', 'Damsel', 'Danio', 'Dragonet',
  'Eel', 'Filefish', 'Goby', 'Goldfish', 'Gourami', 'Hawkfish', 'Idol',
  'Lionfish', 'Livebearer', 'Loach', 'Oddball', 'Parrotfish', 'Pipefish',
  'Pufferfish', 'Rabbitfish', 'Rainbowfish', 'Rasbora', 'Ray', 'Scorpionfish',
  'Seahorse', 'Shark', 'Soldierfish', 'Squirrelfish', 'Tang', 'Tetra',
  'Triggerfish', 'Wrasse'
]);

function slugify(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function inferTaxon({ commonName, category, kind }) {
  if (kind === 'flora') return 'plant';

  // If category is a known fish category, the entry is fish regardless of commonName.
  // This protects against names like "Coral Beauty" (Angelfish) and "Coral Catshark" (Shark).
  if (category && FISH_CATEGORIES.has(category)) return 'fish';

  // Otherwise, look for taxon keywords in the commonName.
  for (const { taxon, patterns } of TAXON_KEYWORDS) {
    if (patterns.some(p => p.test(commonName))) return taxon;
  }
  return 'fish';
}

function dedupeSlug(slug, usedSlugs) {
  if (!usedSlugs.has(slug)) return slug;
  let i = 2;
  while (usedSlugs.has(`${slug}-${i}`)) i++;
  return `${slug}-${i}`;
}

function makeVariantStub(taxon) {
  switch (taxon) {
    case 'fish':
      return { breedingDifficulty: null, breedingNotes: null, conspecificAggression: null, finNippy: null, reefSafe: null, escapeRisk: null, venomousSpines: null, protogynous: null, haremic: null, caudalScalpel: null, nocturnal: null, juvenileColorPhase: null, copperSensitive: null, speciesOnlyTankRecommended: null, requiresHitchingPost: null, monogamousPairing: null, hlleSusceptible: null, toxicToTank: null, feedingDifficulty: null };
    case 'crustacean':
      return { copperSensitive: null, moltingFrequencyDays: null, moltingNotes: null, escapeRisk: null, breedingDifficulty: null, breedingNotes: null, speciesOnlyTankRecommended: null };
    case 'coral':
      return { coralType: null, lighting: null, flow: null, placement: null, aggressionRangeCm: null, feedingFrequency: null, calciumPPM: null, magnesiumPPM: null };
    case 'mollusc':
      return { copperSensitive: null, substrateNeeds: null, climbsOutOfTank: null, algaeTypesConsumed: [] };
    case 'echinoderm':
      return { copperSensitive: null, minTankAgeMonths: null, coralSafe: null, waterStabilitySensitivity: null };
    case 'other-invert':
      return { notes: null };
    case 'plant':
      return { lighting: null, co2: null, growthRate: null, placement: null, propagation: [], substrate: null, fertilization: null };
    case 'macroalgae':
      return { lighting: null, growthRate: null, form: null, placement: null, nutrientUptake: null, propagation: [] };
    default:
      throw new Error(`Unknown taxon: ${taxon}`);
  }
}

function makePlaceholderEntry({ legacyItem, kind, taxon, waterType, slug }) {
  const variantBlock = makeVariantStub(taxon);
  return {
    id: legacyItem.id,
    slug,
    kind,
    taxon,
    waterType,
    commonName: legacyItem.commonName,
    scientificName: legacyItem.scientificName || '',
    alsoKnownAs: [],
    category: legacyItem.category || '',
    taxonomy: { family: null, order: null },
    nativeRange: { regions: [], countries: [], habitat: null, biotope: null },
    waterParameters: {
      temperatureC: null, pH: null, gH: null, kH: null, salinity: null
    },
    adultSizeCm: null,
    lifespanYears: null,
    tank: {
      minVolumeLiters: null, minLengthCm: null,
      swimZone: null, decorPreferences: []
    },
    careLevel: null,
    diet: null,
    compatibility: {
      temperament: null, grouping: null, minGroupSize: null,
      goodWith: [], avoidWith: []
    },
    media: {
      primaryImage: legacyItem.image_url || null,
      gallery: [],
      imageCandidates: null
    },
    summary: legacyItem.description || null,
    careNotes: null,
    breedingNotes: null,
    sources: { primary: null, additional: [] },
    fish:          taxon === 'fish'        ? variantBlock : null,
    crustacean:    taxon === 'crustacean'  ? variantBlock : null,
    coral:         taxon === 'coral'       ? variantBlock : null,
    mollusc:       taxon === 'mollusc'     ? variantBlock : null,
    echinoderm:    taxon === 'echinoderm'  ? variantBlock : null,
    'other-invert': taxon === 'other-invert' ? variantBlock : null,
    plant:         taxon === 'plant'       ? variantBlock : null,
    macroalgae:    taxon === 'macroalgae'  ? variantBlock : null,
    schemaVersion: 1,
    dataStatus: 'placeholder',
    lastReviewed: null
  };
}

function readLegacy(filePath) {
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function flattenLegacyFauna(faunaData) {
  // { freshwater: {pages: [{items: [...]}]}, saltwater: {...} } -> [{waterType, item}]
  const out = [];
  if (!faunaData) return out;
  for (const [waterType, cat] of Object.entries(faunaData)) {
    if (!cat?.pages) continue;
    for (const page of cat.pages) {
      for (const item of page.items || []) {
        out.push({ waterType, item });
      }
    }
  }
  return out;
}

function flattenLegacyFlora(floraData) {
  // { flora: {pages: [{items: [...]}]} } -> [{waterType: 'freshwater', item}]
  const out = [];
  if (!floraData) return out;
  const cat = floraData.flora || floraData.freshwater;
  if (!cat?.pages) return out;
  for (const page of cat.pages) {
    for (const item of page.items || []) {
      out.push({ waterType: 'freshwater', item });
    }
  }
  return out;
}

function migrate({ faunaPath, floraPath, speciesDir }) {
  const faunaData = readLegacy(faunaPath);
  const floraData = readLegacy(floraPath);

  const usedSlugs = new Set();
  const written = [];

  const all = [
    ...flattenLegacyFauna(faunaData).map(({ waterType, item }) => ({ kind: 'fauna', waterType, item })),
    ...flattenLegacyFlora(floraData).map(({ waterType, item }) => ({ kind: 'flora', waterType, item }))
  ];

  for (const { kind, waterType, item } of all) {
    const taxon = inferTaxon({ commonName: item.commonName, category: item.category, kind });
    const baseSlug = slugify(item.commonName);
    const slug = dedupeSlug(baseSlug, usedSlugs);
    usedSlugs.add(slug);

    const entry = makePlaceholderEntry({ legacyItem: item, kind, taxon, waterType, slug });
    const taxonDir = path.join(speciesDir, taxon);
    fs.mkdirSync(taxonDir, { recursive: true });
    const outPath = path.join(taxonDir, `${slug}.json`);
    fs.writeFileSync(outPath, JSON.stringify(entry, null, 2) + '\n');
    written.push(outPath);
  }

  return { written };
}

// CLI entrypoint
if (require.main === module) {
  const repoRoot = path.resolve(__dirname, '..', '..');
  const report = migrate({
    faunaPath: path.join(repoRoot, 'src', 'fauna.json'),
    floraPath: path.join(repoRoot, 'src', 'flora.json'),
    speciesDir: path.join(repoRoot, 'src', 'species')
  });
  console.log(`Migrated ${report.written.length} legacy entries to per-species files.`);
}

module.exports = { migrate, slugify, inferTaxon, dedupeSlug };
