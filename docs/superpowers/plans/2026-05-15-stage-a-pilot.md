# Stage A Discovery Pilot Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement Tasks 1–5 task-by-task. Tasks 6–7 are controller-level (executed by the dispatching agent, not by per-task subagents). Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Validate the Stage A discovery agent playbook against 3 pilot slices (fish-freshwater, coral-saltwater, plant-freshwater) and emit popularity-sorted manifests for Stage B human review.

**Architecture:** Controller-driven dispatch + agent-executed playbook. The controller (the agent dispatching this plan) pre-computes per-slice dedup lists from `src/species/`, instantiates the playbook template with slice metadata, and dispatches 3 agents in parallel via `superpowers:dispatching-parallel-agents`. Each agent fetches its primary source's species index, cross-checks against secondary sources, scores popularity via Wikipedia, and emits a `{meta, entries}` JSON manifest plus a per-slice `-other.json` bucket for taxon misfits. After agents complete, the controller runs `npm run validate-discovery`, spot-checks results, and commits.

**Tech Stack:** Ajv 8 + ajv-formats (manifest validation), Node.js (helper scripts), Jest via react-scripts (tests), Wikimedia REST API (pageviews), Aquarium Co-Op / World Wide Corals / Buce Plant (pilot primary sources).

**Background:** Implements Stage A of [docs/superpowers/specs/2026-05-13-species-data-redesign-design.md](../specs/2026-05-13-species-data-redesign-design.md), Section 6, scoped to a 3-slice pilot. Brainstorm decisions (2026-05-15) added: pilot scope (3 slices first), controller-precomputed dedup list, manifest schema + `npm run validate-discovery`, manifest metadata header, domain-root source URLs (agent navigates from root).

---

## Pilot Scope

3 of 11 total Stage A slices:

| Slice key | Taxon | WaterType | Primary source name | Primary source root | Secondary sources |
|---|---|---|---|---|---|
| `fish-freshwater` | `fish` | `freshwater` | Aquarium Co-Op | `https://www.aquariumcoop.com/` | SeriouslyFish, FishBase, Practical Fishkeeping |
| `coral-saltwater` | `coral` | `saltwater` | World Wide Corals | `https://www.worldwidecorals.com/` | Reef2Reef wiki, Bulk Reef Supply, LiveAquaria |
| `plant-freshwater` | `plant` | `freshwater` | Buce Plant | `https://buceplant.com/` | Tropica, 2HR Aquarist, AquariumPlants.com |

Why these three: distinct primary sources (3 different domains), both kinds (fauna + flora), and three different taxa. If the playbook works on all three, the remaining 8 slices are mostly the same pattern with different source URLs.

After successful pilot, the remaining 8 slices (fish-sw, crus-fw, crus-sw, moll-fw, moll-sw, echi-sw, plant-sw, algae-sw) will be dispatched via the same playbook in a separate run — no plan changes expected unless the pilot surfaces issues.

---

## File Map

| Path | Action | Responsibility |
|---|---|---|
| `src/species-schema/manifest.schema.json` | Create | JSON Schema 2020-12 for discovery manifests; closed; references `enums.json` for `taxa`/`waterTypes` |
| `src/species-schema/__tests__/manifest-schema.test.js` | Create | Validates the manifest schema accepts good / rejects bad payloads |
| `src/species-schema/__tests__/fixtures/valid-manifest.json` | Create | Reusable valid manifest fixture |
| `src/species-build/source-urls.json` | Create | Domain roots + secondary sources per slice (all 11; pilot uses 3) |
| `src/species-build/build-dedup-list.js` | Create | Pure function: scans `src/species/`, returns dedup tuples filtered by `kind`+`waterType` |
| `src/species-build/__tests__/build-dedup-list.test.js` | Create | Unit tests for dedup helper |
| `src/species-build/validate-discovery.js` | Create | Ajv validator that iterates `src/species-build/discovery/*.json`, exits non-zero on failure |
| `src/species-build/__tests__/validate-discovery.test.js` | Create | Unit tests for the validator's pass/fail behavior |
| `docs/superpowers/playbooks/stage-a-discovery-agent.md` | Create | Templated agent prompt with `$VAR` placeholders the controller substitutes per slice |
| `package.json` | Modify | Add `validate-discovery` script |
| `src/species-build/discovery/fish-freshwater.json` | Create via agent | Pilot manifest (confident-fit entries) |
| `src/species-build/discovery/fish-freshwater-other.json` | Create via agent | Per-slice taxon-mismatch bucket |
| `src/species-build/discovery/coral-saltwater.json` | Create via agent | Pilot manifest |
| `src/species-build/discovery/coral-saltwater-other.json` | Create via agent | Per-slice taxon-mismatch bucket |
| `src/species-build/discovery/plant-freshwater.json` | Create via agent | Pilot manifest |
| `src/species-build/discovery/plant-freshwater-other.json` | Create via agent | Per-slice taxon-mismatch bucket |

---

## Popularity Score Formula

The agent computes `popularityScore` (0–10) for each surviving candidate. This formula is normative — agents must implement it exactly so manifests are comparable across slices.

```
function popularityScore(wikipediaPageviewsMonthly, wikipediaUrl, sourceCoverageCount) {
  if (wikipediaUrl === null) return 0;
  const pv = Math.max(1, wikipediaPageviewsMonthly);
  const pageviewsPoints = Math.min(5, Math.floor(Math.log10(pv))); // 0 for <10, 1 for 10–99, …, 5 for 100k+
  const sourcePoints   = Math.min(5, sourceCoverageCount);
  return Math.max(0, Math.min(10, pageviewsPoints + sourcePoints));
}
```

Examples:
- 18,400 pageviews + 4 sources → `4 + 4 = 8`
- 420 pageviews + 2 sources → `2 + 2 = 4`
- No Wikipedia article + 2 sources → `0`

Spec's example numbers (Section 6, Stage A) are illustrative; this formula is the actual contract.

---

## Phase 1: Infrastructure (subagent-driven-development eligible)

### Task 1: Manifest schema + tests

**Files:**
- Create: `src/species-schema/manifest.schema.json`
- Create: `src/species-schema/__tests__/manifest-schema.test.js`
- Create: `src/species-schema/__tests__/fixtures/valid-manifest.json`

- [ ] **Step 1: Write the valid-manifest fixture**

Create `src/species-schema/__tests__/fixtures/valid-manifest.json`:

