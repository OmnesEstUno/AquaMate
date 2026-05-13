# Species Data Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the data-layer foundation for AquaMate's species redesign: per-species JSON files, a closed JSON Schema, validation + compile tooling, and a one-shot migration from the legacy `fauna.json`/`flora.json` to placeholder per-species files served through the existing Cloudflare Worker.

**Architecture:** Per-species JSON files live in `src/species/<taxon>/<slug>.json`. The contract is `src/species-schema/species.schema.json` (closed schema, `additionalProperties: false`) referencing controlled vocabularies in `src/species-schema/enums.json`. The build pipeline (`src/species-build/`) provides three Node scripts: `validate.js` (Ajv validation, exits non-zero on error), `compile.js` (bundles per-species files into a single `dist/species.json`), and `migrate-from-legacy.js` (one-shot legacy → placeholder converter). The Cloudflare Worker switches its imports to `dist/species.json` and paginates flat arrays on the fly. A small `review-field-gaps.js` summarizer reads the agent-emitted `field-gap-suggestions.jsonl` (used in subsequent population phases).

**Tech Stack:** Node.js (CommonJS for build scripts), JSON Schema 2020-12 via Ajv 8, glob 10 for file discovery, Jest (via `react-scripts test`) for unit tests. Cloudflare Workers for the runtime (unchanged).

**Spec source:** `docs/superpowers/specs/2026-05-13-species-data-redesign-design.md`. Sections 1–5 plus the Section 6 field-gap summarizer.

**Out of scope for this plan:** Stage A discovery agent orchestration, Stage C research agent orchestration, frontend rework, tank-data redesign. These are deferred to follow-on plans.

---

## File Structure

**New files (production):**

| File | Responsibility |
|---|---|
| `src/species-schema/enums.json` | Controlled vocabularies (water types, taxa, swim zones, lighting levels, etc.) referenced by the schema and frontend |
| `src/species-schema/species.schema.json` | Single source of truth for species file shape and validation rules |
| `src/species-build/validate.js` | Iterate `src/species/**/*.json`, validate each against the schema, report errors, exit non-zero on failure |
| `src/species-build/compile.js` | Read `src/species/**/*.json`, group by kind+waterType, write `dist/species.json` |
| `src/species-build/migrate-from-legacy.js` | One-shot reader for `src/fauna.json` + `src/flora.json` → `src/species/<taxon>/<slug>.json` placeholders |
| `src/species-build/review-field-gaps.js` | Summarizer for `field-gap-suggestions.jsonl`, groups by suggested field name, flags 5+ as promotion candidates |

**New files (tests + fixtures):**

| File | Responsibility |
|---|---|
| `src/species-schema/__tests__/schema.test.js` | Schema-level validation tests using sample valid/invalid entries |
| `src/species-build/__tests__/validate.test.js` | Validator script tests (single-file mode, multi-file mode, error reporting) |
| `src/species-build/__tests__/migrate.test.js` | Migration script tests (taxon inference, slug generation, field preservation) |
| `src/species-build/__tests__/compile.test.js` | Compiler tests (output shape, grouping by kind+waterType, empty input) |
| `src/species-build/__tests__/review-field-gaps.test.js` | Summarizer tests (empty input, single suggestion, 5+ promotion threshold) |
| `src/species-schema/__tests__/fixtures/valid-fish-researched.json` | Reference well-formed fish entry |
| `src/species-schema/__tests__/fixtures/valid-coral-researched.json` | Reference coral entry exercising saltwater + coral variant + reef chemistry |
| `src/species-schema/__tests__/fixtures/valid-plant-researched.json` | Reference plant entry |
| `src/species-schema/__tests__/fixtures/valid-fish-placeholder.json` | Placeholder-mode fish entry (loose required fields) |
| `src/species-schema/__tests__/fixtures/invalid-missing-id.json` | Negative-case fixture |
| `src/species-schema/__tests__/fixtures/invalid-kind-taxon-mismatch.json` | Negative-case fixture |
| `src/species-schema/__tests__/fixtures/invalid-coral-freshwater.json` | Negative-case fixture |
| `src/species-schema/__tests__/fixtures/invalid-extra-property.json` | Negative-case fixture (closed schema) |
| `src/species-schema/__tests__/fixtures/invalid-too-many-additional-sources.json` | Negative-case fixture |
| `src/species-build/__tests__/fixtures/legacy-fauna-mini.json` | Minimal legacy fauna for migration tests |
| `src/species-build/__tests__/fixtures/legacy-flora-mini.json` | Minimal legacy flora for migration tests |

**Modified files:**

| File | Change |
|---|---|
| `package.json` | Add `ajv`, `ajv-formats`, `glob` as devDependencies. Add `validate`, `compile-species`, `migrate-species`, `review-field-gaps` scripts. Add `prebuild` hook. |
| `.gitignore` | Add `/dist/` |
| `src/backend/worker.js` | Switch imports from `fauna.json`/`flora.json` to `dist/species.json`; replace pre-grouped-page lookup with `slice` arithmetic against flat arrays; update `R2_DOMAINS` keying to use `item.kind`. |

**Deleted files (after cutover):**

| File | Reason |
|---|---|
| `src/fauna.json` | Replaced by per-species files |
| `src/flora.json` | Replaced by per-species files |

---

## Task 1: Install dependencies and confirm test runner

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install Ajv, ajv-formats, and glob as devDependencies**

Run:
```bash
npm install --save-dev ajv@^8.17.1 ajv-formats@^3.0.1 glob@^10.4.5
```
Expected: dependencies added, `package-lock.json` updated.

- [ ] **Step 2: Verify Jest runs via react-scripts**

Run:
```bash
npm test -- --watchAll=false --passWithNoTests
```
Expected: exits 0 with "No tests found, exiting with code 0" or runs existing tests (CRA may have none).

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "deps: add ajv, ajv-formats, glob for species-schema tooling"
```

---

## Task 2: Create enums.json

**Files:**
- Create: `src/species-schema/enums.json`

- [ ] **Step 1: Write the failing test**

Create `src/species-schema/__tests__/enums.test.js`:

```javascript
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
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```bash
npm test -- --watchAll=false src/species-schema/__tests__/enums.test.js
```
Expected: FAIL with "Cannot find module '../enums.json'".

- [ ] **Step 3: Create `src/species-schema/enums.json`**

```json
{
  "kinds": ["fauna", "flora"],

  "taxa": [
    "fish", "crustacean", "coral", "mollusc",
    "echinoderm", "other-invert", "plant", "macroalgae"
  ],

  "waterTypes": ["freshwater", "saltwater", "brackish"],

  "biotopes": [
    "Blackwater", "Whitewater", "Clearwater",
    "Rift Lake", "River", "Stream", "Lake", "Pond",
    "Reef", "Lagoon", "Coastal", "Estuary",
    "Mangrove", "Tide Pool", "Open Ocean", "Other"
  ],

  "careLevels": ["beginner", "intermediate", "advanced", "expert"],

  "temperaments": ["peaceful", "semi-aggressive", "aggressive", "territorial"],

  "groupings": ["solitary", "pair", "shoaling", "schooling"],

  "swimZones": ["top", "mid", "bottom", "all"],

  "dietTypes": ["herbivore", "carnivore", "omnivore", "planktivore", "detritivore"],

  "breedingDifficulties": ["easy", "moderate", "difficult", "advanced", "not in captivity"],

  "conspecificAggression": ["none", "low", "moderate", "high"],

  "reefSafe": ["yes", "with caution", "no"],

  "escapeRisk": ["low", "moderate", "high"],

  "lightingLevels": ["low", "medium", "high"],

  "co2Levels": ["none", "optional", "recommended"],

  "plantPlacements": ["foreground", "midground", "background", "floating", "epiphyte"],

  "plantSubstrates": ["any", "nutrient-rich", "inert", "n/a"],

  "fertilizationLevels": ["low", "moderate", "heavy"],

  "growthRates": ["slow", "medium", "fast"],

  "algaeForms": ["macroalgae", "filamentous", "calcareous", "encrusting"],

  "algaePlacements": ["refugium", "display", "sump"],

  "nutrientUptakeLevels": ["low", "moderate", "high"],

  "coralTypes": ["LPS", "SPS", "soft", "anemone", "zoanthid", "mushroom"],

  "flowLevels": ["low", "medium", "high"],

  "coralPlacements": ["lower", "middle", "upper", "anywhere"],

  "feedingFrequencies": ["none", "weekly", "daily"],

  "molluscSubstrates": ["any", "sand", "gravel", "soft"],

  "waterStabilitySensitivity": ["low", "moderate", "high"],

  "dataStatuses": ["placeholder", "researched", "needs_review", "reviewed"]
}
```

- [ ] **Step 4: Run test to verify it passes**

Run:
```bash
npm test -- --watchAll=false src/species-schema/__tests__/enums.test.js
```
Expected: PASS — all 4 tests green.

- [ ] **Step 5: Commit**

```bash
git add src/species-schema/enums.json src/species-schema/__tests__/enums.test.js
git commit -m "feat(schema): add enums.json with controlled vocabularies"
```

---

## Task 3: Create schema scaffold + identity fields + closed-schema enforcement

**Files:**
- Create: `src/species-schema/species.schema.json`
- Create: `src/species-schema/__tests__/fixtures/valid-fish-placeholder.json`
- Create: `src/species-schema/__tests__/fixtures/invalid-extra-property.json`
- Create: `src/species-schema/__tests__/fixtures/invalid-missing-id.json`
- Create: `src/species-schema/__tests__/schema.test.js`

This task establishes the scaffolding: the schema loads via Ajv, accepts a minimal placeholder, rejects extra properties (closed), and rejects missing identity fields.

- [ ] **Step 1: Write the failing test**

Create `src/species-schema/__tests__/schema.test.js`:

```javascript
const path = require('path');
const Ajv = require('ajv/dist/2020');
const addFormats = require('ajv-formats');
const schema = require('../species.schema.json');
const enums = require('../enums.json');

function buildAjv() {
  const ajv = new Ajv({ allErrors: true, strict: true });
  addFormats(ajv);
  ajv.addSchema(enums, 'enums.json');
  return ajv.compile(schema);
}

function loadFixture(name) {
  return require(`./fixtures/${name}.json`);
}

describe('species.schema.json — scaffold', () => {
  const validate = buildAjv();

  test('accepts a minimal valid placeholder entry', () => {
    const ok = validate(loadFixture('valid-fish-placeholder'));
    expect(validate.errors).toBeNull();
    expect(ok).toBe(true);
  });

  test('rejects entry with extra top-level property (closed schema)', () => {
    const ok = validate(loadFixture('invalid-extra-property'));
    expect(ok).toBe(false);
    expect(validate.errors.some(e => e.keyword === 'additionalProperties')).toBe(true);
  });

  test('rejects entry missing id', () => {
    const ok = validate(loadFixture('invalid-missing-id'));
    expect(ok).toBe(false);
    expect(validate.errors.some(e =>
      e.keyword === 'required' && e.params.missingProperty === 'id'
    )).toBe(true);
  });
});
```

- [ ] **Step 2: Create fixture files**

Create `src/species-schema/__tests__/fixtures/valid-fish-placeholder.json`:

```json
{
  "id": "fw-001",
  "slug": "neon-tetra",
  "kind": "fauna",
  "taxon": "fish",
  "waterType": "freshwater",
  "commonName": "Neon Tetra",
  "scientificName": "Paracheirodon innesi",
  "alsoKnownAs": [],
  "category": "Tetra",
  "taxonomy": { "family": null, "order": null },
  "nativeRange": { "regions": [], "countries": [], "habitat": null, "biotope": null },
  "waterParameters": {
    "temperatureC": null,
    "pH": null,
    "gH": null,
    "kH": null,
    "salinity": null
  },
  "adultSizeCm": null,
  "lifespanYears": null,
  "tank": {
    "minVolumeLiters": null,
    "minLengthCm": null,
    "swimZone": null,
    "decorPreferences": []
  },
  "careLevel": null,
  "diet": null,
  "compatibility": {
    "temperament": null,
    "grouping": null,
    "minGroupSize": null,
    "goodWith": [],
    "avoidWith": []
  },
  "media": { "primaryImage": "neon_tetra.webp", "gallery": [] },
  "summary": "Placeholder description for Neon Tetra.",
  "careNotes": null,
  "breedingNotes": null,
  "sources": { "primary": null, "additional": [] },
  "fish": null,
  "crustacean": null,
  "coral": null,
  "mollusc": null,
  "echinoderm": null,
  "other-invert": null,
  "plant": null,
  "macroalgae": null,
  "schemaVersion": 1,
  "dataStatus": "placeholder",
  "lastReviewed": null
}
```

Create `src/species-schema/__tests__/fixtures/invalid-extra-property.json`:

```json
{
  "id": "fw-001",
  "slug": "neon-tetra",
  "kind": "fauna",
  "taxon": "fish",
  "waterType": "freshwater",
  "commonName": "Neon Tetra",
  "scientificName": "Paracheirodon innesi",
  "alsoKnownAs": [],
  "category": "Tetra",
  "taxonomy": { "family": null, "order": null },
  "nativeRange": { "regions": [], "countries": [], "habitat": null, "biotope": null },
  "waterParameters": { "temperatureC": null, "pH": null, "gH": null, "kH": null, "salinity": null },
  "adultSizeCm": null,
  "lifespanYears": null,
  "tank": { "minVolumeLiters": null, "minLengthCm": null, "swimZone": null, "decorPreferences": [] },
  "careLevel": null,
  "diet": null,
  "compatibility": { "temperament": null, "grouping": null, "minGroupSize": null, "goodWith": [], "avoidWith": [] },
  "media": { "primaryImage": "neon_tetra.webp", "gallery": [] },
  "summary": "Placeholder description.",
  "careNotes": null,
  "breedingNotes": null,
  "sources": { "primary": null, "additional": [] },
  "fish": null,
  "crustacean": null,
  "coral": null,
  "mollusc": null,
  "echinoderm": null,
  "other-invert": null,
  "plant": null,
  "macroalgae": null,
  "schemaVersion": 1,
  "dataStatus": "placeholder",
  "lastReviewed": null,
  "agentInventedField": "this should be rejected"
}
```

Create `src/species-schema/__tests__/fixtures/invalid-missing-id.json`:

```json
{
  "slug": "neon-tetra",
  "kind": "fauna",
  "taxon": "fish",
  "waterType": "freshwater",
  "commonName": "Neon Tetra",
  "scientificName": "Paracheirodon innesi",
  "alsoKnownAs": [],
  "category": "Tetra",
  "taxonomy": { "family": null, "order": null },
  "nativeRange": { "regions": [], "countries": [], "habitat": null, "biotope": null },
  "waterParameters": { "temperatureC": null, "pH": null, "gH": null, "kH": null, "salinity": null },
  "adultSizeCm": null,
  "lifespanYears": null,
  "tank": { "minVolumeLiters": null, "minLengthCm": null, "swimZone": null, "decorPreferences": [] },
  "careLevel": null,
  "diet": null,
  "compatibility": { "temperament": null, "grouping": null, "minGroupSize": null, "goodWith": [], "avoidWith": [] },
  "media": { "primaryImage": "neon_tetra.webp", "gallery": [] },
  "summary": "Placeholder description.",
  "careNotes": null,
  "breedingNotes": null,
  "sources": { "primary": null, "additional": [] },
  "fish": null,
  "crustacean": null,
  "coral": null,
  "mollusc": null,
  "echinoderm": null,
  "other-invert": null,
  "plant": null,
  "macroalgae": null,
  "schemaVersion": 1,
  "dataStatus": "placeholder",
  "lastReviewed": null
}
```

- [ ] **Step 3: Run test to verify it fails**

Run:
```bash
npm test -- --watchAll=false src/species-schema/__tests__/schema.test.js
```
Expected: FAIL with "Cannot find module '../species.schema.json'".

- [ ] **Step 4: Create the schema scaffold**