```json
{
  "meta": {
    "discoveryDate": "2026-05-15",
    "taxon": "fish",
    "waterType": "freshwater",
    "primarySource": {
      "name": "Aquarium Co-Op",
      "indexUrl": "https://www.aquariumcoop.com/blogs/aquarium/tagged/care-guide"
    },
    "secondarySources": [
      { "name": "SeriouslyFish", "url": "https://www.seriouslyfish.com/" },
      { "name": "FishBase", "url": "https://www.fishbase.se/" }
    ],
    "dedupListSize": 142,
    "candidateCount": 2
  },
  "entries": [
    {
      "commonName": "Neon Tetra",
      "scientificName": "Paracheirodon innesi",
      "popularityScore": 8,
      "wikipediaUrl": "https://en.wikipedia.org/wiki/Neon_tetra",
      "wikipediaPageviewsMonthly": 18400,
      "wikipediaArticleSizeBytes": 24500,
      "sourceCoverageCount": 4,
      "primarySourceUrl": "https://www.aquariumcoop.com/blogs/aquarium/neon-tetra-care-guide",
      "secondarySourceUrl": "https://www.seriouslyfish.com/species/paracheirodon-innesi/",
      "taxonFitConfidence": "high",
      "notes": null
    },
    {
      "commonName": "Obscure Variant X",
      "scientificName": null,
      "popularityScore": 0,
      "wikipediaUrl": null,
      "wikipediaPageviewsMonthly": 0,
      "wikipediaArticleSizeBytes": null,
      "sourceCoverageCount": 2,
      "primarySourceUrl": "https://www.aquariumcoop.com/blogs/aquarium/obscure-variant-x",
      "secondarySourceUrl": "https://www.seriouslyfish.com/species/obscure-variant-x/",
      "taxonFitConfidence": "low",
      "notes": "Possibly misclassified; surfaced from fish index but morphologically closer to other-invert."
    }
  ]
}
```

- [ ] **Step 2: Write the failing schema test**

Create `src/species-schema/__tests__/manifest-schema.test.js`:

```javascript
const fs = require('fs');
const path = require('path');
const Ajv = require('ajv/dist/2020');
const addFormats = require('ajv-formats');

const schemaPath = path.resolve(__dirname, '..', 'manifest.schema.json');
const enumsPath  = path.resolve(__dirname, '..', 'enums.json');
const validFixturePath = path.resolve(__dirname, 'fixtures', 'valid-manifest.json');

function makeValidator() {
  const ajv = new Ajv({ allErrors: true, strict: true });
  addFormats(ajv);
  const enums = JSON.parse(fs.readFileSync(enumsPath, 'utf8'));
  ajv.addSchema(enums, 'enums.json');
  const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
  return ajv.compile(schema);
}

function loadValid() {
  return JSON.parse(JSON.stringify(JSON.parse(fs.readFileSync(validFixturePath, 'utf8'))));
}

describe('manifest.schema.json', () => {
  test('accepts the valid fixture', () => {
    const validate = makeValidator();
    const ok = validate(loadValid());
    expect(validate.errors).toBeNull();
    expect(ok).toBe(true);
  });

  test('rejects when meta is missing', () => {
    const validate = makeValidator();
    const m = loadValid();
    delete m.meta;
    expect(validate(m)).toBe(false);
  });

  test('rejects unknown top-level properties', () => {
    const validate = makeValidator();
    const m = loadValid();
    m.surpriseField = 'oops';
    expect(validate(m)).toBe(false);
  });

  test('rejects taxon outside the enum', () => {
    const validate = makeValidator();
    const m = loadValid();
    m.meta.taxon = 'dragon';
    expect(validate(m)).toBe(false);
  });

  test('rejects entries with popularityScore > 10', () => {
    const validate = makeValidator();
    const m = loadValid();
    m.entries[0].popularityScore = 11;
    expect(validate(m)).toBe(false);
  });

  test('rejects entries with negative popularityScore', () => {
    const validate = makeValidator();
    const m = loadValid();
    m.entries[0].popularityScore = -1;
    expect(validate(m)).toBe(false);
  });

  test('rejects entries with taxonFitConfidence outside enum', () => {
    const validate = makeValidator();
    const m = loadValid();
    m.entries[0].taxonFitConfidence = 'super-high';
    expect(validate(m)).toBe(false);
  });

  test('accepts entries with null scientificName (some candidates lack one)', () => {
    const validate = makeValidator();
    const m = loadValid();
    m.entries[0].scientificName = null;
    expect(validate(m)).toBe(true);
  });

  test('rejects entries missing primarySourceUrl', () => {
    const validate = makeValidator();
    const m = loadValid();
    delete m.entries[0].primarySourceUrl;
    expect(validate(m)).toBe(false);
  });

  test('rejects entries with non-URI primarySourceUrl', () => {
    const validate = makeValidator();
    const m = loadValid();
    m.entries[0].primarySourceUrl = 'not a url';
    expect(validate(m)).toBe(false);
  });
});
```

- [ ] **Step 3: Run the test to confirm it fails**