Create `src/species-schema/species.schema.json`. This is the **scaffold** — later tasks add subschemas and conditional rules incrementally.

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://aquamate.me/schemas/species.schema.json",
  "title": "AquaMate Species",
  "description": "Closed schema describing a single aquatic species (fauna or flora) entry. additionalProperties is false everywhere; new fields must be added here, not invented in species files.",
  "type": "object",
  "additionalProperties": false,
  "required": [
    "id", "slug", "kind", "taxon", "waterType",
    "commonName", "scientificName", "alsoKnownAs", "category",
    "taxonomy", "nativeRange",
    "waterParameters",
    "adultSizeCm", "lifespanYears",
    "tank", "careLevel", "diet", "compatibility",
    "media", "summary", "careNotes", "breedingNotes",
    "sources",
    "fish", "crustacean", "coral", "mollusc", "echinoderm", "other-invert", "plant", "macroalgae",
    "schemaVersion", "dataStatus", "lastReviewed"
  ],
  "properties": {
    "id": {
      "type": "string",
      "pattern": "^((fw|sw|fl)-\\d{3,}|(fw|sw|br)-(fish|crus|coral|moll|echi|invert|plant|algae)-\\d{3,})$",
      "description": "Stable identifier. Legacy: fw-NNN, sw-NNN, fl-NNN. New entries: <watertype>-<taxon-short>-NNN."
    },
    "slug": {
      "type": "string",
      "pattern": "^[a-z0-9-]+$",
      "description": "URL-safe identifier derived from commonName."
    },
    "kind":      { "type": "string", "enum": ["fauna", "flora"] },
    "taxon":     { "type": "string", "enum": ["fish", "crustacean", "coral", "mollusc", "echinoderm", "other-invert", "plant", "macroalgae"] },
    "waterType": { "type": "string", "enum": ["freshwater", "saltwater", "brackish"] },

    "commonName":      { "type": "string", "minLength": 1 },
    "scientificName":  { "type": "string" },
    "alsoKnownAs":     { "type": "array", "items": { "type": "string" } },
    "category":        { "type": "string" },

    "taxonomy": {
      "type": "object",
      "additionalProperties": false,
      "required": ["family", "order"],
      "properties": {
        "family": { "type": ["string", "null"] },
        "order":  { "type": ["string", "null"] }
      }
    },

    "nativeRange": {
      "type": "object",
      "additionalProperties": false,
      "required": ["regions", "countries", "habitat", "biotope"],
      "properties": {
        "regions":   { "type": "array", "items": { "type": "string" } },
        "countries": { "type": "array", "items": { "type": "string" } },
        "habitat":   { "type": ["string", "null"] },
        "biotope":   { "type": ["string", "null"] }
      }
    },

    "waterParameters": { "type": "object" },
    "adultSizeCm":     { "type": ["object", "null"] },
    "lifespanYears":   { "type": ["object", "null"] },
    "tank":            { "type": "object" },
    "careLevel":       { "type": ["string", "null"] },
    "diet":            { "type": ["object", "null"] },
    "compatibility":   { "type": "object" },
    "media":           { "type": "object" },
    "summary":         { "type": ["string", "null"] },
    "careNotes":       { "type": ["string", "null"] },
    "breedingNotes":   { "type": ["string", "null"] },
    "sources":         { "type": "object" },

    "fish":         { "type": ["object", "null"] },
    "crustacean":   { "type": ["object", "null"] },
    "coral":        { "type": ["object", "null"] },
    "mollusc":      { "type": ["object", "null"] },
    "echinoderm":   { "type": ["object", "null"] },
    "other-invert": { "type": ["object", "null"] },
    "plant":        { "type": ["object", "null"] },
    "macroalgae":   { "type": ["object", "null"] },

    "schemaVersion": { "type": "integer", "minimum": 1 },
    "dataStatus":    { "type": "string", "enum": ["placeholder", "researched", "needs_review", "reviewed"] },
    "lastReviewed":  { "type": ["string", "null"], "format": "date" }
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run:
```bash
npm test -- --watchAll=false src/species-schema/__tests__/schema.test.js
```
Expected: PASS — all 3 scaffold tests green.

- [ ] **Step 6: Commit**

```bash
git add src/species-schema/species.schema.json src/species-schema/__tests__/
git commit -m "feat(schema): scaffold species.schema.json with closed top-level shape"
```

---

## Task 4: Add subschemas for waterParameters, adultSizeCm, lifespanYears, tank, diet, compatibility, media, sources

**Files:**
- Modify: `src/species-schema/species.schema.json`
- Modify: `src/species-schema/__tests__/schema.test.js`
- Create: `src/species-schema/__tests__/fixtures/invalid-too-many-additional-sources.json`

This task replaces the loose `"type": "object"` placeholders from Task 3 with full subschemas. Each subschema is closed (`additionalProperties: false`).

- [ ] **Step 1: Write the failing test**

Append to `src/species-schema/__tests__/schema.test.js`:

```javascript
describe('species.schema.json — body subschemas', () => {
  const validate = buildAjv();

  test('rejects sources.additional with more than 5 entries', () => {
    const ok = validate(loadFixture('invalid-too-many-additional-sources'));
    expect(ok).toBe(false);
    expect(validate.errors.some(e => e.keyword === 'maxItems' && e.instancePath === '/sources/additional')).toBe(true);
  });

  test('rejects waterParameters with extra property', () => {
    const entry = loadFixture('valid-fish-placeholder');
    entry.waterParameters.unknownParam = { min: 1, max: 2 };
    const ok = validate(entry);
    expect(ok).toBe(false);
    expect(validate.errors.some(e => e.keyword === 'additionalProperties' && e.instancePath === '/waterParameters')).toBe(true);
  });

  test('accepts adultSizeCm with valid min/max range', () => {
    const entry = loadFixture('valid-fish-placeholder');
    entry.adultSizeCm = { min: 3.0, max: 4.0 };
    expect(validate(entry)).toBe(true);
  });

  test('rejects adultSizeCm with min > max', () => {
    const entry = loadFixture('valid-fish-placeholder');
    entry.adultSizeCm = { min: 10, max: 5 };
    const ok = validate(entry);
    expect(ok).toBe(false);
  });
});
```

- [ ] **Step 2: Create the negative fixture**

Create `src/species-schema/__tests__/fixtures/invalid-too-many-additional-sources.json`:

```json
{
  "id": "fw-001",
  "slug": "neon-tetra",
  "kind": "fauna",
  "taxon": "fish",
  "waterType": "freshwater",
  "commonName": "Neon Tetra",
  "scientificName": "Paracheirodon innesi",
  "alsoKnownAs": [],
  "category": "Tetra",
  "taxonomy": { "family": null, "order": null },
  "nativeRange": { "regions": [], "countries": [], "habitat": null, "biotope": null },
  "waterParameters": { "temperatureC": null, "pH": null, "gH": null, "kH": null, "salinity": null },
  "adultSizeCm": null,
  "lifespanYears": null,
  "tank": { "minVolumeLiters": null, "minLengthCm": null, "swimZone": null, "decorPreferences": [] },
  "careLevel": null,
  "diet": null,
  "compatibility": { "temperament": null, "grouping": null, "minGroupSize": null, "goodWith": [], "avoidWith": [] },
  "media": { "primaryImage": "neon_tetra.webp", "gallery": [] },
  "summary": "Placeholder description.",
  "careNotes": null,
  "breedingNotes": null,
  "sources": {
    "primary": { "name": "Aquarium Co-Op", "url": "https://example.com/a", "accessedDate": "2026-05-13" },
    "additional": [
      { "name": "Source 1", "url": "https://example.com/1", "accessedDate": "2026-05-13", "notes": null },
      { "name": "Source 2", "url": "https://example.com/2", "accessedDate": "2026-05-13", "notes": null },
      { "name": "Source 3", "url": "https://example.com/3", "accessedDate": "2026-05-13", "notes": null },
      { "name": "Source 4", "url": "https://example.com/4", "accessedDate": "2026-05-13", "notes": null },
      { "name": "Source 5", "url": "https://example.com/5", "accessedDate": "2026-05-13", "notes": null },
      { "name": "Source 6", "url": "https://example.com/6", "accessedDate": "2026-05-13", "notes": null }
    ]
  },
  "fish": null,
  "crustacean": null,
  "coral": null,
  "mollusc": null,
  "echinoderm": null,
  "other-invert": null,
  "plant": null,
  "macroalgae": null,
  "schemaVersion": 1,
  "dataStatus": "placeholder",
  "lastReviewed": null
}
```

- [ ] **Step 3: Run tests to verify the new ones fail**

Run:
```bash
npm test -- --watchAll=false src/species-schema/__tests__/schema.test.js
```
Expected: 3 new tests FAIL (the `maxItems`, `additionalProperties` on waterParameters, and min/max ordering rules aren't enforced yet); the `accepts adultSizeCm with valid min/max` test will pass coincidentally because the scaffold accepts any object.

- [ ] **Step 4: Add reusable subschema definitions**

Replace the existing `"properties"` block in `src/species-schema/species.schema.json` by adding a `$defs` section at the top of the schema and replacing the loose body placeholders with `$ref`s. Apply this edit in two parts to keep the diff clear.

**Part A** — add `$defs` block right after `"description"` (top of the schema):

```json
  "$defs": {
    "numericRange": {
      "type": "object",
      "additionalProperties": false,
      "required": ["min", "max"],
      "properties": {
        "min": { "type": "number" },
        "max": { "type": "number" }
      },
      "allOf": [
        { "if": { "properties": { "min": { "type": "number" }, "max": { "type": "number" } } },
          "then": { "properties": { "min": { "type": "number" }, "max": { "type": "number" } } } }
      ]
    },
    "nullableNumericRange": {
      "oneOf": [
        { "type": "null" },
        { "$ref": "#/$defs/numericRange" }
      ]
    },
    "source": {
      "type": "object",
      "additionalProperties": false,
      "required": ["name", "url", "accessedDate"],
      "properties": {
        "name":         { "type": "string", "minLength": 1 },
        "url":          { "type": "string", "format": "uri" },
        "accessedDate": { "type": "string", "format": "date" },
        "notes":        { "type": ["string", "null"] }
      }
    }
  },
```

(Note: enforcing `min <= max` requires a JSON Schema `dependentSchemas` or a custom keyword. For simplicity here we'll validate `min <= max` in the validator script (Task 8) as a post-pass after schema validation, since pure JSON Schema can't compare two sibling numeric values cleanly.)

**Part B** — replace these scaffolded properties:

```json
    "waterParameters": { "type": "object" },
    "adultSizeCm":     { "type": ["object", "null"] },
    "lifespanYears":   { "type": ["object", "null"] },
    "tank":            { "type": "object" },
    "careLevel":       { "type": ["string", "null"] },
    "diet":            { "type": ["object", "null"] },
    "compatibility":   { "type": "object" },
    "media":           { "type": "object" },
    "summary":         { "type": ["string", "null"] },
    "careNotes":       { "type": ["string", "null"] },
    "breedingNotes":   { "type": ["string", "null"] },
    "sources":         { "type": "object" },
```

with these proper subschemas:

```json
    "waterParameters": {
      "type": "object",
      "additionalProperties": false,
      "required": ["temperatureC", "pH", "gH", "kH", "salinity"],
      "properties": {
        "temperatureC": { "$ref": "#/$defs/nullableNumericRange" },
        "pH":           { "$ref": "#/$defs/nullableNumericRange" },
        "gH":           { "$ref": "#/$defs/nullableNumericRange" },
        "kH":           { "$ref": "#/$defs/nullableNumericRange" },
        "salinity":     { "$ref": "#/$defs/nullableNumericRange" }
      }
    },

    "adultSizeCm":   { "$ref": "#/$defs/nullableNumericRange" },
    "lifespanYears": { "$ref": "#/$defs/nullableNumericRange" },

    "tank": {
      "type": "object",
      "additionalProperties": false,
      "required": ["minVolumeLiters", "minLengthCm", "swimZone", "decorPreferences"],
      "properties": {
        "minVolumeLiters":  { "type": ["number", "null"], "minimum": 0 },
        "minLengthCm":      { "type": ["number", "null"], "minimum": 0 },
        "swimZone":         { "type": ["string", "null"], "enum": ["top", "mid", "bottom", "all", null] },
        "decorPreferences": { "type": "array", "items": { "type": "string" } }
      }
    },

    "careLevel": { "type": ["string", "null"], "enum": ["beginner", "intermediate", "advanced", "expert", null] },

    "diet": {
      "oneOf": [
        { "type": "null" },
        {
          "type": "object",
          "additionalProperties": false,
          "required": ["type", "notes"],
          "properties": {
            "type":  { "type": "string", "enum": ["herbivore", "carnivore", "omnivore", "planktivore", "detritivore"] },
            "notes": { "type": ["string", "null"] }
          }
        }
      ]
    },

    "compatibility": {
      "type": "object",
      "additionalProperties": false,
      "required": ["temperament", "grouping", "minGroupSize", "goodWith", "avoidWith"],
      "properties": {
        "temperament":  { "type": ["string", "null"], "enum": ["peaceful", "semi-aggressive", "aggressive", "territorial", null] },
        "grouping":     { "type": ["string", "null"], "enum": ["solitary", "pair", "shoaling", "schooling", null] },
        "minGroupSize": { "type": ["integer", "null"], "minimum": 1 },
        "goodWith":     { "type": "array", "items": { "type": "string" } },
        "avoidWith":    { "type": "array", "items": { "type": "string" } }
      }
    },

    "media": {
      "type": "object",
      "additionalProperties": false,
      "required": ["primaryImage", "gallery"],
      "properties": {
        "primaryImage": { "type": ["string", "null"] },
        "gallery":      { "type": "array", "items": { "type": "string" } }
      }
    },

    "summary":       { "type": ["string", "null"], "maxLength": 400 },
    "careNotes":     { "type": ["string", "null"] },
    "breedingNotes": { "type": ["string", "null"] },

    "sources": {
      "type": "object",
      "additionalProperties": false,
      "required": ["primary", "additional"],
      "properties": {
        "primary": {
          "oneOf": [
            { "type": "null" },
            { "$ref": "#/$defs/source" }
          ]
        },
        "additional": {
          "type": "array",
          "items": { "$ref": "#/$defs/source" },
          "maxItems": 5
        }
      }
    },
```

- [ ] **Step 5: Run all schema tests**

Run:
```bash
npm test -- --watchAll=false src/species-schema/__tests__/schema.test.js
```
Expected: `rejects sources.additional with more than 5 entries` PASS; `rejects waterParameters with extra property` PASS; `accepts adultSizeCm with valid min/max range` PASS. The `rejects adultSizeCm with min > max` test will still FAIL — that rule will be enforced post-schema in the validator script (Task 8). Mark this test with `test.skip(...)` for now with a comment referencing Task 8:

```javascript
test.skip('rejects adultSizeCm with min > max (enforced in validate.js post-pass, see Task 8)', () => {
  // moved to validate.test.js
});
```

Run again to confirm all non-skipped tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/species-schema/species.schema.json src/species-schema/__tests__/
git commit -m "feat(schema): add subschemas for waterParameters, tank, diet, compatibility, media, sources"
```

---

## Task 5: Add variant block subschemas (8 taxa) with `taxon`-conditional gating

**Files:**
- Modify: `src/species-schema/species.schema.json`
- Modify: `src/species-schema/__tests__/schema.test.js`
- Create: `src/species-schema/__tests__/fixtures/valid-fish-researched.json`
- Create: `src/species-schema/__tests__/fixtures/valid-coral-researched.json`
- Create: `src/species-schema/__tests__/fixtures/valid-plant-researched.json`
- Create: `src/species-schema/__tests__/fixtures/invalid-kind-taxon-mismatch.json`
- Create: `src/species-schema/__tests__/fixtures/invalid-coral-freshwater.json`

This task adds all eight variant block subschemas, the `kind ↔ taxon` consistency rule, the variant-block gating (`taxon === "X"` ⇒ `X` block present, others null), and the `coral ⇒ saltwater` rule.

- [ ] **Step 1: Write the failing tests**

Append to `src/species-schema/__tests__/schema.test.js`:

```javascript
describe('species.schema.json — variant gating', () => {
  const validate = buildAjv();

  test('accepts valid researched fish entry', () => {
    const ok = validate(loadFixture('valid-fish-researched'));
    expect(validate.errors).toBeNull();
    expect(ok).toBe(true);
  });

  test('accepts valid researched coral entry', () => {
    const ok = validate(loadFixture('valid-coral-researched'));
    expect(validate.errors).toBeNull();
    expect(ok).toBe(true);
  });

  test('accepts valid researched plant entry', () => {
    const ok = validate(loadFixture('valid-plant-researched'));
    expect(validate.errors).toBeNull();
    expect(ok).toBe(true);
  });

  test('rejects kind=flora with taxon=fish', () => {
    const ok = validate(loadFixture('invalid-kind-taxon-mismatch'));
    expect(ok).toBe(false);
  });

  test('rejects coral with freshwater waterType', () => {
    const ok = validate(loadFixture('invalid-coral-freshwater'));
    expect(ok).toBe(false);
  });

  test('rejects fish entry where fish block is null', () => {
    const entry = loadFixture('valid-fish-researched');
    entry.fish = null;
    const ok = validate(entry);
    expect(ok).toBe(false);
  });

  test('rejects fish entry where coral block is non-null', () => {
    const entry = loadFixture('valid-fish-researched');
    entry.coral = { coralType: 'LPS', lighting: { minPAR: 50, maxPAR: 150 }, flow: 'medium', placement: 'lower', aggressionRangeCm: null, feedingFrequency: 'weekly', calciumPPM: null, magnesiumPPM: null };
    const ok = validate(entry);
    expect(ok).toBe(false);
  });
});
```

- [ ] **Step 2: Create the three positive fixtures**

Create `src/species-schema/__tests__/fixtures/valid-fish-researched.json`:

```json
{
  "id": "fw-001",
  "slug": "neon-tetra",
  "kind": "fauna",
  "taxon": "fish",
  "waterType": "freshwater",
  "commonName": "Neon Tetra",
  "scientificName": "Paracheirodon innesi",
  "alsoKnownAs": ["Neon"],
  "category": "Tetra",
  "taxonomy": { "family": "Characidae", "order": "Characiformes" },
  "nativeRange": {
    "regions": ["South America"],
    "countries": ["Brazil", "Colombia", "Peru"],
    "habitat": "Slow-moving blackwater tributaries of the Amazon basin",
    "biotope": "Blackwater"
  },
  "waterParameters": {
    "temperatureC": { "min": 20, "max": 26 },
    "pH":           { "min": 5.5, "max": 7.5 },
    "gH":           { "min": 1, "max": 10 },
    "kH":           { "min": 0, "max": 4 },
    "salinity":     null
  },
  "adultSizeCm":   { "min": 3.0, "max": 4.0 },
  "lifespanYears": { "min": 5, "max": 8 },
  "tank": {
    "minVolumeLiters": 60,
    "minLengthCm": 60,
    "swimZone": "mid",
    "decorPreferences": ["plants", "driftwood", "subdued lighting"]
  },
  "careLevel": "beginner",
  "diet": { "type": "omnivore", "notes": "Flakes, micropellets, frozen brine shrimp, daphnia." },
  "compatibility": {
    "temperament": "peaceful",
    "grouping": "schooling",
    "minGroupSize": 6,
    "goodWith": ["peaceful community", "small tetras", "corydoras"],
    "avoidWith": ["large cichlids", "fin nippers"]
  },
  "media": { "primaryImage": "neon_tetra.webp", "gallery": [] },
  "summary": "Small, peaceful schooling tetra with iridescent blue and red stripes.",
  "careNotes": "Hardy community fish best kept in groups of 6+. Prefers soft, slightly acidic water and dim lighting.",
  "breedingNotes": null,
  "sources": {
    "primary": {
      "name": "Aquarium Co-Op",
      "url": "https://www.aquariumcoop.com/blogs/aquarium/neon-tetra-care-guide",
      "accessedDate": "2026-05-13",
      "notes": null
    },
    "additional": []
  },
  "fish": {
    "breedingDifficulty": "advanced",
    "breedingNotes": "Soft, acidic water and subdued lighting required.",
    "conspecificAggression": "none",
    "finNippy": false,
    "reefSafe": null
  },
  "crustacean": null,
  "coral": null,
  "mollusc": null,
  "echinoderm": null,
  "other-invert": null,
  "plant": null,
  "macroalgae": null,
  "schemaVersion": 1,
  "dataStatus": "researched",
  "lastReviewed": "2026-05-13"
}
```

Create `src/species-schema/__tests__/fixtures/valid-coral-researched.json`:

```json
{
  "id": "sw-coral-001",
  "slug": "hammer-coral",
  "kind": "fauna",
  "taxon": "coral",
  "waterType": "saltwater",
  "commonName": "Hammer Coral",
  "scientificName": "Euphyllia ancora",
  "alsoKnownAs": ["Anchor Coral"],
  "category": "LPS Coral",
  "taxonomy": { "family": "Euphylliidae", "order": "Scleractinia" },
  "nativeRange": {
    "regions": ["Indo-Pacific"],
    "countries": ["Australia", "Indonesia", "Philippines"],
    "habitat": "Tropical reef slopes, 5-20m depth",
    "biotope": "Reef"
  },
  "waterParameters": {
    "temperatureC": { "min": 24, "max": 26 },
    "pH":           { "min": 8.1, "max": 8.4 },
    "gH":           null,
    "kH":           { "min": 8, "max": 12 },
    "salinity":     { "min": 33, "max": 35 }
  },
  "adultSizeCm":   { "min": 10, "max": 30 },
  "lifespanYears": null,
  "tank": {
    "minVolumeLiters": 200,
    "minLengthCm": 90,
    "swimZone": "bottom",
    "decorPreferences": ["live rock", "moderate flow"]
  },
  "careLevel": "intermediate",
  "diet": { "type": "carnivore", "notes": "Photosynthetic; supplemental feeding of mysis or coral foods weekly." },
  "compatibility": {
    "temperament": "aggressive",
    "grouping": "solitary",
    "minGroupSize": null,
    "goodWith": [],
    "avoidWith": ["other Euphyllia colonies within sting range"]
  },
  "media": { "primaryImage": null, "gallery": [] },
  "summary": "Popular LPS coral with hammer-shaped tentacle tips; semi-aggressive with long sting range.",
  "careNotes": "Place with ample buffer from other corals. Moderate light and flow. Stable alkalinity is critical.",
  "breedingNotes": null,
  "sources": {
    "primary": {
      "name": "WWC",
      "url": "https://www.worldwidecorals.com/blogs/care-sheets/hammer-coral-care",
      "accessedDate": "2026-05-13",
      "notes": null
    },
    "additional": []
  },
  "fish": null,
  "crustacean": null,
  "coral": {
    "coralType": "LPS",
    "lighting": { "minPAR": 50, "maxPAR": 150 },
    "flow": "medium",
    "placement": "lower",
    "aggressionRangeCm": 10,
    "feedingFrequency": "weekly",
    "calciumPPM":   { "min": 380, "max": 450 },
    "magnesiumPPM": { "min": 1250, "max": 1400 }
  },
  "mollusc": null,
  "echinoderm": null,
  "other-invert": null,
  "plant": null,
  "macroalgae": null,
  "schemaVersion": 1,
  "dataStatus": "researched",
  "lastReviewed": "2026-05-13"
}
```

Create `src/species-schema/__tests__/fixtures/valid-plant-researched.json`:

```json
{
  "id": "fl-001",
  "slug": "java-fern",
  "kind": "flora",
  "taxon": "plant",
  "waterType": "freshwater",
  "commonName": "Java Fern",
  "scientificName": "Microsorum pteropus",
  "alsoKnownAs": [],
  "category": "Fern",
  "taxonomy": { "family": "Polypodiaceae", "order": "Polypodiales" },
  "nativeRange": {
    "regions": ["Southeast Asia"],
    "countries": ["Thailand", "Malaysia", "Indonesia"],
    "habitat": "Shaded streams and on rocks/wood in flowing water",
    "biotope": "Stream"
  },
  "waterParameters": {
    "temperatureC": { "min": 18, "max": 28 },
    "pH":           { "min": 6.0, "max": 7.5 },
    "gH":           { "min": 2, "max": 15 },
    "kH":           { "min": 3, "max": 8 },
    "salinity":     null
  },
  "adultSizeCm":   { "min": 15, "max": 35 },
  "lifespanYears": null,
  "tank": {
    "minVolumeLiters": 40,
    "minLengthCm": 45,
    "swimZone": "all",
    "decorPreferences": ["driftwood", "rocks"]
  },
  "careLevel": "beginner",
  "diet": null,
  "compatibility": {
    "temperament": null,
    "grouping": null,
    "minGroupSize": null,
    "goodWith": [],
    "avoidWith": []
  },
  "media": { "primaryImage": "java_fern.jpg", "gallery": [] },
  "summary": "Hardy epiphytic fern that attaches to driftwood or rocks; thrives in low light.",
  "careNotes": "Do not bury rhizome. Tie to driftwood or rock until rhizome attaches.",
  "breedingNotes": null,
  "sources": {
    "primary": {
      "name": "Buce Plant",
      "url": "https://www.buceplant.com/products/java-fern",
      "accessedDate": "2026-05-13",
      "notes": null
    },
    "additional": []
  },
  "fish": null,
  "crustacean": null,
  "coral": null,
  "mollusc": null,
  "echinoderm": null,
  "other-invert": null,
  "plant": {
    "lighting": "low",
    "co2": "optional",
    "growthRate": "slow",
    "placement": "epiphyte",
    "propagation": ["rhizome division", "adventitious plantlets"],
    "substrate": "n/a",
    "fertilization": "low"
  },
  "macroalgae": null,
  "schemaVersion": 1,
  "dataStatus": "researched",
  "lastReviewed": "2026-05-13"
}
```

- [ ] **Step 3: Create the negative fixtures**

Create `src/species-schema/__tests__/fixtures/invalid-kind-taxon-mismatch.json` — same shape as `valid-fish-researched.json` but with `kind` flipped to `flora` (taxon `fish` is invalid under `flora`):

```json
{
  "id": "fw-001",
  "slug": "neon-tetra",
  "kind": "flora",
  "taxon": "fish",
  "waterType": "freshwater",
  "commonName": "Neon Tetra",
  "scientificName": "Paracheirodon innesi",
  "alsoKnownAs": ["Neon"],
  "category": "Tetra",
  "taxonomy": { "family": "Characidae", "order": "Characiformes" },
  "nativeRange": { "regions": ["South America"], "countries": ["Brazil"], "habitat": "Slow-moving blackwater", "biotope": "Blackwater" },
  "waterParameters": {
    "temperatureC": { "min": 20, "max": 26 }, "pH": { "min": 5.5, "max": 7.5 },
    "gH": { "min": 1, "max": 10 }, "kH": { "min": 0, "max": 4 }, "salinity": null
  },
  "adultSizeCm": { "min": 3.0, "max": 4.0 },
  "lifespanYears": { "min": 5, "max": 8 },
  "tank": { "minVolumeLiters": 60, "minLengthCm": 60, "swimZone": "mid", "decorPreferences": ["plants"] },
  "careLevel": "beginner",
  "diet": { "type": "omnivore", "notes": "Flakes." },
  "compatibility": { "temperament": "peaceful", "grouping": "schooling", "minGroupSize": 6, "goodWith": [], "avoidWith": [] },
  "media": { "primaryImage": "neon_tetra.webp", "gallery": [] },
  "summary": "Test fixture for kind/taxon mismatch.",
  "careNotes": null,
  "breedingNotes": null,
  "sources": {
    "primary": { "name": "Aquarium Co-Op", "url": "https://www.aquariumcoop.com/", "accessedDate": "2026-05-13", "notes": null },
    "additional": []
  },
  "fish": {
    "breedingDifficulty": "advanced", "breedingNotes": null,
    "conspecificAggression": "none", "finNippy": false, "reefSafe": null
  },
  "crustacean": null, "coral": null, "mollusc": null, "echinoderm": null,
  "other-invert": null, "plant": null, "macroalgae": null,
  "schemaVersion": 1, "dataStatus": "researched", "lastReviewed": "2026-05-13"
}
```

Create `src/species-schema/__tests__/fixtures/invalid-coral-freshwater.json` — same shape as `valid-coral-researched.json` but with `waterType` flipped to `freshwater` (coral requires saltwater):

```json
{
  "id": "sw-coral-001",
  "slug": "hammer-coral",
  "kind": "fauna",
  "taxon": "coral",
  "waterType": "freshwater",
  "commonName": "Hammer Coral",
  "scientificName": "Euphyllia ancora",
  "alsoKnownAs": [],
  "category": "LPS Coral",
  "taxonomy": { "family": "Euphylliidae", "order": "Scleractinia" },
  "nativeRange": { "regions": ["Indo-Pacific"], "countries": [], "habitat": "Reef", "biotope": "Reef" },
  "waterParameters": {
    "temperatureC": { "min": 24, "max": 26 }, "pH": { "min": 8.1, "max": 8.4 },
    "gH": null, "kH": { "min": 8, "max": 12 }, "salinity": { "min": 33, "max": 35 }
  },
  "adultSizeCm": { "min": 10, "max": 30 },
  "lifespanYears": null,
  "tank": { "minVolumeLiters": 200, "minLengthCm": 90, "swimZone": "bottom", "decorPreferences": ["live rock"] },
  "careLevel": "intermediate",
  "diet": { "type": "carnivore", "notes": "Mysis weekly." },
  "compatibility": { "temperament": "aggressive", "grouping": "solitary", "minGroupSize": null, "goodWith": [], "avoidWith": [] },
  "media": { "primaryImage": null, "gallery": [] },
  "summary": "Test fixture for coral/freshwater rejection.",
  "careNotes": null,
  "breedingNotes": null,
  "sources": {
    "primary": { "name": "WWC", "url": "https://www.worldwidecorals.com/", "accessedDate": "2026-05-13", "notes": null },
    "additional": []
  },
  "fish": null, "crustacean": null,
  "coral": {
    "coralType": "LPS", "lighting": { "minPAR": 50, "maxPAR": 150 },
    "flow": "medium", "placement": "lower", "aggressionRangeCm": 10,
    "feedingFrequency": "weekly",
    "calciumPPM": { "min": 380, "max": 450 }, "magnesiumPPM": { "min": 1250, "max": 1400 }
  },
  "mollusc": null, "echinoderm": null, "other-invert": null,
  "plant": null, "macroalgae": null,
  "schemaVersion": 1, "dataStatus": "researched", "lastReviewed": "2026-05-13"
}
```

- [ ] **Step 4: Run tests to verify they fail**

Run:
```bash
npm test -- --watchAll=false src/species-schema/__tests__/schema.test.js
```
Expected: the 7 new tests FAIL (variant gating, kind/taxon consistency, coral/saltwater rule not yet enforced).

- [ ] **Step 5: Add variant subschemas to `$defs` and append conditional rules**

**Part A** — extend `$defs` in `src/species-schema/species.schema.json` to include each variant block. Add these under the existing `$defs` entries:

```json
    "fishVariant": {
      "type": "object",
      "additionalProperties": false,
      "required": ["breedingDifficulty", "breedingNotes", "conspecificAggression", "finNippy", "reefSafe"],
      "properties": {
        "breedingDifficulty":     { "type": ["string", "null"], "enum": ["easy", "moderate", "difficult", "advanced", "not in captivity", null] },
        "breedingNotes":          { "type": ["string", "null"] },
        "conspecificAggression":  { "type": ["string", "null"], "enum": ["none", "low", "moderate", "high", null] },
        "finNippy":               { "type": ["boolean", "null"] },
        "reefSafe":               { "type": ["string", "null"], "enum": ["yes", "with caution", "no", null] }
      }
    },
    "crustaceanVariant": {
      "type": "object",
      "additionalProperties": false,
      "required": ["copperSensitive", "moltingFrequencyDays", "moltingNotes", "escapeRisk", "breedingDifficulty", "breedingNotes", "speciesOnlyTankRecommended"],
      "properties": {
        "copperSensitive":            { "type": ["boolean", "null"] },
        "moltingFrequencyDays":       { "type": ["integer", "null"], "minimum": 0 },
        "moltingNotes":               { "type": ["string", "null"] },
        "escapeRisk":                 { "type": ["string", "null"], "enum": ["low", "moderate", "high", null] },
        "breedingDifficulty":         { "type": ["string", "null"], "enum": ["easy", "moderate", "difficult", "advanced", "not in captivity", null] },
        "breedingNotes":              { "type": ["string", "null"] },
        "speciesOnlyTankRecommended": { "type": ["boolean", "null"] }
      }
    },
    "coralVariant": {
      "type": "object",
      "additionalProperties": false,
      "required": ["coralType", "lighting", "flow", "placement", "aggressionRangeCm", "feedingFrequency", "calciumPPM", "magnesiumPPM"],
      "properties": {
        "coralType":         { "type": ["string", "null"], "enum": ["LPS", "SPS", "soft", "anemone", "zoanthid", "mushroom", null] },
        "lighting": {
          "oneOf": [
            { "type": "null" },
            {
              "type": "object",
              "additionalProperties": false,
              "required": ["minPAR", "maxPAR"],
              "properties": {
                "minPAR": { "type": "number", "minimum": 0 },
                "maxPAR": { "type": "number", "minimum": 0 }
              }
            }
          ]
        },
        "flow":              { "type": ["string", "null"], "enum": ["low", "medium", "high", null] },
        "placement":         { "type": ["string", "null"], "enum": ["lower", "middle", "upper", "anywhere", null] },
        "aggressionRangeCm": { "type": ["number", "null"], "minimum": 0 },
        "feedingFrequency":  { "type": ["string", "null"], "enum": ["none", "weekly", "daily", null] },
        "calciumPPM":        { "$ref": "#/$defs/nullableNumericRange" },
        "magnesiumPPM":      { "$ref": "#/$defs/nullableNumericRange" }
      }
    },
    "molluscVariant": {
      "type": "object",
      "additionalProperties": false,
      "required": ["copperSensitive", "substrateNeeds", "climbsOutOfTank", "algaeTypesConsumed"],
      "properties": {
        "copperSensitive":     { "type": ["boolean", "null"] },
        "substrateNeeds":      { "type": ["string", "null"], "enum": ["any", "sand", "gravel", "soft", null] },
        "climbsOutOfTank":     { "type": ["boolean", "null"] },
        "algaeTypesConsumed":  { "type": "array", "items": { "type": "string" } }
      }
    },
    "echinodermVariant": {
      "type": "object",
      "additionalProperties": false,
      "required": ["copperSensitive", "minTankAgeMonths", "coralSafe", "waterStabilitySensitivity"],
      "properties": {
        "copperSensitive":            { "type": ["boolean", "null"] },
        "minTankAgeMonths":           { "type": ["integer", "null"], "minimum": 0 },
        "coralSafe":                  { "type": ["boolean", "null"] },
        "waterStabilitySensitivity":  { "type": ["string", "null"], "enum": ["low", "moderate", "high", null] }
      }
    },
    "otherInvertVariant": {
      "type": "object",
      "additionalProperties": false,
      "required": ["notes"],
      "properties": {
        "notes": { "type": ["string", "null"] }
      }
    },
    "plantVariant": {
      "type": "object",
      "additionalProperties": false,
      "required": ["lighting", "co2", "growthRate", "placement", "propagation", "substrate", "fertilization"],
      "properties": {
        "lighting":      { "type": ["string", "null"], "enum": ["low", "medium", "high", null] },
        "co2":           { "type": ["string", "null"], "enum": ["none", "optional", "recommended", null] },
        "growthRate":    { "type": ["string", "null"], "enum": ["slow", "medium", "fast", null] },
        "placement":     { "type": ["string", "null"], "enum": ["foreground", "midground", "background", "floating", "epiphyte", null] },
        "propagation":   { "type": "array", "items": { "type": "string" } },
        "substrate":     { "type": ["string", "null"], "enum": ["any", "nutrient-rich", "inert", "n/a", null] },
        "fertilization": { "type": ["string", "null"], "enum": ["low", "moderate", "heavy", null] }
      }
    },
    "macroalgaeVariant": {
      "type": "object",
      "additionalProperties": false,
      "required": ["lighting", "growthRate", "form", "placement", "nutrientUptake", "propagation"],
      "properties": {
        "lighting":       { "type": ["string", "null"], "enum": ["low", "medium", "high", null] },
        "growthRate":     { "type": ["string", "null"], "enum": ["slow", "medium", "fast", null] },
        "form":           { "type": ["string", "null"], "enum": ["macroalgae", "filamentous", "calcareous", "encrusting", null] },
        "placement":      { "type": ["string", "null"], "enum": ["refugium", "display", "sump", null] },
        "nutrientUptake": { "type": ["string", "null"], "enum": ["low", "moderate", "high", null] },
        "propagation":    { "type": "array", "items": { "type": "string" } }
      }
    }
  },
```

**Part B** — replace the per-variant top-level scaffolds:

```json
    "fish":         { "type": ["object", "null"] },
    "crustacean":   { "type": ["object", "null"] },
    "coral":        { "type": ["object", "null"] },
    "mollusc":      { "type": ["object", "null"] },
    "echinoderm":   { "type": ["object", "null"] },
    "other-invert": { "type": ["object", "null"] },
    "plant":        { "type": ["object", "null"] },
    "macroalgae":   { "type": ["object", "null"] },
```

with refs:

```json
    "fish":         { "oneOf": [{ "type": "null" }, { "$ref": "#/$defs/fishVariant" }] },
    "crustacean":   { "oneOf": [{ "type": "null" }, { "$ref": "#/$defs/crustaceanVariant" }] },
    "coral":        { "oneOf": [{ "type": "null" }, { "$ref": "#/$defs/coralVariant" }] },
    "mollusc":      { "oneOf": [{ "type": "null" }, { "$ref": "#/$defs/molluscVariant" }] },
    "echinoderm":   { "oneOf": [{ "type": "null" }, { "$ref": "#/$defs/echinodermVariant" }] },
    "other-invert": { "oneOf": [{ "type": "null" }, { "$ref": "#/$defs/otherInvertVariant" }] },
    "plant":        { "oneOf": [{ "type": "null" }, { "$ref": "#/$defs/plantVariant" }] },
    "macroalgae":   { "oneOf": [{ "type": "null" }, { "$ref": "#/$defs/macroalgaeVariant" }] },
```

**Part C** — append `allOf` conditional rules to the top-level schema, right after the closing brace of `"properties"`:

```json
  ,
  "allOf": [
    {
      "if": { "properties": { "kind": { "const": "fauna" } } },
      "then": {
        "properties": {
          "taxon": { "enum": ["fish", "crustacean", "coral", "mollusc", "echinoderm", "other-invert"] },
          "plant": { "type": "null" },
          "macroalgae": { "type": "null" }
        }
      }
    },
    {
      "if": { "properties": { "kind": { "const": "flora" } } },
      "then": {
        "properties": {
          "taxon": { "enum": ["plant", "macroalgae"] },
          "fish": { "type": "null" },
          "crustacean": { "type": "null" },
          "coral": { "type": "null" },
          "mollusc": { "type": "null" },
          "echinoderm": { "type": "null" },
          "other-invert": { "type": "null" }
        }
      }
    },
    { "if": { "properties": { "taxon": { "const": "fish" } } },         "then": { "properties": { "fish":         { "$ref": "#/$defs/fishVariant" } }, "required": ["fish"] } },
    { "if": { "properties": { "taxon": { "const": "crustacean" } } },   "then": { "properties": { "crustacean":   { "$ref": "#/$defs/crustaceanVariant" } }, "required": ["crustacean"] } },
    { "if": { "properties": { "taxon": { "const": "coral" } } },        "then": { "properties": { "coral":        { "$ref": "#/$defs/coralVariant" }, "waterType": { "const": "saltwater" } }, "required": ["coral"] } },
    { "if": { "properties": { "taxon": { "const": "mollusc" } } },      "then": { "properties": { "mollusc":      { "$ref": "#/$defs/molluscVariant" } }, "required": ["mollusc"] } },
    { "if": { "properties": { "taxon": { "const": "echinoderm" } } },   "then": { "properties": { "echinoderm":   { "$ref": "#/$defs/echinodermVariant" } }, "required": ["echinoderm"] } },
    { "if": { "properties": { "taxon": { "const": "other-invert" } } }, "then": { "properties": { "other-invert": { "$ref": "#/$defs/otherInvertVariant" } }, "required": ["other-invert"] } },
    { "if": { "properties": { "taxon": { "const": "plant" } } },        "then": { "properties": { "plant":        { "$ref": "#/$defs/plantVariant" } }, "required": ["plant"] } },
    { "if": { "properties": { "taxon": { "const": "macroalgae" } } },   "then": { "properties": { "macroalgae":   { "$ref": "#/$defs/macroalgaeVariant" } }, "required": ["macroalgae"] } }
  ]
```

- [ ] **Step 6: Run tests to verify they pass**

Run:
```bash
npm test -- --watchAll=false src/species-schema/__tests__/schema.test.js
```
Expected: all schema tests PASS (positive fixtures accepted; mismatch/coral-freshwater/non-null-wrong-variant rejected).

- [ ] **Step 7: Commit**

```bash
git add src/species-schema/species.schema.json src/species-schema/__tests__/
git commit -m "feat(schema): add variant blocks for all 8 taxa with conditional gating"
```

---

## Task 6: Add `dataStatus`-conditional required fields

**Files:**
- Modify: `src/species-schema/species.schema.json`
- Modify: `src/species-schema/__tests__/schema.test.js`

Researched/needs_review/reviewed entries require richer data than placeholders. This task gates that.

- [ ] **Step 1: Write the failing test**

Append to `src/species-schema/__tests__/schema.test.js`:

```javascript
describe('species.schema.json — dataStatus conditional requirements', () => {
  const validate = buildAjv();

  test('rejects researched fish entry with null primary source', () => {
    const entry = loadFixture('valid-fish-researched');
    entry.sources.primary = null;
    const ok = validate(entry);
    expect(ok).toBe(false);
  });

  test('rejects researched fish entry with null waterParameters.temperatureC', () => {
    const entry = loadFixture('valid-fish-researched');
    entry.waterParameters.temperatureC = null;
    const ok = validate(entry);
    expect(ok).toBe(false);
  });

  test('rejects researched fish entry with null adultSizeCm', () => {
    const entry = loadFixture('valid-fish-researched');
    entry.adultSizeCm = null;
    const ok = validate(entry);
    expect(ok).toBe(false);
  });

  test('placeholder entry remains valid with null adultSizeCm and null primary source', () => {
    const ok = validate(loadFixture('valid-fish-placeholder'));
    expect(ok).toBe(true);
  });

  test('researched entry is allowed null media.primaryImage (discovered species)', () => {
    const entry = loadFixture('valid-fish-researched');
    entry.media.primaryImage = null;
    const ok = validate(entry);
    expect(validate.errors).toBeNull();
    expect(ok).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:
```bash
npm test -- --watchAll=false src/species-schema/__tests__/schema.test.js
```
Expected: the new conditional tests FAIL.

- [ ] **Step 3: Add `dietRequired` definition to `$defs`**

In `src/species-schema/species.schema.json`, append to the existing `$defs` block:

```json
    ,
    "dietRequired": {
      "type": "object",
      "required": ["type"],
      "additionalProperties": false,
      "properties": {
        "type":  { "type": "string", "enum": ["herbivore", "carnivore", "omnivore", "planktivore", "detritivore"] },
        "notes": { "type": ["string", "null"] }
      }
    }
```

- [ ] **Step 4: Append three `dataStatus`-conditional entries to the top-level `allOf` array**

In `src/species-schema/species.schema.json`, append these three entries inside the top-level `allOf` array (right before its closing `]`):

```json
    ,
    {
      "if": { "properties": { "dataStatus": { "enum": ["researched", "needs_review", "reviewed"] } } },
      "then": {
        "properties": {
          "sources": {
            "type": "object",
            "required": ["primary"],
            "properties": { "primary": { "$ref": "#/$defs/source" } }
          },
          "waterParameters": {
            "required": ["temperatureC", "pH"],
            "properties": {
              "temperatureC": { "$ref": "#/$defs/numericRange" },
              "pH":           { "$ref": "#/$defs/numericRange" }
            }
          },
          "adultSizeCm":   { "$ref": "#/$defs/numericRange" },
          "tank": {
            "required": ["minVolumeLiters"],
            "properties": { "minVolumeLiters": { "type": "number", "minimum": 0 } }
          },
          "careLevel": { "type": "string", "enum": ["beginner", "intermediate", "advanced", "expert"] },
          "diet":      { "$ref": "#/$defs/dietRequired" }
        }
      }
    },
    {
      "if": {
        "properties": {
          "kind": { "const": "fauna" },
          "dataStatus": { "enum": ["researched", "needs_review", "reviewed"] }
        }
      },
      "then": {
        "properties": {
          "compatibility": {
            "required": ["temperament", "grouping"],
            "properties": {
              "temperament": { "type": "string", "enum": ["peaceful", "semi-aggressive", "aggressive", "territorial"] },
              "grouping":    { "type": "string", "enum": ["solitary", "pair", "shoaling", "schooling"] }
            }
          }
        }
      }
    },
    {
      "if": { "properties": { "dataStatus": { "const": "reviewed" } } },
      "then": {
        "required": ["lastReviewed"],
        "properties": {
          "lastReviewed": { "type": "string", "format": "date" }
        }
      }
    }
```

Rationale for the split: the first conditional applies the full "researched" gate to all kinds. The second adds the fauna-only `compatibility.temperament` + `compatibility.grouping` requirement (flora doesn't have meaningful temperament/grouping). The third gates `reviewed` to additionally require `lastReviewed`.

- [ ] **Step 5: Run tests to verify they pass**

Run:
```bash
npm test -- --watchAll=false src/species-schema/__tests__/schema.test.js
```
Expected: all schema tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/species-schema/species.schema.json src/species-schema/__tests__/
git commit -m "feat(schema): add dataStatus-conditional required fields"
```

---

## Task 7: Write `validate.js` with multi-file and single-file modes plus min<=max post-pass

**Files:**
- Create: `src/species-build/validate.js`
- Create: `src/species-build/__tests__/validate.test.js`
- Create: `src/species-build/__tests__/fixtures/valid-min-max.json`
- Create: `src/species-build/__tests__/fixtures/invalid-min-gt-max.json`

`validate.js` is the gatekeeper. Two responsibilities: (1) JSON Schema validation via Ajv, (2) a custom post-pass that rejects any `{min, max}` pair where `min > max` (a constraint pure JSON Schema can't express cleanly).

- [ ] **Step 1: Write the failing test**

Create `src/species-build/__tests__/validate.test.js`:

```javascript
const path = require('path');
const { validateOne, validateAll } = require('../validate');

const FIXTURES = path.resolve(__dirname, 'fixtures');
const SCHEMA_FIXTURES = path.resolve(__dirname, '../../species-schema/__tests__/fixtures');

describe('validate.js — single-file mode', () => {
  test('valid fish entry passes', () => {
    const result = validateOne(path.join(SCHEMA_FIXTURES, 'valid-fish-researched.json'));
    expect(result.errors).toEqual([]);
    expect(result.ok).toBe(true);
  });

  test('invalid extra-property entry fails with structured errors', () => {
    const result = validateOne(path.join(SCHEMA_FIXTURES, 'invalid-extra-property.json'));
    expect(result.ok).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]).toHaveProperty('keyword');
    expect(result.errors[0]).toHaveProperty('instancePath');
  });

  test('rejects min > max in a numeric range (post-schema rule)', () => {
    const result = validateOne(path.join(FIXTURES, 'invalid-min-gt-max.json'));
    expect(result.ok).toBe(false);
    expect(result.errors.some(e =>
      e.keyword === 'min-le-max' && e.instancePath.includes('/adultSizeCm')
    )).toBe(true);
  });

  test('accepts a valid min <= max', () => {
    const result = validateOne(path.join(FIXTURES, 'valid-min-max.json'));
    expect(result.errors).toEqual([]);
    expect(result.ok).toBe(true);
  });
});

describe('validate.js — multi-file mode', () => {
  test('validateAll returns array of {filePath, ok, errors}', () => {
    const results = validateAll([
      path.join(SCHEMA_FIXTURES, 'valid-fish-researched.json'),
      path.join(SCHEMA_FIXTURES, 'invalid-extra-property.json')
    ]);
    expect(results).toHaveLength(2);
    expect(results[0].filePath).toBe(path.join(SCHEMA_FIXTURES, 'valid-fish-researched.json'));
    expect(results[0].ok).toBe(true);
    expect(results[1].ok).toBe(false);
  });
});
```

- [ ] **Step 2: Create fixture files**

Create `src/species-build/__tests__/fixtures/valid-min-max.json` — copy `valid-fish-researched.json` from Task 5 verbatim.

Create `src/species-build/__tests__/fixtures/invalid-min-gt-max.json` — copy `valid-fish-researched.json` and change `"adultSizeCm": { "min": 3.0, "max": 4.0 }` to `"adultSizeCm": { "min": 10.0, "max": 4.0 }`.

- [ ] **Step 3: Run tests to verify they fail**

Run:
```bash
npm test -- --watchAll=false src/species-build/__tests__/validate.test.js
```
Expected: FAIL with "Cannot find module '../validate'".

- [ ] **Step 4: Implement `validate.js`**

Create `src/species-build/validate.js`:

```javascript
const fs = require('fs');
const path = require('path');
const { globSync } = require('glob');
const Ajv = require('ajv/dist/2020');
const addFormats = require('ajv-formats');

const SCHEMA_DIR = path.resolve(__dirname, '..', 'species-schema');
const SPECIES_DIR = path.resolve(__dirname, '..', 'species');

function buildValidator() {
  const schema = JSON.parse(fs.readFileSync(path.join(SCHEMA_DIR, 'species.schema.json'), 'utf8'));
  const enums = JSON.parse(fs.readFileSync(path.join(SCHEMA_DIR, 'enums.json'), 'utf8'));
  const ajv = new Ajv({ allErrors: true, strict: true });
  addFormats(ajv);
  ajv.addSchema(enums, 'enums.json');
  return ajv.compile(schema);
}

// Walk an object looking for any {min, max} where both are numbers and min > max.
// Returns an array of {instancePath, min, max}.
function checkMinMax(obj, instancePath = '') {
  const violations = [];
  if (obj === null || typeof obj !== 'object') return violations;
  if (Array.isArray(obj)) {
    obj.forEach((v, i) => {
      violations.push(...checkMinMax(v, `${instancePath}/${i}`));
    });
    return violations;
  }
  const hasMin = Object.prototype.hasOwnProperty.call(obj, 'min');
  const hasMax = Object.prototype.hasOwnProperty.call(obj, 'max');
  if (hasMin && hasMax && typeof obj.min === 'number' && typeof obj.max === 'number' && obj.min > obj.max) {
    violations.push({ instancePath, min: obj.min, max: obj.max });
  }
  for (const [k, v] of Object.entries(obj)) {
    violations.push(...checkMinMax(v, `${instancePath}/${k}`));
  }
  return violations;
}

const validateAjv = buildValidator();

function validateOne(filePath) {
  let data;
  try {
    data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (e) {
    return {
      filePath,
      ok: false,
      errors: [{ keyword: 'parse', instancePath: '', message: `JSON parse error: ${e.message}` }]
    };
  }
  const ok = validateAjv(data);
  const schemaErrors = ok ? [] : (validateAjv.errors || []).map(e => ({
    keyword: e.keyword,
    instancePath: e.instancePath,
    schemaPath: e.schemaPath,
    message: e.message,
    params: e.params
  }));
  const minMaxViolations = checkMinMax(data).map(v => ({
    keyword: 'min-le-max',
    instancePath: v.instancePath,
    message: `min (${v.min}) must be <= max (${v.max})`
  }));
  const errors = [...schemaErrors, ...minMaxViolations];
  return { filePath, ok: errors.length === 0, errors };
}

function validateAll(filePaths) {
  return filePaths.map(validateOne);
}

function findAllSpeciesFiles() {
  return globSync('**/*.json', { cwd: SPECIES_DIR, absolute: true });
}

function formatErrors(result) {
  if (result.ok) return '';
  const rel = path.relative(process.cwd(), result.filePath);
  const lines = result.errors.map(e =>
    `  ${e.instancePath || '/'} (${e.keyword}): ${e.message || ''}`
  );
  return [`✗ ${rel}`, ...lines].join('\n');
}

// CLI entrypoint
if (require.main === module) {
  const argv = process.argv.slice(2);
  let targets;
  if (argv.length === 0) {
    targets = findAllSpeciesFiles();
  } else {
    targets = argv.map(a => path.resolve(a));
  }
  if (targets.length === 0) {
    console.log('No species files found.');
    process.exit(0);
  }
  const results = validateAll(targets);
  const failures = results.filter(r => !r.ok);
  if (failures.length === 0) {
    console.log(`✓ ${results.length} species file(s) validated successfully.`);
    process.exit(0);
  }
  failures.forEach(r => console.error(formatErrors(r)));
  console.error(`\n${failures.length} of ${results.length} files failed validation.`);
  process.exit(1);
}

module.exports = { validateOne, validateAll, findAllSpeciesFiles, formatErrors };
```

- [ ] **Step 5: Run tests to verify they pass**

Run:
```bash
npm test -- --watchAll=false src/species-build/__tests__/validate.test.js
```
Expected: all 5 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/species-build/validate.js src/species-build/__tests__/
git commit -m "feat(build): add validate.js with multi-file mode and min<=max post-pass"
```

---

## Task 8: Write `migrate-from-legacy.js`

**Files:**
- Create: `src/species-build/migrate-from-legacy.js`
- Create: `src/species-build/__tests__/migrate.test.js`
- Create: `src/species-build/__tests__/fixtures/legacy-fauna-mini.json`
- Create: `src/species-build/__tests__/fixtures/legacy-flora-mini.json`

Migration produces per-species placeholder files from the existing `fauna.json`/`flora.json`. Tested with a mini-fixture rather than the real legacy files so tests stay fast and deterministic.

- [ ] **Step 1: Write the failing test**

Create `src/species-build/__tests__/migrate.test.js`:

```javascript
const fs = require('fs');
const os = require('os');
const path = require('path');
const { migrate } = require('../migrate-from-legacy');

const FIXTURES = path.resolve(__dirname, 'fixtures');

function withTempDir(fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aquamate-migrate-'));
  try { return fn(dir); } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}

describe('migrate-from-legacy', () => {
  test('emits per-species files into <speciesDir>/<taxon>/<slug>.json', () => {
    withTempDir(speciesDir => {
      const report = migrate({
        faunaPath: path.join(FIXTURES, 'legacy-fauna-mini.json'),
        floraPath: path.join(FIXTURES, 'legacy-flora-mini.json'),
        speciesDir
      });
      expect(report.written.length).toBeGreaterThan(0);
      const neonPath = path.join(speciesDir, 'fish', 'neon-tetra.json');
      expect(fs.existsSync(neonPath)).toBe(true);
    });
  });

  test('infers taxon "crustacean" from "shrimp" keyword', () => {
    withTempDir(speciesDir => {
      migrate({
        faunaPath: path.join(FIXTURES, 'legacy-fauna-mini.json'),
        floraPath: path.join(FIXTURES, 'legacy-flora-mini.json'),
        speciesDir
      });
      const cherryPath = path.join(speciesDir, 'crustacean', 'cherry-shrimp.json');
      expect(fs.existsSync(cherryPath)).toBe(true);
      const cherry = JSON.parse(fs.readFileSync(cherryPath, 'utf8'));
      expect(cherry.taxon).toBe('crustacean');
      expect(cherry.kind).toBe('fauna');
    });
  });

  test('defaults to taxon "fish" for fauna entries without keyword matches', () => {
    withTempDir(speciesDir => {
      migrate({
        faunaPath: path.join(FIXTURES, 'legacy-fauna-mini.json'),
        floraPath: path.join(FIXTURES, 'legacy-flora-mini.json'),
        speciesDir
      });
      const neon = JSON.parse(fs.readFileSync(path.join(speciesDir, 'fish', 'neon-tetra.json'), 'utf8'));
      expect(neon.taxon).toBe('fish');
    });
  });

  test('flora entries default to taxon "plant"', () => {
    withTempDir(speciesDir => {
      migrate({
        faunaPath: path.join(FIXTURES, 'legacy-fauna-mini.json'),
        floraPath: path.join(FIXTURES, 'legacy-flora-mini.json'),
        speciesDir
      });
      const fern = JSON.parse(fs.readFileSync(path.join(speciesDir, 'plant', 'java-fern.json'), 'utf8'));
      expect(fern.taxon).toBe('plant');
      expect(fern.kind).toBe('flora');
    });
  });

  test('preserves id verbatim, moves image_url to media.primaryImage, moves description to summary', () => {
    withTempDir(speciesDir => {
      migrate({
        faunaPath: path.join(FIXTURES, 'legacy-fauna-mini.json'),
        floraPath: path.join(FIXTURES, 'legacy-flora-mini.json'),
        speciesDir
      });
      const neon = JSON.parse(fs.readFileSync(path.join(speciesDir, 'fish', 'neon-tetra.json'), 'utf8'));
      expect(neon.id).toBe('fw-001');
      expect(neon.media.primaryImage).toBe('neon_tetra.webp');
      expect(neon.summary).toBe('Placeholder description for Neon Tetra.');
    });
  });

  test('sets dataStatus to "placeholder"', () => {
    withTempDir(speciesDir => {
      migrate({
        faunaPath: path.join(FIXTURES, 'legacy-fauna-mini.json'),
        floraPath: path.join(FIXTURES, 'legacy-flora-mini.json'),
        speciesDir
      });
      const neon = JSON.parse(fs.readFileSync(path.join(speciesDir, 'fish', 'neon-tetra.json'), 'utf8'));
      expect(neon.dataStatus).toBe('placeholder');
    });
  });

  test('produces output that passes placeholder-mode schema validation', () => {
    withTempDir(speciesDir => {
      const report = migrate({
        faunaPath: path.join(FIXTURES, 'legacy-fauna-mini.json'),
        floraPath: path.join(FIXTURES, 'legacy-flora-mini.json'),
        speciesDir
      });
      const { validateOne } = require('../validate');
      for (const filePath of report.written) {
        const result = validateOne(filePath);
        if (!result.ok) {
          throw new Error(`Validation failed for ${filePath}:\n${JSON.stringify(result.errors, null, 2)}`);
        }
      }
    });
  });

  test('handles slug collisions by suffixing -2, -3, ...', () => {
    withTempDir(speciesDir => {
      // legacy-fauna-mini has two entries named "Neon Tetra" to exercise this
      migrate({
        faunaPath: path.join(FIXTURES, 'legacy-fauna-mini.json'),
        floraPath: path.join(FIXTURES, 'legacy-flora-mini.json'),
        speciesDir
      });
      expect(fs.existsSync(path.join(speciesDir, 'fish', 'neon-tetra.json'))).toBe(true);
      expect(fs.existsSync(path.join(speciesDir, 'fish', 'neon-tetra-2.json'))).toBe(true);
    });
  });
});
```

- [ ] **Step 2: Create fixture files**

Create `src/species-build/__tests__/fixtures/legacy-fauna-mini.json`:

```json
{
  "freshwater": {
    "pages": [
      {
        "page": 1,
        "items": [
          {
            "id": "fw-001",
            "commonName": "Neon Tetra",
            "scientificName": "",
            "category": "Tetra",
            "image_url": "neon_tetra.webp",
            "description": "Placeholder description for Neon Tetra."
          },
          {
            "id": "fw-002",
            "commonName": "Neon Tetra",
            "scientificName": "",
            "category": "Tetra",
            "image_url": "neon_tetra_2.webp",
            "description": "Duplicate name to exercise collision suffixing."
          },
          {
            "id": "fw-100",
            "commonName": "Cherry Shrimp",
            "scientificName": "Neocaridina davidi",
            "category": "Shrimp",
            "image_url": "cherry_shrimp.jpg",
            "description": "Placeholder description for Cherry Shrimp."
          }
        ]
      }
    ]
  },
  "saltwater": {
    "pages": [
      {
        "page": 1,
        "items": [
          {
            "id": "sw-001",
            "commonName": "Ocellaris Clownfish",
            "scientificName": "Amphiprion ocellaris",
            "category": "Clownfish",
            "image_url": "ocellaris_clownfish.jpg",
            "description": "Placeholder description for Ocellaris Clownfish."
          }
        ]
      }
    ]
  }
}
```

Create `src/species-build/__tests__/fixtures/legacy-flora-mini.json`:

```json
{
  "flora": {
    "pages": [
      {
        "page": 1,
        "items": [
          {
            "id": "fl-001",
            "commonName": "Java Fern",
            "scientificName": "",
            "category": "Fern",
            "image_url": "images/flora/java_fern.jpg",
            "description": "Placeholder description for Java Fern."
          }
        ]
      }
    ]
  }
}
```

- [ ] **Step 3: Run tests to verify they fail**

Run:
```bash
npm test -- --watchAll=false src/species-build/__tests__/migrate.test.js
```
Expected: FAIL with "Cannot find module '../migrate-from-legacy'".

- [ ] **Step 4: Implement `migrate-from-legacy.js`**

Create `src/species-build/migrate-from-legacy.js`:

```javascript
const fs = require('fs');
const path = require('path');

const TAXON_KEYWORDS = [
  { taxon: 'crustacean', patterns: [/shrimp/i, /crayfish/i, /crab/i, /lobster/i] },
  { taxon: 'coral',      patterns: [/coral/i, /anemone/i, /zoanthid/i, /polyp/i] },
  { taxon: 'mollusc',    patterns: [/snail/i, /clam/i, /conch/i, /nerite/i, /mystery/i] },
  { taxon: 'echinoderm', patterns: [/starfish/i, /sea star/i, /urchin/i, /sea cucumber/i] }
];

function slugify(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function inferTaxon({ commonName, kind }) {
  if (kind === 'flora') return 'plant';
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

function makePlaceholderEntry({ legacyItem, kind, taxon, waterType, slug }) {
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
      gallery: []
    },
    summary: legacyItem.description || null,
    careNotes: null,
    breedingNotes: null,
    sources: { primary: null, additional: [] },
    fish: null, crustacean: null, coral: null, mollusc: null,
    echinoderm: null, 'other-invert': null, plant: null, macroalgae: null,
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
    const taxon = inferTaxon({ commonName: item.commonName, kind });
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
```

- [ ] **Step 5: Run tests to verify they pass**

Run:
```bash
npm test -- --watchAll=false src/species-build/__tests__/migrate.test.js
```
Expected: all 8 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/species-build/migrate-from-legacy.js src/species-build/__tests__/
git commit -m "feat(build): add migrate-from-legacy.js with taxon keyword inference"
```

---

## Task 9: Write `compile.js`

**Files:**
- Create: `src/species-build/compile.js`
- Create: `src/species-build/__tests__/compile.test.js`

`compile.js` reads every `src/species/**/*.json` and emits a single `dist/species.json` grouped by `kind` + `waterType`.

- [ ] **Step 1: Write the failing test**

Create `src/species-build/__tests__/compile.test.js`:

```javascript
const fs = require('fs');
const os = require('os');
const path = require('path');
const { compile } = require('../compile');

function withTempDir(fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aquamate-compile-'));
  try { return fn(dir); } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}

function writeSpeciesFile(speciesDir, taxon, slug, overrides) {
  const taxonDir = path.join(speciesDir, taxon);
  fs.mkdirSync(taxonDir, { recursive: true });
  const fixturePath = path.resolve(__dirname, '..', '..', 'species-schema', '__tests__', 'fixtures', 'valid-fish-placeholder.json');
  const base = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
  const entry = { ...base, slug, ...overrides };
  fs.writeFileSync(path.join(taxonDir, `${slug}.json`), JSON.stringify(entry, null, 2));
}

describe('compile.js', () => {
  test('emits the expected top-level structure with all kind/waterType buckets present (empty if no species)', () => {
    withTempDir(speciesDir => {
      withTempDir(distDir => {
        const outPath = path.join(distDir, 'species.json');
        compile({ speciesDir, outPath });
        const out = JSON.parse(fs.readFileSync(outPath, 'utf8'));
        expect(out).toEqual({
          fauna: { freshwater: { items: [] }, saltwater: { items: [] }, brackish: { items: [] } },
          flora: { freshwater: { items: [] }, saltwater: { items: [] }, brackish: { items: [] } }
        });
      });
    });
  });

  test('groups fish entries under fauna.freshwater', () => {
    withTempDir(speciesDir => {
      writeSpeciesFile(speciesDir, 'fish', 'a', { id: 'fw-100', commonName: 'A', kind: 'fauna', taxon: 'fish', waterType: 'freshwater' });
      writeSpeciesFile(speciesDir, 'fish', 'b', { id: 'fw-101', commonName: 'B', kind: 'fauna', taxon: 'fish', waterType: 'freshwater' });
      withTempDir(distDir => {
        const outPath = path.join(distDir, 'species.json');
        compile({ speciesDir, outPath });
        const out = JSON.parse(fs.readFileSync(outPath, 'utf8'));
        expect(out.fauna.freshwater.items).toHaveLength(2);
        expect(out.fauna.saltwater.items).toHaveLength(0);
        expect(out.flora.freshwater.items).toHaveLength(0);
      });
    });
  });

  test('groups coral entries under fauna.saltwater', () => {
    withTempDir(speciesDir => {
      writeSpeciesFile(speciesDir, 'coral', 'c', { id: 'sw-coral-001', commonName: 'C', kind: 'fauna', taxon: 'coral', waterType: 'saltwater' });
      withTempDir(distDir => {
        const outPath = path.join(distDir, 'species.json');
        compile({ speciesDir, outPath });
        const out = JSON.parse(fs.readFileSync(outPath, 'utf8'));
        expect(out.fauna.saltwater.items).toHaveLength(1);
      });
    });
  });

  test('groups plant entries under flora.freshwater', () => {
    withTempDir(speciesDir => {
      writeSpeciesFile(speciesDir, 'plant', 'd', { id: 'fl-001', commonName: 'D', kind: 'flora', taxon: 'plant', waterType: 'freshwater' });
      withTempDir(distDir => {
        const outPath = path.join(distDir, 'species.json');
        compile({ speciesDir, outPath });
        const out = JSON.parse(fs.readFileSync(outPath, 'utf8'));
        expect(out.flora.freshwater.items).toHaveLength(1);
      });
    });
  });

  test('creates dist directory if missing', () => {
    withTempDir(speciesDir => {
      writeSpeciesFile(speciesDir, 'fish', 'e', { id: 'fw-200', commonName: 'E', kind: 'fauna', taxon: 'fish', waterType: 'freshwater' });
      withTempDir(parent => {
        const distDir = path.join(parent, 'doesnt', 'exist', 'yet');
        const outPath = path.join(distDir, 'species.json');
        compile({ speciesDir, outPath });
        expect(fs.existsSync(outPath)).toBe(true);
      });
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:
```bash
npm test -- --watchAll=false src/species-build/__tests__/compile.test.js
```
Expected: FAIL with "Cannot find module '../compile'".

- [ ] **Step 3: Implement `compile.js`**

Create `src/species-build/compile.js`:

```javascript
const fs = require('fs');
const path = require('path');
const { globSync } = require('glob');

function emptyOutput() {
  return {
    fauna: {
      freshwater: { items: [] },
      saltwater:  { items: [] },
      brackish:   { items: [] }
    },
    flora: {
      freshwater: { items: [] },
      saltwater:  { items: [] },
      brackish:   { items: [] }
    }
  };
}

function compile({ speciesDir, outPath }) {
  const out = emptyOutput();
  if (fs.existsSync(speciesDir)) {
    const files = globSync('**/*.json', { cwd: speciesDir, absolute: true });
    for (const filePath of files) {
      const entry = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      const { kind, waterType } = entry;
      if (!out[kind] || !out[kind][waterType]) {
        throw new Error(`Invalid kind/waterType combination in ${filePath}: ${kind}/${waterType}`);
      }
      out[kind][waterType].items.push(entry);
    }
  }
  // Stable ordering — sort by id within each bucket
  for (const k of Object.keys(out)) {
    for (const w of Object.keys(out[k])) {
      out[k][w].items.sort((a, b) => a.id.localeCompare(b.id));
    }
  }
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2) + '\n');
  return { totalItems: countItems(out) };
}

function countItems(out) {
  let n = 0;
  for (const k of Object.keys(out)) {
    for (const w of Object.keys(out[k])) {
      n += out[k][w].items.length;
    }
  }
  return n;
}

if (require.main === module) {
  const repoRoot = path.resolve(__dirname, '..', '..');
  const report = compile({
    speciesDir: path.join(repoRoot, 'src', 'species'),
    outPath: path.join(repoRoot, 'dist', 'species.json')
  });
  console.log(`Compiled ${report.totalItems} species entries into dist/species.json.`);
}

module.exports = { compile, emptyOutput };
```

- [ ] **Step 4: Run tests to verify they pass**

Run:
```bash
npm test -- --watchAll=false src/species-build/__tests__/compile.test.js
```
Expected: all 5 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/species-build/compile.js src/species-build/__tests__/
git commit -m "feat(build): add compile.js producing dist/species.json"
```

---

## Task 10: Write `review-field-gaps.js`

**Files:**
- Create: `src/species-build/review-field-gaps.js`
- Create: `src/species-build/__tests__/review-field-gaps.test.js`

Summarizer for the agent-emitted field-gap log. Groups by suggested field name, flags any field with 5+ suggestions as a promotion candidate.

- [ ] **Step 1: Write the failing test**

Create `src/species-build/__tests__/review-field-gaps.test.js`:

```javascript
const fs = require('fs');
const os = require('os');
const path = require('path');
const { summarize } = require('../review-field-gaps');

function withTempFile(lines, fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aquamate-gaps-'));
  const file = path.join(dir, 'field-gap-suggestions.jsonl');
  fs.writeFileSync(file, lines.map(l => JSON.stringify(l)).join('\n') + (lines.length ? '\n' : ''));
  try { return fn(file); } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}

describe('review-field-gaps', () => {
  test('returns empty summary for empty log', () => {
    withTempFile([], file => {
      const s = summarize(file);
      expect(s.groups).toEqual([]);
      expect(s.promotionCandidates).toEqual([]);
    });
  });

  test('groups suggestions by suggestedField with counts and species lists', () => {
    withTempFile([
      { species: 'fw-010', slug: 'a', suggestedField: 'plantEater', suggestedType: 'boolean', reason: 'eats plants', valueForThisSpecies: true },
      { species: 'fw-011', slug: 'b', suggestedField: 'plantEater', suggestedType: 'boolean', reason: 'destroys plants', valueForThisSpecies: true }
    ], file => {
      const s = summarize(file);
      expect(s.groups).toHaveLength(1);
      expect(s.groups[0].suggestedField).toBe('plantEater');
      expect(s.groups[0].count).toBe(2);
      expect(s.groups[0].species).toEqual(['fw-010', 'fw-011']);
    });
  });

  test('flags fields with 5+ suggestions as promotion candidates', () => {
    const five = Array.from({ length: 5 }, (_, i) => ({
      species: `fw-${100 + i}`,
      slug: `s${i}`,
      suggestedField: 'plantEater',
      suggestedType: 'boolean',
      reason: 'eats plants',
      valueForThisSpecies: true
    }));
    withTempFile(five, file => {
      const s = summarize(file);
      expect(s.promotionCandidates.map(g => g.suggestedField)).toContain('plantEater');
    });
  });

  test('does NOT flag fields with 4 suggestions as promotion candidates', () => {
    const four = Array.from({ length: 4 }, (_, i) => ({
      species: `fw-${200 + i}`,
      slug: `s${i}`,
      suggestedField: 'lessCommon',
      suggestedType: 'boolean',
      reason: 'rare',
      valueForThisSpecies: false
    }));
    withTempFile(four, file => {
      const s = summarize(file);
      expect(s.promotionCandidates).toEqual([]);
      expect(s.groups[0].count).toBe(4);
    });
  });

  test('skips malformed JSON lines but reports them', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aquamate-gaps-bad-'));
    const file = path.join(dir, 'log.jsonl');
    fs.writeFileSync(file, `${JSON.stringify({ species: 'x', slug: 'x', suggestedField: 'f', suggestedType: 'boolean', reason: 'r', valueForThisSpecies: 1 })}\nnot-json\n`);
    try {
      const s = summarize(file);
      expect(s.malformedLines).toBe(1);
      expect(s.groups).toHaveLength(1);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:
```bash
npm test -- --watchAll=false src/species-build/__tests__/review-field-gaps.test.js
```
Expected: FAIL with "Cannot find module '../review-field-gaps'".

- [ ] **Step 3: Implement `review-field-gaps.js`**

Create `src/species-build/review-field-gaps.js`:

```javascript
const fs = require('fs');
const path = require('path');

const PROMOTION_THRESHOLD = 5;

function summarize(logPath) {
  if (!fs.existsSync(logPath)) {
    return { groups: [], promotionCandidates: [], malformedLines: 0, totalSuggestions: 0 };
  }
  const raw = fs.readFileSync(logPath, 'utf8');
  const lines = raw.split('\n').filter(l => l.trim().length > 0);

  const byField = new Map();
  let malformedLines = 0;
  for (const line of lines) {
    let suggestion;
    try {
      suggestion = JSON.parse(line);
    } catch {
      malformedLines++;
      continue;
    }
    const field = suggestion.suggestedField;
    if (!field) {
      malformedLines++;
      continue;
    }
    if (!byField.has(field)) {
      byField.set(field, {
        suggestedField: field,
        count: 0,
        species: [],
        suggestedTypes: new Set(),
        reasons: []
      });
    }
    const group = byField.get(field);
    group.count++;
    group.species.push(suggestion.species);
    if (suggestion.suggestedType) group.suggestedTypes.add(suggestion.suggestedType);
    if (suggestion.reason) group.reasons.push(suggestion.reason);
  }

  const groups = [...byField.values()]
    .map(g => ({
      suggestedField: g.suggestedField,
      count: g.count,
      species: g.species,
      suggestedTypes: [...g.suggestedTypes],
      sampleReasons: g.reasons.slice(0, 3)
    }))
    .sort((a, b) => b.count - a.count);

  const promotionCandidates = groups.filter(g => g.count >= PROMOTION_THRESHOLD);

  return {
    groups,
    promotionCandidates,
    malformedLines,
    totalSuggestions: lines.length - malformedLines
  };
}

function formatSummary(s) {
  const lines = [];
  lines.push(`Field-gap suggestions: ${s.totalSuggestions} valid, ${s.malformedLines} malformed`);
  lines.push('');
  lines.push(`Promotion candidates (>= ${PROMOTION_THRESHOLD} suggestions):`);
  if (s.promotionCandidates.length === 0) {
    lines.push('  (none)');
  } else {
    for (const g of s.promotionCandidates) {
      lines.push(`  - ${g.suggestedField} [${g.suggestedTypes.join(', ') || '?'}]: ${g.count} species`);
      lines.push(`      species: ${g.species.join(', ')}`);
      for (const r of g.sampleReasons) lines.push(`      reason: ${r}`);
    }
  }
  lines.push('');
  lines.push('All groups (advisory):');
  if (s.groups.length === 0) {
    lines.push('  (none)');
  } else {
    for (const g of s.groups) {
      lines.push(`  - ${g.suggestedField}: ${g.count}`);
    }
  }
  return lines.join('\n');
}

if (require.main === module) {
  const repoRoot = path.resolve(__dirname, '..', '..');
  const logPath = path.join(repoRoot, 'src', 'species-build', 'field-gap-suggestions.jsonl');
  const summary = summarize(logPath);
  console.log(formatSummary(summary));
}

module.exports = { summarize, formatSummary, PROMOTION_THRESHOLD };
```

- [ ] **Step 4: Run tests to verify they pass**

Run:
```bash
npm test -- --watchAll=false src/species-build/__tests__/review-field-gaps.test.js
```
Expected: all 5 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/species-build/review-field-gaps.js src/species-build/__tests__/
git commit -m "feat(build): add review-field-gaps.js summarizer with 5+ promotion threshold"
```

---

## Task 11: Wire npm scripts and update `.gitignore`

**Files:**
- Modify: `package.json`
- Modify: `.gitignore`

- [ ] **Step 1: Add npm scripts**

Update the `"scripts"` block in `package.json` to:

```json
  "scripts": {
    "start": "react-scripts start",
    "predeploy": "npm run build",
    "deploy": "gh-pages -d build",
    "prebuild": "npm run validate && npm run compile-species",
    "build": "react-scripts build",
    "test": "react-scripts test",
    "eject": "react-scripts eject",
    "validate": "node src/species-build/validate.js",
    "compile-species": "node src/species-build/compile.js",
    "migrate-species": "node src/species-build/migrate-from-legacy.js",
    "review-field-gaps": "node src/species-build/review-field-gaps.js"
  },
```

Note: npm's lifecycle hook runs `prebuild` automatically before `build`, so `npm run build` → `prebuild` (validate + compile) → `react-scripts build`. And since `predeploy` is `npm run build`, `npm run deploy` → `predeploy` → `build` → `prebuild` → validate + compile. For Cloudflare Worker deploys (`wrangler deploy`), run `npm run validate && npm run compile-species` manually first — the worker imports `dist/species.json`, so it needs to exist before bundling.

- [ ] **Step 2: Add `dist/` to `.gitignore`**

Append to `.gitignore`:

```
# Build output for species data layer
/dist/
```

- [ ] **Step 3: Verify scripts wire correctly**

Run:
```bash
npm run validate
```
Expected: exits 0 with "No species files found." (species dir doesn't exist yet — migration hasn't run).

Run:
```bash
npm run compile-species
```
Expected: exits 0; creates `dist/species.json` with empty buckets.

Run:
```bash
npm run review-field-gaps
```
Expected: exits 0 with summary showing "0 valid, 0 malformed" and "(none)" promotion candidates.

- [ ] **Step 4: Commit**

```bash
git add package.json .gitignore
git commit -m "build: wire validate, compile-species, migrate-species, review-field-gaps npm scripts"
```

---

## Task 12: Run migration locally and commit placeholder species files

**Files:**
- Create: `src/species/<taxon>/<slug>.json` (~125 placeholder files generated by the migration script)

- [ ] **Step 1: Run migration**

Run:
```bash
npm run migrate-species
```
Expected: prints "Migrated N legacy entries to per-species files." (~125).

- [ ] **Step 2: Validate the generated files**

Run:
```bash
npm run validate
```
Expected: prints "✓ N species file(s) validated successfully." with no errors.

If validation fails: inspect the reported file paths and error messages, identify the issue (likely a taxon-inference edge case the migration script didn't handle), patch `migrate-from-legacy.js`, re-run from Step 1. Do not advance until validation passes clean.

- [ ] **Step 3: Compile**

Run:
```bash
npm run compile-species
```
Expected: prints "Compiled N species entries into dist/species.json."

- [ ] **Step 4: Spot-check a few generated files**

Run:
```bash
ls src/species/fish | head
ls src/species/plant
cat src/species/fish/neon-tetra.json | head -40
```
Expected: ~120 fish entries, 1 plant entry (Java Fern), structure matches the schema.

- [ ] **Step 5: Commit**

```bash
git add src/species/
git commit -m "data: migrate legacy fauna.json/flora.json to per-species placeholder files"
```

---

## Task 13: Update worker.js to consume `dist/species.json`

**Files:**
- Modify: `src/backend/worker.js`

The worker switches imports, paginates the new flat arrays on the fly, and reroutes R2 bucket selection by `item.kind`.

- [ ] **Step 1: Read current worker.js to confirm the lines to replace**

Run:
```bash
sed -n '1,30p' src/backend/worker.js
```
Expected: shows the current imports and `R2_DOMAINS`.

- [ ] **Step 2: Replace the import block, R2 helper, and handlers**

Open `src/backend/worker.js` and replace its full contents with:

```javascript
import speciesData from '../../dist/species.json' assert { type: 'json' };

const R2_DOMAINS = {
    fauna: 'https://pub-eaf7b96d5e4d42869407498cf5b931e0.r2.dev',
    flora: 'https://pub-40c047642c084c80857179b0032563e5.r2.dev',
};

const PAGE_SIZE = 8;

const CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
};

function handleOptions() {
    return new Response(null, { headers: CORS_HEADERS });
}

function jsonResponse(data, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
    });
}

function resolveImageUrl(item) {
    if (!item.media || !item.media.primaryImage) return '';
    const domain = R2_DOMAINS[item.kind] || R2_DOMAINS.fauna;
    const filename = item.media.primaryImage.startsWith('/')
        ? item.media.primaryImage.slice(1)
        : item.media.primaryImage;
    return `${domain}/${filename}`;
}

function withResolvedImage(item) {
    return { ...item, image_url: resolveImageUrl(item) };
}

function getFaunaCategory(category) {
    // category in URL = legacy water-type word for fauna (freshwater | saltwater | brackish)
    return speciesData.fauna[category];
}

function allItems() {
    return [
        ...speciesData.fauna.freshwater.items,
        ...speciesData.fauna.saltwater.items,
        ...speciesData.fauna.brackish.items,
        ...speciesData.flora.freshwater.items,
        ...speciesData.flora.saltwater.items,
        ...speciesData.flora.brackish.items,
    ];
}

async function handleRequest(request) {
    if (request.method === 'OPTIONS') return handleOptions();

    const url = new URL(request.url);
    const path = url.pathname;

    // GET /api/images/:category/:page — paginated fauna gallery
    if (path.startsWith('/api/images/') && request.method === 'GET') {
        const parts = path.split('/').filter(p => p);
        const category = parts[2] || 'freshwater';
        const requestedPage = parseInt(parts[3], 10) || 1;

        const bucket = getFaunaCategory(category);
        if (!bucket) {
            return jsonResponse({
                success: false,
                error: 'Category not found',
                available: Object.keys(speciesData.fauna),
            }, 404);
        }

        const items = bucket.items;
        const totalPages = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
        if (requestedPage < 1 || requestedPage > totalPages) {
            return jsonResponse({
                success: false,
                error: 'Page not found',
                totalPages,
            }, 404);
        }

        const start = (requestedPage - 1) * PAGE_SIZE;
        const slice = items.slice(start, start + PAGE_SIZE).map(withResolvedImage);

        return jsonResponse({
            success: true,
            category,
            page: requestedPage,
            totalPages,
            items: slice,
        });
    }

    // GET /api/search?q=<term> — search all species
    if (path === '/api/search' && request.method === 'GET') {
        const q = url.searchParams.get('q')?.trim().toLowerCase();
        if (!q) {
            return jsonResponse({ success: false, error: 'Missing query param: q' }, 400);
        }
        const matches = allItems()
            .filter(item =>
                item.commonName?.toLowerCase().includes(q) ||
                item.scientificName?.toLowerCase().includes(q)
            )
            .map(withResolvedImage);
        return jsonResponse({ success: true, query: q, results: matches });
    }

    // GET /api/categories — return fauna water-type buckets
    if (path === '/api/categories' && request.method === 'GET') {
        const categories = Object.keys(speciesData.fauna).map(cat => ({
            name: cat,
            count: speciesData.fauna[cat].items.length,
        }));
        return jsonResponse({ success: true, categories });
    }

    if (path === '/health' && request.method === 'GET') {
        return jsonResponse({ status: 'ok', timestamp: new Date().toISOString() });
    }

    return jsonResponse({
        error: 'Not Found',
        availableEndpoints: [
            '/health',
            '/api/categories',
            '/api/images/:category/:page',
            '/api/search?q=<term>',
        ],
    }, 404);
}

export default {
    async fetch(request) {
        return handleRequest(request);
    },
};
```

- [ ] **Step 3: Verify the worker bundles cleanly with wrangler**

Run:
```bash
npx wrangler deploy --dry-run --outdir=.wrangler/dry-run
```
Expected: succeeds, no syntax errors, reports bundle size.

If `wrangler` reports missing config or it can't find `dist/species.json`: run `npm run compile-species` first (it produces the file the worker imports). Then re-run the dry-run.

- [ ] **Step 4: Commit**

```bash
git add src/backend/worker.js
git commit -m "feat(worker): consume dist/species.json with on-the-fly pagination"
```

---

## Task 14: Delete legacy `src/fauna.json` and `src/flora.json`

**Files:**
- Delete: `src/fauna.json`
- Delete: `src/flora.json`

- [ ] **Step 1: Verify the worker no longer imports them**

Run:
```bash
grep -n "fauna.json\|flora.json" src/backend/worker.js
```
Expected: no matches.

Run:
```bash
grep -rn "fauna.json\|flora.json" src/ --include="*.js" --include="*.json" | grep -v __tests__ | grep -v species-build
```
Expected: no matches outside test fixtures and the migration script.

- [ ] **Step 2: Delete the files**

Run:
```bash
git rm src/fauna.json src/flora.json
```

- [ ] **Step 3: Validate everything still works**

Run:
```bash
npm run validate && npm run compile-species
```
Expected: both succeed; `dist/species.json` regenerated.

Run:
```bash
npx wrangler deploy --dry-run --outdir=.wrangler/dry-run
```
Expected: succeeds.

- [ ] **Step 4: Commit**

```bash
git commit -m "data: remove legacy fauna.json and flora.json (replaced by src/species/)"
```

---

## Task 15: Smoke verify locally

**Files:** (no changes)

This is a sanity gate before considering the foundation done. Runs the full local pipeline and exercises the worker against expected endpoints.

- [ ] **Step 1: Full validate + compile**

Run:
```bash
npm run validate && npm run compile-species
```
Expected: both succeed with non-zero species counts.

- [ ] **Step 2: Run the full Jest suite**

Run:
```bash
npm test -- --watchAll=false
```
Expected: all tests PASS across `src/species-schema/__tests__/` and `src/species-build/__tests__/`.

- [ ] **Step 3: Start wrangler dev and hit endpoints**

Run in one terminal:
```bash
npx wrangler dev src/backend/worker.js --local --port 8787
```

In another terminal, hit endpoints:

```bash
curl -s http://localhost:8787/health | head
```
Expected: `{"status":"ok","timestamp":"…"}`.

```bash
curl -s http://localhost:8787/api/images/freshwater/1 | head -c 400
```
Expected: JSON with `success: true`, `page: 1`, `totalPages: N`, `items: [...]` (8 entries with `image_url` resolved to R2 URLs).

```bash
curl -s "http://localhost:8787/api/search?q=neon" | head -c 400
```
Expected: JSON with `success: true`, `results` array containing the migrated Neon Tetra entry.

```bash
curl -s http://localhost:8787/api/categories | head
```
Expected: JSON with `categories: [{name: "freshwater", count: ...}, …]`.

Stop wrangler with Ctrl+C.

- [ ] **Step 4: Confirm prebuild gate works**

Run:
```bash
npm run predeploy
```
Expected: validate + compile + react-scripts build all run cleanly and exit 0.

- [ ] **Step 5: Final commit (if any leftover state)**

If everything is clean and nothing was modified, no commit needed. Otherwise:

```bash
git status
git diff
```

If files changed, commit them with an appropriate message. Otherwise, the foundation is verified.

- [ ] **Step 6: Tag the foundation milestone (optional, recommended)**

```bash
git tag -a species-foundation-v1 -m "Species data foundation: schema, validators, build pipeline, migrated placeholders, worker cutover"
```

---

## Done — what this plan produced

After completing all 15 tasks:

- A closed, validated JSON Schema with 8 taxa, 2 kinds, 3 water types, and conditional rules.
- Per-species placeholder JSON files in `src/species/<taxon>/<slug>.json` for every legacy entry.
- A `validate.js` enforcing both JSON Schema rules and the min<=max cross-field rule.
- A `compile.js` producing a single `dist/species.json` artifact the worker imports.
- A `migrate-from-legacy.js` for one-shot legacy conversion (preserved in case migration needs replaying).
- A `review-field-gaps.js` summarizer ready for the field-gap log that future research agents will produce.
- An updated worker serving the same external API contract from the new pipeline.
- `npm run validate`, `npm run compile-species`, `npm run migrate-species`, `npm run review-field-gaps`, and a `predeploy` hook wiring validate+compile into the deploy path.

**Next plan (separate, deferred):** Stage A discovery agent orchestration, Stage B user-review workflow, Stage C per-species research agent orchestration. Those involve dispatching parallel agents with curated prompts and don't fit the TDD/test-first plan shape — they're best captured in a separate plan against the `superpowers:dispatching-parallel-agents` skill once this foundation lands.