Run: `npx jest src/species-schema/__tests__/manifest-schema.test.js`
Expected: FAIL with "Cannot find module" or "ENOENT" on `manifest.schema.json` (the schema file doesn't exist yet).

- [ ] **Step 4: Write the manifest schema**

Create `src/species-schema/manifest.schema.json`:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "manifest.schema.json",
  "title": "Stage A discovery manifest",
  "type": "object",
  "additionalProperties": false,
  "required": ["meta", "entries"],
  "properties": {
    "meta": {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "discoveryDate",
        "taxon",
        "waterType",
        "primarySource",
        "secondarySources",
        "dedupListSize",
        "candidateCount"
      ],
      "properties": {
        "discoveryDate": { "type": "string", "format": "date" },
        "taxon":         { "type": "string", "enum": ["fish", "crustacean", "coral", "mollusc", "echinoderm", "other-invert", "plant", "macroalgae"] },
        "waterType":     { "type": "string", "enum": ["freshwater", "saltwater", "brackish"] },
        "primarySource": {
          "type": "object",
          "additionalProperties": false,
          "required": ["name", "indexUrl"],
          "properties": {
            "name":     { "type": "string", "minLength": 1 },
            "indexUrl": { "type": "string", "format": "uri" }
          }
        },
        "secondarySources": {
          "type": "array",
          "items": {
            "type": "object",
            "additionalProperties": false,
            "required": ["name", "url"],
            "properties": {
              "name": { "type": "string", "minLength": 1 },
              "url":  { "type": "string", "format": "uri" }
            }
          }
        },
        "dedupListSize":  { "type": "integer", "minimum": 0 },
        "candidateCount": { "type": "integer", "minimum": 0 }
      }
    },
    "entries": {
      "type": "array",
      "items": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "commonName",
          "scientificName",
          "popularityScore",
          "wikipediaUrl",
          "wikipediaPageviewsMonthly",
          "wikipediaArticleSizeBytes",
          "sourceCoverageCount",
          "primarySourceUrl",
          "secondarySourceUrl",
          "taxonFitConfidence",
          "notes"
        ],
        "properties": {
          "commonName":                { "type": "string", "minLength": 1 },
          "scientificName":            { "type": ["string", "null"], "minLength": 1 },
          "popularityScore":           { "type": "integer", "minimum": 0, "maximum": 10 },
          "wikipediaUrl":              { "type": ["string", "null"], "format": "uri" },
          "wikipediaPageviewsMonthly": { "type": "integer", "minimum": 0 },
          "wikipediaArticleSizeBytes": { "type": ["integer", "null"], "minimum": 0 },
          "sourceCoverageCount":       { "type": "integer", "minimum": 1, "maximum": 10 },
          "primarySourceUrl":          { "type": "string", "format": "uri" },
          "secondarySourceUrl":        { "type": "string", "format": "uri" },
          "taxonFitConfidence":        { "type": "string", "enum": ["high", "medium", "low"] },
          "notes":                     { "type": ["string", "null"] }
        }
      }
    }
  }
}
```

Notes:
- Schema embeds the `taxon` and `waterType` enums inline rather than `$ref`-ing `enums.json` because Ajv `addSchema` registration for cross-file refs would require additional plumbing not currently in the test. The enum values are duplicated but match `enums.json`. (If they ever drift, the existing species schema's references will catch it.)
- Every entry field is `required`. Nullable fields use `"type": ["x", "null"]`. This forces agents to emit complete entries, not partial ones, so Stage B reviewers see a uniform shape.
- `scientificName` is nullable because some hobby names lack a published scientific name in source material.

- [ ] **Step 5: Run the test to confirm it passes**

Run: `npx jest src/species-schema/__tests__/manifest-schema.test.js`
Expected: PASS, 10 tests.

- [ ] **Step 6: Commit**

```bash
git add src/species-schema/manifest.schema.json src/species-schema/__tests__/manifest-schema.test.js src/species-schema/__tests__/fixtures/valid-manifest.json
git commit -m "feat(species-schema): add manifest schema for Stage A discovery"
```

---

### Task 2: Source-URLs table

**Files:**
- Create: `src/species-build/source-urls.json`

- [ ] **Step 1: Write the source-urls table**

Create `src/species-build/source-urls.json`:

```json
{
  "$comment": "Per-slice primary source root + secondary sources. Agent navigates from primaryRoot to find the species index; secondaries are checked first-to-last for cross-source verification (Stage A playbook, step 3).",
  "slices": {
    "fish-freshwater": {
      "taxon": "fish",
      "waterType": "freshwater",
      "primary": { "name": "Aquarium Co-Op", "root": "https://www.aquariumcoop.com/" },
      "secondaries": [
        { "name": "SeriouslyFish",         "root": "https://www.seriouslyfish.com/" },
        { "name": "FishBase",              "root": "https://www.fishbase.se/" },
        { "name": "Practical Fishkeeping", "root": "https://www.practicalfishkeeping.co.uk/" }
      ]
    },
    "fish-saltwater": {
      "taxon": "fish",
      "waterType": "saltwater",
      "primary": { "name": "LiveAquaria", "root": "https://www.liveaquaria.com/" },
      "secondaries": [
        { "name": "Reef2Reef wiki",   "root": "https://www.reef2reef.com/wiki/" },
        { "name": "FishBase",         "root": "https://www.fishbase.se/" },
        { "name": "BlueZoo Aquatics", "root": "https://www.bluezooaquatics.com/" }
      ]
    },
    "crustacean-freshwater": {
      "taxon": "crustacean",
      "waterType": "freshwater",
      "primary": { "name": "Aquarium Co-Op", "root": "https://www.aquariumcoop.com/" },
      "secondaries": [
        { "name": "The Shrimp Farm",       "root": "https://www.theshrimpfarm.com/" },
        { "name": "Flip Aquatics",         "root": "https://flipaquatics.com/" },
        { "name": "Practical Fishkeeping", "root": "https://www.practicalfishkeeping.co.uk/" }
      ]
    },
    "crustacean-saltwater": {
      "taxon": "crustacean",
      "waterType": "saltwater",
      "primary": { "name": "LiveAquaria", "root": "https://www.liveaquaria.com/" },
      "secondaries": [
        { "name": "Reef2Reef wiki",   "root": "https://www.reef2reef.com/wiki/" },
        { "name": "BlueZoo Aquatics", "root": "https://www.bluezooaquatics.com/" }
      ]
    },
    "coral-saltwater": {
      "taxon": "coral",
      "waterType": "saltwater",
      "primary": { "name": "World Wide Corals", "root": "https://www.worldwidecorals.com/" },
      "secondaries": [
        { "name": "Reef2Reef wiki",    "root": "https://www.reef2reef.com/wiki/" },
        { "name": "Bulk Reef Supply",  "root": "https://www.bulkreefsupply.com/" },
        { "name": "LiveAquaria",       "root": "https://www.liveaquaria.com/" }
      ]
    },
    "mollusc-freshwater": {
      "taxon": "mollusc",
      "waterType": "freshwater",
      "primary": { "name": "Aquarium Co-Op", "root": "https://www.aquariumcoop.com/" },
      "secondaries": [
        { "name": "The Shrimp Farm",       "root": "https://www.theshrimpfarm.com/" },
        { "name": "Practical Fishkeeping", "root": "https://www.practicalfishkeeping.co.uk/" }
      ]
    },
    "mollusc-saltwater": {
      "taxon": "mollusc",
      "waterType": "saltwater",
      "primary": { "name": "LiveAquaria", "root": "https://www.liveaquaria.com/" },
      "secondaries": [
        { "name": "Reef2Reef wiki", "root": "https://www.reef2reef.com/wiki/" }
      ]
    },
    "echinoderm-saltwater": {
      "taxon": "echinoderm",
      "waterType": "saltwater",
      "primary": { "name": "LiveAquaria", "root": "https://www.liveaquaria.com/" },
      "secondaries": [
        { "name": "Reef2Reef wiki",   "root": "https://www.reef2reef.com/wiki/" },
        { "name": "Bulk Reef Supply", "root": "https://www.bulkreefsupply.com/" }
      ]
    },
    "plant-freshwater": {
      "taxon": "plant",
      "waterType": "freshwater",
      "primary": { "name": "Buce Plant", "root": "https://buceplant.com/" },
      "secondaries": [
        { "name": "Tropica",            "root": "https://tropica.com/" },
        { "name": "2HR Aquarist",       "root": "https://www.2hraquarist.com/" },
        { "name": "AquariumPlants.com", "root": "https://www.aquariumplants.com/" }
      ]
    },
    "plant-saltwater": {
      "taxon": "plant",
      "waterType": "saltwater",
      "primary": { "name": "AlgaeBase", "root": "https://www.algaebase.org/" },
      "secondaries": [
        { "name": "Reef2Reef macroalgae wiki", "root": "https://www.reef2reef.com/wiki/" },
        { "name": "ReefCleaners",              "root": "https://www.reefcleaners.org/" }
      ]
    },
    "algae-saltwater": {
      "taxon": "macroalgae",
      "waterType": "saltwater",
      "primary": { "name": "AlgaeBase", "root": "https://www.algaebase.org/" },
      "secondaries": [
        { "name": "ReefCleaners",     "root": "https://www.reefcleaners.org/" },
        { "name": "Bulk Reef Supply", "root": "https://www.bulkreefsupply.com/" },
        { "name": "Reef2Reef wiki",   "root": "https://www.reef2reef.com/wiki/" }
      ]
    }
  }
}
```

All 11 slices listed for completeness; Task 6 only uses 3 (fish-freshwater, coral-saltwater, plant-freshwater). The remaining 8 are ready for the post-pilot dispatch with no further edits.

- [ ] **Step 2: Commit**

```bash
git add src/species-build/source-urls.json
git commit -m "data(species-build): add per-slice source URL table for Stage A discovery"
```

---

### Task 3: Dedup-list helper + tests

**Files:**
- Create: `src/species-build/build-dedup-list.js`
- Create: `src/species-build/__tests__/build-dedup-list.test.js`

The helper scans `src/species/**/*.json`, filters by `(kind, waterType)`, and returns a deduplicated list of name tuples. The controller calls this once per slice before dispatching the agent.

- [ ] **Step 1: Write the failing test**

Create `src/species-build/__tests__/build-dedup-list.test.js`:

```javascript
const fs = require('fs');
const os = require('os');
const path = require('path');
const { buildDedupList, normalizeCommonName } = require('../build-dedup-list');

function withTempDir(fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aquamate-dedup-'));
  try { return fn(dir); } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}

function writeSpecies(speciesDir, taxon, slug, payload) {
  const taxonDir = path.join(speciesDir, taxon);
  fs.mkdirSync(taxonDir, { recursive: true });
  fs.writeFileSync(path.join(taxonDir, `${slug}.json`), JSON.stringify(payload, null, 2));
}

describe('build-dedup-list', () => {
  test('normalizeCommonName lowercases, trims, and collapses whitespace', () => {
    expect(normalizeCommonName('  Neon  Tetra ')).toBe('neon tetra');
    expect(normalizeCommonName('Cherry-Shrimp')).toBe('cherry-shrimp');
    expect(normalizeCommonName("Betta splendens")).toBe('betta splendens');
  });

  test('returns empty list when no species match the slice', () => {
    withTempDir(speciesDir => {
      const out = buildDedupList({ speciesDir, kind: 'fauna', waterType: 'freshwater' });
      expect(out).toEqual([]);
    });
  });

  test('returns entries whose kind+waterType match the slice', () => {
    withTempDir(speciesDir => {
      writeSpecies(speciesDir, 'fish', 'neon-tetra', {
        commonName: 'Neon Tetra', scientificName: 'Paracheirodon innesi',
        kind: 'fauna', waterType: 'freshwater'
      });
      writeSpecies(speciesDir, 'fish', 'clownfish', {
        commonName: 'Clownfish', scientificName: 'Amphiprion ocellaris',
        kind: 'fauna', waterType: 'saltwater'
      });
      writeSpecies(speciesDir, 'plant', 'java-fern', {
        commonName: 'Java Fern', scientificName: 'Microsorum pteropus',
        kind: 'flora', waterType: 'freshwater'
      });
      const out = buildDedupList({ speciesDir, kind: 'fauna', waterType: 'freshwater' });
      expect(out).toEqual([
        { scientificName: 'Paracheirodon innesi', commonNameNormalized: 'neon tetra' }
      ]);
    });
  });

  test('filters across all taxon folders, not just one', () => {
    withTempDir(speciesDir => {
      writeSpecies(speciesDir, 'fish',       'a', { commonName: 'A', scientificName: 'Genus a', kind: 'fauna', waterType: 'freshwater' });
      writeSpecies(speciesDir, 'crustacean', 'b', { commonName: 'B', scientificName: 'Genus b', kind: 'fauna', waterType: 'freshwater' });
      writeSpecies(speciesDir, 'mollusc',    'c', { commonName: 'C', scientificName: 'Genus c', kind: 'fauna', waterType: 'freshwater' });
      const out = buildDedupList({ speciesDir, kind: 'fauna', waterType: 'freshwater' });
      expect(out).toHaveLength(3);
    });
  });

  test('emits scientificName: null when species lacks one', () => {
    withTempDir(speciesDir => {
      writeSpecies(speciesDir, 'fish', 'mystery', {
        commonName: 'Mystery Fish', scientificName: null,
        kind: 'fauna', waterType: 'freshwater'
      });
      const out = buildDedupList({ speciesDir, kind: 'fauna', waterType: 'freshwater' });
      expect(out).toEqual([
        { scientificName: null, commonNameNormalized: 'mystery fish' }
      ]);
    });
  });

  test('emits scientificName: null when species omits the field entirely', () => {
    withTempDir(speciesDir => {
      writeSpecies(speciesDir, 'fish', 'mystery', {
        commonName: 'Mystery Fish',
        kind: 'fauna', waterType: 'freshwater'
      });
      const out = buildDedupList({ speciesDir, kind: 'fauna', waterType: 'freshwater' });
      expect(out).toEqual([
        { scientificName: null, commonNameNormalized: 'mystery fish' }
      ]);
    });
  });

  test('deduplicates identical (scientificName, normalizedCommonName) tuples', () => {
    withTempDir(speciesDir => {
      writeSpecies(speciesDir, 'fish', 'neon-1', {
        commonName: 'Neon Tetra', scientificName: 'Paracheirodon innesi',
        kind: 'fauna', waterType: 'freshwater'
      });
      writeSpecies(speciesDir, 'fish', 'neon-2', {
        commonName: 'NEON tetra', scientificName: 'Paracheirodon innesi',
        kind: 'fauna', waterType: 'freshwater'
      });
      const out = buildDedupList({ speciesDir, kind: 'fauna', waterType: 'freshwater' });
      expect(out).toHaveLength(1);
    });
  });

  test('sorts output by scientificName then commonNameNormalized for stable diffs', () => {
    withTempDir(speciesDir => {
      writeSpecies(speciesDir, 'fish', 'b', { commonName: 'B', scientificName: 'Genus b', kind: 'fauna', waterType: 'freshwater' });
      writeSpecies(speciesDir, 'fish', 'a', { commonName: 'A', scientificName: 'Genus a', kind: 'fauna', waterType: 'freshwater' });
      const out = buildDedupList({ speciesDir, kind: 'fauna', waterType: 'freshwater' });
      expect(out[0].scientificName).toBe('Genus a');
      expect(out[1].scientificName).toBe('Genus b');
    });
  });
});
```

- [ ] **Step 2: Run test to confirm it fails**

Run: `npx jest src/species-build/__tests__/build-dedup-list.test.js`
Expected: FAIL with "Cannot find module '../build-dedup-list'".

- [ ] **Step 3: Implement the helper**

Create `src/species-build/build-dedup-list.js`:

```javascript
const fs = require('fs');
const path = require('path');

function normalizeCommonName(name) {
  return String(name).trim().toLowerCase().replace(/\s+/g, ' ');
}

function readJsonFilesRecursive(dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...readJsonFilesRecursive(full));
    } else if (entry.isFile() && entry.name.endsWith('.json')) {
      out.push(full);
    }
  }
  return out;
}

function buildDedupList({ speciesDir, kind, waterType }) {
  const files = readJsonFilesRecursive(speciesDir);
  const seen = new Set();
  const out = [];
  for (const file of files) {
    let species;
    try {
      species = JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch (err) {
      throw new Error(`Failed to parse ${file}: ${err.message}`);
    }
    if (species.kind !== kind || species.waterType !== waterType) continue;
    const scientificName = species.scientificName == null || species.scientificName === ''
      ? null
      : species.scientificName;
    const commonNameNormalized = normalizeCommonName(species.commonName);
    const key = `${scientificName ?? '<none>'}|${commonNameNormalized}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ scientificName, commonNameNormalized });
  }
  out.sort((a, b) => {
    const sa = a.scientificName ?? '';
    const sb = b.scientificName ?? '';
    if (sa !== sb) return sa < sb ? -1 : 1;
    return a.commonNameNormalized < b.commonNameNormalized ? -1 : a.commonNameNormalized > b.commonNameNormalized ? 1 : 0;
  });
  return out;
}

module.exports = { buildDedupList, normalizeCommonName };
```

- [ ] **Step 4: Run test to confirm it passes**

Run: `npx jest src/species-build/__tests__/build-dedup-list.test.js`
Expected: PASS, 8 tests.

- [ ] **Step 5: Sanity-check against real data**

Run a quick smoke check that the helper works against the actual `src/species/` tree:

```bash
node -e "
  const { buildDedupList } = require('./src/species-build/build-dedup-list');
  const out = buildDedupList({ speciesDir: 'src/species', kind: 'fauna', waterType: 'freshwater' });
  console.log('freshwater fauna entries:', out.length);
  console.log('first 3:', out.slice(0, 3));
"
```

Expected output: a count (likely ~145 freshwater fauna entries) and three sample tuples with `scientificName` (sometimes null) + `commonNameNormalized`. If the count is 0 or the helper throws, investigate before continuing.

- [ ] **Step 6: Commit**

```bash
git add src/species-build/build-dedup-list.js src/species-build/__tests__/build-dedup-list.test.js
git commit -m "feat(species-build): add dedup-list helper for Stage A discovery"
```

---

### Task 4: Manifest validator + npm script

**Files:**
- Create: `src/species-build/validate-discovery.js`
- Create: `src/species-build/__tests__/validate-discovery.test.js`
- Modify: `package.json` (add `validate-discovery` script)

The validator iterates `src/species-build/discovery/*.json`, validates each against `manifest.schema.json`, prints failures with file path + JSON pointer, exits non-zero on any failure.

- [ ] **Step 1: Write the failing test**

Create `src/species-build/__tests__/validate-discovery.test.js`:

```javascript
const fs = require('fs');
const os = require('os');
const path = require('path');
const { validateDiscoveryDir, validateOneManifest } = require('../validate-discovery');

const validFixturePath = path.resolve(__dirname, '..', '..', 'species-schema', '__tests__', 'fixtures', 'valid-manifest.json');

function loadValid() {
  return JSON.parse(JSON.stringify(JSON.parse(fs.readFileSync(validFixturePath, 'utf8'))));
}

function withTempDir(fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aquamate-vd-'));
  try { return fn(dir); } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}

function writeManifest(dir, name, payload) {
  fs.writeFileSync(path.join(dir, name), JSON.stringify(payload, null, 2));
}

describe('validate-discovery', () => {
  test('validateOneManifest accepts the valid fixture', () => {
    const result = validateOneManifest(loadValid());
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  test('validateOneManifest rejects unknown top-level fields', () => {
    const m = loadValid();
    m.surprise = 1;
    const result = validateOneManifest(m);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  test('validateDiscoveryDir returns ok=true for an empty discovery dir', () => {
    withTempDir(dir => {
      const result = validateDiscoveryDir(dir);
      expect(result.ok).toBe(true);
      expect(result.fileResults).toEqual([]);
    });
  });

  test('validateDiscoveryDir returns ok=true when every manifest is valid', () => {
    withTempDir(dir => {
      writeManifest(dir, 'fish-freshwater.json', loadValid());
      const m2 = loadValid();
      m2.meta.taxon = 'coral';
      m2.meta.waterType = 'saltwater';
      writeManifest(dir, 'coral-saltwater.json', m2);
      const result = validateDiscoveryDir(dir);
      expect(result.ok).toBe(true);
      expect(result.fileResults).toHaveLength(2);
      expect(result.fileResults.every(r => r.valid)).toBe(true);
    });
  });

  test('validateDiscoveryDir returns ok=false when any manifest is invalid', () => {
    withTempDir(dir => {
      writeManifest(dir, 'good.json', loadValid());
      const bad = loadValid();
      bad.entries[0].popularityScore = 99;
      writeManifest(dir, 'bad.json', bad);
      const result = validateDiscoveryDir(dir);
      expect(result.ok).toBe(false);
      const badResult = result.fileResults.find(r => r.file.endsWith('bad.json'));
      expect(badResult.valid).toBe(false);
      expect(badResult.errors.length).toBeGreaterThan(0);
    });
  });

  test('validateDiscoveryDir ignores non-JSON files', () => {
    withTempDir(dir => {
      writeManifest(dir, 'fish-freshwater.json', loadValid());
      fs.writeFileSync(path.join(dir, 'README.md'), '# notes');
      const result = validateDiscoveryDir(dir);
      expect(result.fileResults).toHaveLength(1);
      expect(result.ok).toBe(true);
    });
  });
});
```

- [ ] **Step 2: Run test to confirm it fails**

Run: `npx jest src/species-build/__tests__/validate-discovery.test.js`
Expected: FAIL with "Cannot find module '../validate-discovery'".

- [ ] **Step 3: Implement the validator**

Create `src/species-build/validate-discovery.js`:

```javascript
const fs = require('fs');
const path = require('path');
const Ajv = require('ajv/dist/2020');
const addFormats = require('ajv-formats');

const SCHEMA_PATH = path.resolve(__dirname, '..', 'species-schema', 'manifest.schema.json');
const DEFAULT_DIR = path.resolve(__dirname, 'discovery');

function makeValidator() {
  const ajv = new Ajv({ allErrors: true, strict: true });
  addFormats(ajv);
  const schema = JSON.parse(fs.readFileSync(SCHEMA_PATH, 'utf8'));
  return ajv.compile(schema);
}

function validateOneManifest(payload) {
  const validate = makeValidator();
  const ok = validate(payload);
  return {
    valid: !!ok,
    errors: validate.errors ? validate.errors.map(e => ({
      instancePath: e.instancePath,
      schemaPath: e.schemaPath,
      message: e.message,
      params: e.params
    })) : []
  };
}

function validateDiscoveryDir(dir) {
  if (!fs.existsSync(dir)) {
    return { ok: true, fileResults: [] };
  }
  const files = fs.readdirSync(dir)
    .filter(name => name.endsWith('.json'))
    .map(name => path.join(dir, name));
  const fileResults = files.map(file => {
    let payload;
    try {
      payload = JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch (err) {
      return { file, valid: false, errors: [{ message: `JSON parse error: ${err.message}` }] };
    }
    const result = validateOneManifest(payload);
    return { file, valid: result.valid, errors: result.errors };
  });
  const ok = fileResults.every(r => r.valid);
  return { ok, fileResults };
}

function formatResult(result) {
  const lines = [];
  for (const r of result.fileResults) {
    if (r.valid) {
      lines.push(`✓ ${r.file}`);
    } else {
      lines.push(`✗ ${r.file}`);
      for (const e of r.errors) {
        lines.push(`    ${e.instancePath || '(root)'}: ${e.message}`);
      }
    }
  }
  if (result.fileResults.length === 0) {
    lines.push('(no manifests found)');
  }
  return lines.join('\n');
}

if (require.main === module) {
  const dir = process.argv[2] || DEFAULT_DIR;
  const result = validateDiscoveryDir(dir);
  console.log(formatResult(result));
  if (!result.ok) {
    console.error(`\nValidation failed for ${result.fileResults.filter(r => !r.valid).length} file(s).`);
    process.exit(1);
  }
  console.log(`\nValidated ${result.fileResults.length} manifest file(s) successfully.`);
}

module.exports = { validateOneManifest, validateDiscoveryDir, formatResult };
```

- [ ] **Step 4: Run test to confirm it passes**

Run: `npx jest src/species-build/__tests__/validate-discovery.test.js`
Expected: PASS, 6 tests.

- [ ] **Step 5: Add the npm script**

Edit `package.json` `scripts` block. Add this line after `"review-field-gaps": "node src/species-build/review-field-gaps.js",`:

```json
"validate-discovery": "node src/species-build/validate-discovery.js",
```

The full `scripts` block after this edit should be:

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
  "review-field-gaps": "node src/species-build/review-field-gaps.js",
  "validate-discovery": "node src/species-build/validate-discovery.js"
}
```

Note: `validate-discovery` is NOT added to `prebuild`. Discovery manifests are a separate concern from the species data layer and don't gate deploys. They're validated on-demand after each agent dispatch.

- [ ] **Step 6: Verify the npm script works against an empty discovery dir**

Run: `npm run validate-discovery`
Expected: prints `(no manifests found)` and `Validated 0 manifest file(s) successfully.`, exits 0.

- [ ] **Step 7: Commit**

```bash
git add src/species-build/validate-discovery.js src/species-build/__tests__/validate-discovery.test.js package.json
git commit -m "feat(species-build): add Stage A manifest validator and npm script"
```

---

### Task 5: Agent playbook template

**Files:**
- Create: `docs/superpowers/playbooks/stage-a-discovery-agent.md`

The playbook is the literal text of the prompt that gets dispatched to each discovery agent. The controller (Task 6) substitutes `$VAR` placeholders before dispatch. This task creates the template with all the substantive instructions in place; only the slice-specific variables are missing.

- [ ] **Step 1: Create the playbook directory if needed**

Run: `mkdir -p docs/superpowers/playbooks`

- [ ] **Step 2: Write the playbook**

Create `docs/superpowers/playbooks/stage-a-discovery-agent.md`:

```markdown
# Stage A Discovery Agent Playbook

> **Template.** The controller substitutes the `$VAR` placeholders below before dispatching this prompt to an agent.

You are a Stage A discovery agent for the AquaMate species data layer. Your job is to crawl one primary aquarium-hobby source for one (taxon, waterType) slice, cross-verify candidates against secondary sources, score popularity via Wikipedia, and emit a sorted JSON manifest for human review.

## Your slice

- **Slice:** `$SLICE_KEY`  (e.g. `fish-freshwater`)
- **Taxon:** `$TAXON`     (one of: fish, crustacean, coral, mollusc, echinoderm, plant, macroalgae)
- **Water type:** `$WATER_TYPE` (one of: freshwater, saltwater, brackish)
- **Today's date:** `$TODAY_ISO`  (use this for `meta.discoveryDate` and any Wikipedia date math)

## Sources

**Primary source** (start here):
- Name: `$PRIMARY_SOURCE_NAME`
- Root URL: `$PRIMARY_SOURCE_ROOT`
- Task: navigate from the root to find the species/care-guide index for this slice. The index is usually under a "Care Guides", "Species", "Catalog", or similarly-named section. If the source has a search or category filter, use it to narrow to your taxon+waterType.

**Secondary sources** (used for cross-verification, in this order):
`$SECONDARY_SOURCES_JSON`

Each entry has `{name, root}`. For verification, navigate from the root or use the source's search to find the specific species page.

## Dedup list (skip these — already present in src/species/)

The following `(scientificName, commonNameNormalized)` tuples already exist in `src/species/` for this slice. Skip any candidate that matches:

```json
$DEDUP_LIST_JSON
```

Matching rules:
- Match on `scientificName` (case-insensitive, exact) when both your candidate and the dedup entry have one.
- Otherwise, match on `commonNameNormalized` (lowercase, single-spaced, trimmed — the dedup list is already normalized; normalize your candidate the same way before comparing).

## Output files

You will write two files when done:

1. **`$OUTPUT_PRIMARY_PATH`** — confident-taxon-fit candidates that should advance to Stage C research.
2. **`$OUTPUT_OTHER_PATH`** — candidates the primary source surfaced but you don't think fit the target taxon `$TAXON`, or that you have low confidence about. The human reviewer in Stage B will reassign or drop these.

Both files use the manifest format at **`src/species-schema/manifest.schema.json`** — read this schema before writing output. Both files must pass `npm run validate-discovery`.

Sort `entries` by `popularityScore` descending. Ties broken by `commonName` ascending.

## Playbook (execute in order)

### 1. Acquire the species index

- Fetch `$PRIMARY_SOURCE_ROOT` and navigate to the species/care-guide index for `$TAXON` + `$WATER_TYPE`.
- If you can't find a clean index page, fall back to searching the source for representative species names of the slice (e.g. "neon tetra", "cherry shrimp") and follow the navigation breadcrumbs.
- If after reasonable effort you cannot locate any species index for this source/slice, **stop and report failure** rather than fabricating an index URL. Return with status `FAILED_INDEX_ACQUISITION` and a description of what you tried.

Record the exact URL you decided is the index page — this becomes `meta.primarySource.indexUrl` in the output.

### 2. Extract candidates

For each species the primary source covers in this slice, record:

```
{
  commonName:          string,
  scientificName:      string | null,   // null if the source doesn't list one
  primarySourceUrl:    string,           // direct URL to the species' page on the primary source
  taxonFitConfidence:  "high" | "medium" | "low"   // same field that appears in the output manifest
}
```

`taxonFitConfidence` guidance:
- **high** — the source explicitly categorizes the species as `$TAXON` (e.g., listed under "Freshwater Fish" for fish-freshwater).
- **medium** — fit is implied but not explicit, OR the species is in the right category but ambiguous (e.g., a brackish-tolerant freshwater fish surfacing in the freshwater index).
- **low** — the source categorizes it as something else, or you suspect misclassification (a nudibranch listed under "mollusc" inventory, a freshwater shrimp species that doesn't actually exist in the hobby, etc.). These go to `$OUTPUT_OTHER_PATH`.

### 3. Apply the dedup filter

Drop any candidate that matches the dedup list (rules above).

### 4. Cross-source verification cull

For each remaining candidate:
- Try secondary sources in the order given in `$SECONDARY_SOURCES_JSON`.
- For each secondary source, attempt to find a species page for this candidate (search by `scientificName` if available, else `commonName`).
- Record `secondarySourceUrl` from the **first** secondary that confirms the species exists.
- Count `sourceCoverageCount` = 1 (primary) + number of secondary sources that have a page for this species (cap your check at the first 3 secondaries to bound runtime; if a candidate hits 3 secondaries, you may stop searching for it).
- **If no secondary confirms the candidate, drop it.** Source-coverage of 1 is below the scope threshold.

### 5. Wikipedia enrichment

For each candidate that survived step 4:

- Try Wikipedia article lookup by `scientificName` first, then by `commonName`. Use the English Wikipedia (`en.wikipedia.org`).
- Record `wikipediaUrl` (or `null` if no article exists for either query).
- If an article exists:
  - Fetch the Wikimedia pageviews REST endpoint:
    ```
    GET https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/en.wikipedia/all-access/all-agents/<URL-ENCODED-TITLE>/monthly/<START>/<END>
    ```
    where `<START>` is 12 calendar months before `$TODAY_ISO` (formatted `YYYYMMDD00`) and `<END>` is `$TODAY_ISO` (formatted `YYYYMMDD00`).
  - Compute `wikipediaPageviewsMonthly` as the **mean** of the 12 monthly `views` values returned. Round to the nearest integer. If the API returns fewer than 12 months (new article), average what's available.
  - Record `wikipediaArticleSizeBytes` from the article page metadata if available; otherwise leave `null`.

### 6. Compute popularityScore

For each candidate, apply the formula exactly:

```javascript
function popularityScore(wikipediaPageviewsMonthly, wikipediaUrl, sourceCoverageCount) {
  if (wikipediaUrl === null) return 0;
  const pv = Math.max(1, wikipediaPageviewsMonthly);
  const pageviewsPoints = Math.min(5, Math.floor(Math.log10(pv)));
  const sourcePoints   = Math.min(5, sourceCoverageCount);
  return Math.max(0, Math.min(10, pageviewsPoints + sourcePoints));
}
```

### 7. Partition into output files

- Candidates with `taxonFitConfidence === "low"` → `$OUTPUT_OTHER_PATH`.
- All other survivors → `$OUTPUT_PRIMARY_PATH`.

Sort each `entries` array by `popularityScore` descending; ties broken by `commonName` ascending.

### 8. Write both manifest files

Each file MUST have this shape (matching `src/species-schema/manifest.schema.json`):

```json
{
  "meta": {
    "discoveryDate": "$TODAY_ISO",
    "taxon": "$TAXON",
    "waterType": "$WATER_TYPE",
    "primarySource": { "name": "$PRIMARY_SOURCE_NAME", "indexUrl": "<the URL you found in step 1>" },
    "secondarySources": [
      { "name": "...", "url": "..." }
    ],
    "dedupListSize": <length of $DEDUP_LIST_JSON>,
    "candidateCount": <number of entries in THIS file>
  },
  "entries": [
    {
      "commonName": "...",
      "scientificName": "..." or null,
      "popularityScore": <0-10 integer>,
      "wikipediaUrl": "..." or null,
      "wikipediaPageviewsMonthly": <integer >=0>,
      "wikipediaArticleSizeBytes": <integer >=0> or null,
      "sourceCoverageCount": <integer >=1>,
      "primarySourceUrl": "...",
      "secondarySourceUrl": "...",
      "taxonFitConfidence": "high" | "medium" | "low",
      "notes": "..." or null
    }
  ]
}
```

For `$OUTPUT_OTHER_PATH`, set `meta.candidateCount` to the count of entries in that file (it may be 0 — write the file anyway with an empty `entries` array).

For `meta.secondarySources`, copy the `{name, root}` entries from `$SECONDARY_SOURCES_JSON`, renaming `root` to `url`.

### 9. Validate

Run from the repo root:

```
npm run validate-discovery
```

Expected output:
```
✓ src/species-build/discovery/<primary file>
✓ src/species-build/discovery/<other file>
...
Validated N manifest file(s) successfully.
```

If validation fails, read the error, fix the manifest, re-run. Bounded at 3 retries — beyond that, report status `FAILED_VALIDATION` with the validator output and stop.

### 10. Report back

Return with status `DONE` and a 1-paragraph summary:

- Number of confident-fit entries written to `$OUTPUT_PRIMARY_PATH`.
- Number of taxon-misfit entries written to `$OUTPUT_OTHER_PATH`.
- The 3 highest-popularityScore entries by name.
- Any anomalies encountered (sources slow/blocked, Wikipedia API gaps, ambiguous scientific names, etc.).

## Tool constraints

- You have access to WebFetch and WebSearch. Use WebFetch for known URLs; use WebSearch when navigating from a root URL to find an index page.
- You may NOT modify any file outside `src/species-build/discovery/`. Specifically: do not touch `src/species/`, do not edit the schema, do not modify any script.
- You may run `npm run validate-discovery` to check your output (this is required in step 9).

## What to do if you get stuck

- **Primary source unreachable / 404 / captcha:** report `FAILED_PRIMARY_SOURCE` with details; do not substitute a different source.
- **Wikipedia API errors:** for individual candidates, treat as "article not found" — `wikipediaUrl: null` and `popularityScore: 0`. Don't fail the whole slice over Wikipedia hiccups.
- **Schema validation keeps failing after 3 fix attempts:** report `FAILED_VALIDATION` with the final validator output and the file contents.
- **Slice is empty (no candidates survive after cross-verification):** still write both manifest files with empty `entries` arrays and report `DONE` with that finding. An empty slice is a valid result — it may mean the primary source has poor coverage of this taxon, which is itself useful Stage B signal.
```

- [ ] **Step 3: Commit**

```bash
git add docs/superpowers/playbooks/stage-a-discovery-agent.md
git commit -m "docs(playbooks): add Stage A discovery agent playbook template"
```

---

## Phase 2: Dispatch & Wrap (controller-only)

> Tasks 6–7 are not subagent-dispatched. They are executed by the controller (the agent running this plan) directly. The controller is responsible for: substituting playbook variables, dispatching the 3 parallel agents, validating their output, spot-checking results, and committing.

### Task 6: Dispatch the pilot

**Inputs (all built by previous tasks):**
- `src/species-build/source-urls.json` — read entries for the 3 pilot slices.
- `src/species-build/build-dedup-list.js` — call once per slice.
- `docs/superpowers/playbooks/stage-a-discovery-agent.md` — load and substitute variables.
- `superpowers:dispatching-parallel-agents` skill — used to dispatch.

**Outputs:**
- `src/species-build/discovery/fish-freshwater.json` + `fish-freshwater-other.json`
- `src/species-build/discovery/coral-saltwater.json` + `coral-saltwater-other.json`
- `src/species-build/discovery/plant-freshwater.json` + `plant-freshwater-other.json`

- [ ] **Step 1: Create the discovery output directory**

Run: `mkdir -p src/species-build/discovery`

- [ ] **Step 2: Build per-slice dedup lists**

For each of the 3 pilot slices, run the dedup helper and capture its output as a JSON string. Use this Node one-liner pattern:

```bash
node -e "
  const { buildDedupList } = require('./src/species-build/build-dedup-list');
  const lists = {
    'fish-freshwater':  buildDedupList({ speciesDir: 'src/species', kind: 'fauna', waterType: 'freshwater' }),
    'coral-saltwater':  buildDedupList({ speciesDir: 'src/species', kind: 'fauna', waterType: 'saltwater'  }),
    'plant-freshwater': buildDedupList({ speciesDir: 'src/species', kind: 'flora', waterType: 'freshwater' })
  };
  for (const [k, v] of Object.entries(lists)) console.log(k, v.length);
  require('fs').writeFileSync('/tmp/stage-a-dedup.json', JSON.stringify(lists, null, 2));
"
```

Expected: prints three counts and writes `/tmp/stage-a-dedup.json`. Record the counts — they become `meta.dedupListSize` in each agent's output.

For coral-saltwater: expect 0 (no corals exist yet in `src/species/`). For plant-freshwater: expect 1 (the single legacy plant entry). For fish-freshwater: expect a count in the 140s.

- [ ] **Step 3: Load source-urls and playbook template**

Read these files into controller memory:
- `src/species-build/source-urls.json`
- `docs/superpowers/playbooks/stage-a-discovery-agent.md`

- [ ] **Step 4: Instantiate the playbook for each pilot slice**

For each of `fish-freshwater`, `coral-saltwater`, `plant-freshwater`, substitute the following variables in a copy of the playbook text:

| Variable | Source |
|---|---|
| `$SLICE_KEY` | slice key string (e.g. `fish-freshwater`) |
| `$TAXON` | `source-urls.json` → `slices.<slice>.taxon` |
| `$WATER_TYPE` | `source-urls.json` → `slices.<slice>.waterType` |
| `$TODAY_ISO` | `2026-05-15` (or current date at dispatch time) |
| `$PRIMARY_SOURCE_NAME` | `source-urls.json` → `slices.<slice>.primary.name` |
| `$PRIMARY_SOURCE_ROOT` | `source-urls.json` → `slices.<slice>.primary.root` |
| `$SECONDARY_SOURCES_JSON` | `JSON.stringify(source-urls.json.slices.<slice>.secondaries, null, 2)` |
| `$DEDUP_LIST_JSON` | `JSON.stringify(dedupLists[<slice>], null, 2)` |
| `$OUTPUT_PRIMARY_PATH` | `src/species-build/discovery/<slice>.json` |
| `$OUTPUT_OTHER_PATH` | `src/species-build/discovery/<slice>-other.json` |

The result is 3 fully-instantiated prompts, one per slice.

- [ ] **Step 5: Dispatch via `superpowers:dispatching-parallel-agents`**

Invoke the skill with 3 parallel agent tasks. Each task:
- Subagent type: `general-purpose` (or whichever has WebFetch + Bash + Write access).
- Model: Sonnet 4.6 (`claude-sonnet-4-6`).
- Prompt: the instantiated playbook for that slice.
- Description: e.g. `"Stage A discovery: fish-freshwater"`.
- Run in foreground (controller needs to know when all 3 finish).

If the dispatching skill expects a single message with multiple Agent tool uses, send them in parallel from a single controller message.

- [ ] **Step 6: Wait for all 3 to complete, then validate**

After all 3 agents return, run:

```bash
npm run validate-discovery
```

Expected: 6 manifest files validated (3 primary + 3 `-other`), all `✓`, exit 0.

If any manifest fails validation, the responsible agent should have caught it in playbook step 9. If a manifest reaches this point invalid, that's an agent-side bug — re-dispatch that single slice with a clarification about the schema requirement.

- [ ] **Step 7: Commit the pilot manifests**

```bash
git add src/species-build/discovery/
git commit -m "data(discovery): Stage A pilot manifests (fish-fw, coral-sw, plant-fw)"
```

---

### Task 7: Pilot review & go/no-go

The controller now reviews the pilot output and decides whether the playbook is ready to scale to the remaining 8 slices.

- [ ] **Step 1: Read the agents' return summaries**

Each agent returned a 1-paragraph summary (per playbook step 10). Collect them. Note any `FAILED_*` statuses — those slices need re-dispatch with a fix.

- [ ] **Step 2: Spot-check ~5 entries per slice**

For each of the 3 primary manifests:
- Read entry 0 (highest popularityScore), middle entry, and last entry.
- Verify: `scientificName` matches the `commonName` (genus is reasonable for the species).
- Verify: `primarySourceUrl` resolves (open the URL in a browser, or `curl -I` it).
- Verify: `wikipediaUrl` (if non-null) resolves and is for the right species.
- Verify: `popularityScore` calculation looks right given the pageviews + sourceCoverageCount.

If any of these checks turn up errors, decide:
- **Single-entry error** — note it, leave it for Stage B human review to correct.
- **Systematic error across many entries** — likely a playbook bug. Document the issue, fix the playbook, re-dispatch the affected slice. Do NOT scale to remaining slices yet.

- [ ] **Step 3: Inspect the `-other.json` files**

For each of the 3 `-other` manifests:
- If empty: that's fine — agent had high confidence on all candidates.
- If non-empty: read the entries. Did the agent correctly route taxon misfits? E.g., are there nudibranchs in `coral-saltwater-other.json`? Are there algae in `plant-freshwater-other.json`?
- If the routing looks wrong (genuinely-correct-taxon entries got demoted to `-other`), that's another systematic playbook bug.

- [ ] **Step 4: Make the go/no-go call**

| Outcome | Action |
|---|---|
| All 3 manifests pass validation + spot-checks | **GO.** Write a brief commit summary of the pilot results and prepare to dispatch the remaining 8 slices (separate run, same playbook). |
| 1+ manifest has systematic errors | **NO-GO.** Document the issue, fix the playbook OR fix this plan's instructions, re-run the affected slice(s). |
| 1+ agent returned `FAILED_*` | **PARTIAL.** Re-dispatch the failed slice(s) with whatever fix the failure points to (e.g., a different source root, an updated instruction). The successful slices' manifests stay committed. |

- [ ] **Step 5: Document the outcome for the user**

In conversation, summarize for the user:
- How many candidates each slice surfaced (primary + `-other`).
- The top 3 entries by `popularityScore` per slice.
- Any anomalies.
- The go/no-go recommendation for the remaining 8 slices.
- A pointer to the manifests so the user can begin Stage B review.

This task ends in conversation, not a commit. Stage B (human review of the manifests) is the user's next action; the controller does not write any further code without user direction.

---

## Notes for the executing controller

- **Worktree:** Set up `.worktrees/stage-a-pilot` via `superpowers:using-git-worktrees` before starting Tasks 1–5.
- **TDD discipline:** Tasks 1, 3, and 4 follow strict TDD (red → green → commit). Tasks 2 and 5 are non-code artifacts (a static JSON table and a markdown playbook) — tests would be redundant.
- **No new dependencies needed.** Ajv 8 and ajv-formats are already in devDependencies.
- **Order of execution:** Tasks 1–5 are independent of each other in principle, but Task 4's test references the manifest schema from Task 1 and the fixture from Task 1 Step 1 — so Task 1 must complete before Task 4. Tasks 2, 3, 5 can be done in any order.
- **Tasks 6–7 are executed by the controller**, not via subagent-driven-development. Do not dispatch a subagent to "execute Task 6" — Task 6 IS the dispatch.
- **Wikipedia API rate limits:** The Wikimedia REST API is generally permissive but agents fetching pageviews for hundreds of candidates may want to space requests slightly. If an agent reports persistent 429s, the playbook can be updated to add explicit sleeps; for the pilot, we assume rate limits are not hit.
