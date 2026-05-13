# Species Data Redesign — Design Spec

**Date:** 2026-05-13
**Status:** Approved by user, ready for implementation planning
**Scope:** Foundational data-layer overhaul for AquaMate. Replaces the current `src/fauna.json` / `src/flora.json` placeholder data with a structured, validated, per-species data layer, then populates it via parallel-agent research.

## Context

AquaMate is a React app served via Cloudflare Workers, with image assets on Cloudflare R2. Today the worker imports two flat JSON files (`src/fauna.json`, ~125 species; `src/flora.json`, 1 entry) and serves paginated species listings and search to the frontend. Each species currently carries only `id`, `commonName`, `scientificName`, `category`, `image_url`, and a placeholder `description`.

The goals of this overhaul:

1. Establish a rich, validated data schema covering everything an aquarist needs to keep a species — water parameters, sizing, temperament, tank requirements, sources.
2. Move from monolithic JSON files to per-species source files for clean git diffs, easier authoring, and scale.
3. Research and populate the schema for every existing species using parallel research agents constrained to a curated source whitelist with mandatory cross-source verification.
4. Make source attribution first-class (every species credits a primary source plus up to 5 secondary sources).

The current site's API contract, frontend wiring, and worker logic are explicitly subject to change. This redesign is the foundational step in a broader site overhaul; preservation of existing behavior is not a constraint.

## Section 1 — Directory layout & module boundaries

```
src/
├── species/
│   ├── freshwater-fish/<slug>.json
│   ├── saltwater-fish/<slug>.json
│   ├── freshwater-plants/<slug>.json
│   ├── saltwater-plants/<slug>.json
│   └── algae/<slug>.json
├── species-schema/
│   ├── species.schema.json   # JSON Schema, source of truth for shape & validation
│   └── enums.json            # Shared vocabularies referenced by the schema
├── species-build/
│   ├── validate.js           # Ajv-based validation pass over species/**/*.json
│   ├── compile.js            # Bundles per-species files into dist/species.json
│   └── migrate-from-legacy.js # One-shot conversion from old fauna/flora JSON
└── backend/worker.js         # Imports dist/species.json (replaces old imports)

dist/                         # gitignored build output
└── species.json
```

**Module boundaries:**

- `src/species/` holds pure data — no logic, no derived fields. Hand-authored by humans or by research agents.
- `src/species-schema/` is the contract. Schema + enums are the single source of truth that validator, compiler, and (eventually) frontend filter UI all read from.
- `src/species-build/` holds pure transforms. Each script is independently runnable and testable.
- `src/backend/worker.js` consumes the compiled artifact; it doesn't know about per-species files.

**Output shape:** A single flat-list-per-kind artifact (`{ freshwaterFish: { items: [...] }, saltwaterFish: { items: [...] }, freshwaterPlants: { items: [...] }, saltwaterPlants: { items: [...] }, algae: { items: [...] } }`). The worker paginates flat arrays on the fly via slice arithmetic. No pre-grouped pages in source data — page boundaries are server-computed.

## Section 2 — Schema: core fields (kind-agnostic)

Every species file contains these fields regardless of kind:

```jsonc
{
  // Identity
  "id": "fw-001",
  "slug": "neon-tetra",
  "kind": "fish",                  // "fish" | "plant" | "algae"
  "waterType": "freshwater",       // "freshwater" | "saltwater" | "brackish"
  "commonName": "Neon Tetra",
  "scientificName": "Paracheirodon innesi",
  "alsoKnownAs": ["Neon"],
  "category": "Tetra",             // existing categorization preserved
  "taxonomy": { "family": "Characidae", "order": "Characiformes" },

  // Native habitat
  "nativeRange": {
    "regions": ["South America"],
    "countries": ["Brazil", "Colombia", "Peru"],
    "habitat": "Slow-moving blackwater tributaries of the Amazon basin",
    "biotope": "Blackwater"
  },

  // Water parameters — stored metric, frontend converts for display
  "waterParameters": {
    "temperatureC": { "min": 20,  "max": 26 },
    "pH":           { "min": 5.5, "max": 7.5 },
    "gH":           { "min": 1,   "max": 10 },  // null for saltwater
    "kH":           { "min": 0,   "max": 4 },   // null for saltwater
    "salinity":     null                          // {min,max} ppt for salt/brackish only
  },

  // Physical
  "adultSizeCm":   { "min": 3.0, "max": 4.0 },  // body length (fish) / height (plant) / colony (algae)
  "lifespanYears": { "min": 5,   "max": 8 },

  // Tank requirements
  "tank": {
    "minVolumeLiters": 60,
    "minLengthCm": 60,
    "swimZone": "mid",             // "top" | "mid" | "bottom" | "all"
    "decorPreferences": ["plants", "driftwood", "subdued lighting"]
  },

  // Care difficulty + diet
  "careLevel": "beginner",         // "beginner" | "intermediate" | "advanced" | "expert"
  "diet": {
    "type": "omnivore",            // "herbivore" | "carnivore" | "omnivore" | "planktivore" | "detritivore"
    "notes": "…"
  },

  // Compatibility (categorical tags, not species-ID pointers)
  "compatibility": {
    "temperament": "peaceful",     // "peaceful" | "semi-aggressive" | "aggressive" | "territorial"
    "grouping": "schooling",       // "solitary" | "pair" | "shoaling" | "schooling"
    "minGroupSize": 6,             // null when grouping is "solitary"/"pair"
    "goodWith": ["peaceful community", "small tetras", "corydoras"],
    "avoidWith": ["large cichlids", "fin nippers"]
  },

  // Media
  "media": {
    "primaryImage": "neon_tetra.webp",  // filename; worker resolves to R2 URL
    "gallery": []
  },

  // Content (prose)
  "summary":       "≤200-char one-liner used on cards.",
  "careNotes":     "Paragraph form, shown on InfoPage.",
  "breedingNotes": null,           // optional

  // Sources — ≤1 primary + ≤5 additional, enforced by schema
  "sources": {
    "primary": {
      "name": "Aquarium Co-Op",
      "url": "https://www.aquariumcoop.com/blogs/aquarium/neon-tetra-care-guide",
      "accessedDate": "2026-05-13"
    },
    "additional": [
      { "name": "SeriouslyFish", "url": "…", "accessedDate": "2026-05-13", "notes": "Cross-checked sizing" }
    ]
  },

  // Variant block (one of these three, gated by `kind`)
  "fish":  { /* present iff kind === "fish"   */ },
  "plant": { /* present iff kind === "plant"  */ },
  "algae": { /* present iff kind === "algae"  */ },

  // Audit
  "schemaVersion": 1,
  "dataStatus":    "researched",   // "placeholder" | "researched" | "needs_review" | "reviewed"
  "lastReviewed":  "2026-05-13"
}
```

**Design rules:**

1. **Units are metric in storage** (°C, cm, liters, ppt). Frontend converts to imperial at display time.
2. **Ranges are `{min, max}` numbers**, not strings. The builder tool's compatibility filter needs to compute overlaps.
3. **Compatibility is tag-based**, not species-ID pointer-based, to avoid an authoring blow-up.
4. **`adultSizeCm`** interprets as body length for fish, height for plants, colony size for algae. Documented in the schema description.
5. **`id` values from the legacy data are preserved verbatim** so future tooling that references them stays valid. New `slug` field is URL-safe.

## Section 3 — Schema: variant blocks

Each variant block is present iff `kind` matches. JSON Schema enforces conditionally via `if/then`.

### `fish` block

```jsonc
"fish": {
  "breedingDifficulty": "advanced",  // "easy" | "moderate" | "difficult" | "advanced" | "not in captivity"
  "breedingNotes": "Soft, acidic water, subdued lighting, egg-eaters.",
  "conspecificAggression": "low",    // "none" | "low" | "moderate" | "high"
  "finNippy": false,
  "reefSafe": null                   // "yes" | "with caution" | "no" — required when waterType === "saltwater", null otherwise
}
```

- `conspecificAggression` is independent of general temperament. Many fish are peaceful in a community but territorial with their own kind.
- `finNippy` is its own boolean field rather than a compat tag because it's common and the filter needs it specifically.

### `plant` block

```jsonc
"plant": {
  "lighting": "low",             // "low" | "medium" | "high"
  "co2": "optional",             // "none" | "optional" | "recommended"
  "growthRate": "slow",          // "slow" | "medium" | "fast"
  "placement": "epiphyte",       // "foreground" | "midground" | "background" | "floating" | "epiphyte"
  "propagation": ["rhizome division"],
  "substrate": "any",            // "any" | "nutrient-rich" | "inert" | "n/a"
  "fertilization": "low"         // "low" | "moderate" | "heavy"
}
```

- `co2: "recommended"` (not `"required"`) because no aquarium plant strictly needs CO₂ injection — even demanding stems survive without it, just don't thrive aesthetically.

### `algae` block

```jsonc
"algae": {
  "lighting": "high",
  "growthRate": "fast",
  "form": "macroalgae",          // "macroalgae" | "filamentous" | "calcareous" | "encrusting"
  "placement": "refugium",       // "refugium" | "display" | "sump"
  "nutrientUptake": "high",      // "low" | "moderate" | "high"
  "propagation": ["fragmentation"]
}
```

- No CO₂ field — marine setups don't dose CO₂.
- Algae is kept distinct from plants because the use case (often a nitrogen/phosphate export tool in a refugium) drives different fields.

### Shared enums

All enum vocabularies live once in `src/species-schema/enums.json` and are referenced via JSON Schema `$ref`. Adding a biotope or grouping type is a one-file edit. Frontend filter UI reads the same file.

## Section 4 — Validation & build pipeline

Two scripts, both pure functions, runnable locally and in CI.

### `npm run validate` — schema enforcement

- Uses **Ajv** (zero-config, fast, supports `if/then`, ESM-friendly).
- Iterates every `src/species/**/*.json`, validates against `species.schema.json`.
- Reports failures with file path + JSON pointer to the offending field.
- Exits non-zero on any failure.
- Wired into `prebuild` and `predeploy` npm scripts. Bad files cannot reach a deploy.

**Schema enforces:**

- All required core fields present, types correct (gated by `dataStatus`; see below).
- `kind` ↔ variant block consistency.
- `waterType === "saltwater"` ⇒ `fish.reefSafe` non-null.
- `sources.additional.length ≤ 5`.
- All enum-valued fields match `enums.json` vocabularies.
- Range fields: `min ≤ max`, both numeric.
- `id` matches `^(fw|sw|fl|fp|sp|al)-\d{3,}$`. `slug` matches `^[a-z0-9-]+$`.

**`dataStatus`-conditional required fields** (via JSON Schema `if/then`):

| `dataStatus` | Required | Allowed null |
|---|---|---|
| `"placeholder"` | Identity fields + `media.primaryImage` only | All research fields |
| `"researched"` | Full schema, primary source set | A handful of genuinely-unknown fields |
| `"needs_review"` | Same as researched; written by agents when sources disagree or validation retries exhaust | Same |
| `"reviewed"` | Same as researched, plus `lastReviewed` within last 12 months | Same |

This makes structural migration (Section 5) commit-able before any research happens.

### `npm run compile-species` — bundle compiler

- Reads every `src/species/**/*.json`.
- Groups by `kind` + `waterType` into flat arrays.
- Writes `dist/species.json` (single artifact):

```jsonc
{
  "freshwaterFish":   { "items": [...] },
  "saltwaterFish":    { "items": [...] },
  "freshwaterPlants": { "items": [...] },
  "saltwaterPlants":  { "items": [...] },
  "algae":            { "items": [...] }
}
```

### Worker changes

- Import path: `'../fauna.json'` / `'../flora.json'` → `'../../dist/species.json'`.
- Pagination: replace pre-grouped-page lookup with `items.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)` arithmetic against flat arrays. `PAGE_SIZE = 8` to match current behavior.
- Response shape may evolve to expose the richer fields where useful; legacy clients are part of the active overhaul and not preserved as a constraint.

### `package.json` scripts

```json
"scripts": {
  "validate":        "node src/species-build/validate.js",
  "compile-species": "node src/species-build/compile.js",
  "prebuild":        "npm run validate && npm run compile-species",
  "predeploy":       "npm run validate && npm run compile-species"
}
```

### Scale-out trigger (deferred)

Single bundled `dist/species.json` is fine until the deploy bundle approaches Cloudflare's 1 MiB compressed limit (free tier) or 10 MiB (paid tier). Realistic crossover: ~1,500 species. At that point migrate to Cloudflare KV — the compile script becomes the KV upload step, worker queries KV at request time. Not built now (YAGNI).

## Section 5 — Migration plan

Goal: get from today's two sparse JSON files to the new structure cleanly. Phasing exists for debuggability, not because site breakage is forbidden — the user has explicitly accepted that the site may break during this overhaul.

### Phase 0 — Foundation

- Add `src/species-schema/{species.schema.json, enums.json}`.
- Add `src/species-build/{validate.js, compile.js, migrate-from-legacy.js}`.
- Add `dist/` to `.gitignore`.
- Wire `prebuild` / `predeploy` npm scripts.
- Worker untouched. Site behaves identically.

### Phase 1 — Mechanical conversion

Run `node src/species-build/migrate-from-legacy.js` once:

- Reads `src/fauna.json` + `src/flora.json`.
- For each item:
  - Generates `slug` from `commonName` (kebab-case, deduped via `-2`, `-3` suffixes on collision).
  - Infers `kind` from source key (`freshwater`/`saltwater` → `"fish"`; flora → `"plant"`).
  - Infers `waterType` from source key.
  - Sets `dataStatus: "placeholder"`.
  - Preserves: `id`, `commonName`, `scientificName`, `category`, `image_url` → `media.primaryImage`, `description` → `summary`.
  - Initializes remaining schema with valid-but-empty defaults that pass placeholder-mode validation.
- Writes per-species files into `src/species/<kind-watertype>/<slug>.json`.
- Runs validation. Build must pass.

Output: ~125 placeholder species files, structurally complete, content unchanged from today.

### Phase 2 — Cutover (worker switches to new pipeline, legacy files deleted)

Single commit:

- Worker import path swap.
- Worker pagination swap.
- Delete `src/fauna.json` and `src/flora.json`.
- (Keep `src/tanks.json` — out of scope.)
- Deploy.

The site now runs on the new pipeline. Frontend may need adjustment to render new fields once they're populated, but that's a separate follow-on.

### Phase 3 — Smoke verification

- `/api/images/freshwater/1` returns expected shape and items.
- `/api/search?q=neon` returns hits.
- `/info/Neon%20Tetra` renders without error.
- Pre-existing favorites still resolve via stable `id` values.

### What is preserved through migration

- All `id` values verbatim.
- All `image_url` filenames (R2 buckets unchanged).
- All `category` values (preserved on each species file).
- `src/tanks.json` (out of scope for this design).

### What is deleted at end of migration

- `src/fauna.json`.
- `src/flora.json`.

## Section 6 — Data population (parallel-agent research)

After Section 5, every species file exists with `dataStatus: "placeholder"`. This phase upgrades them to `"researched"` via parallel research agents.

### Dispatch model

- One agent per species, via `superpowers:dispatching-parallel-agents`.
- Batch size: ~10 species per wave, parallel within the wave, sequential across waves.
- Total: ~13 waves for the current 125 species.
- Order: most common / best-documented species first (popular tetras, common plants, beginner saltwater).
- Checkpoint: commit after each wave for reviewable, surgically-revertible history.
- Recommended model: Sonnet 4.6 (Opus overkill for structured extraction + cross-check; Haiku struggles with multi-source synthesis).

### Agent inputs (every dispatch identical)

1. Target species' placeholder file.
2. `src/species-schema/species.schema.json`.
3. `src/species-schema/enums.json`.
4. The source whitelist (below).
5. The research-and-write playbook (below).

### Research-and-write playbook

```
1. Identify species precisely.
   Use scientificName if non-empty; else fuzzy-match commonName via FishBase
   / AlgaeBase taxonomy. Confirm correct species before proceeding.

2. Fetch primary source for this kind/waterType from the whitelist.
   Extract all schema fields it can fill.

3. Cross-source verification (mandatory).
   Fetch at least one secondary source from the whitelist.
   Explicitly cross-check these high-stakes fields:
     - adultSizeCm
     - waterParameters.*
     - compatibility.temperament + grouping + minGroupSize
     - tank.minVolumeLiters
     - nativeRange
   Minor disagreement: take the conservative figure (larger min tank,
     gentler temp range, gentler temperament). Note discrepancy in
     additionalSources[].notes.
   Significant disagreement (>2x size, incompatible enum values):
     set dataStatus = "needs_review", record both figures in notes.

4. Fill lower-stakes fields from whichever source has them
   (taxonomy, alsoKnownAs, lifespan, decor preferences, prose summary,
    careNotes, breedingNotes).

5. Write the species JSON file.
   - dataStatus = "researched" (or "needs_review" per step 3)
   - sources.primary set with name/url/accessedDate
   - additional sources used, cap at 5
   - lastReviewed = today

6. Local validate.
   Run `npm run validate -- src/species/<path>/<slug>.json`.
   On failure: read error, correct entry, re-validate.
   Bounded at 3 retries — beyond that, dataStatus = "needs_review",
   include validator error in a note, return for human review.

7. Return path to written file + 1-sentence summary including any flags.
```

### Source whitelist

| Kind / waterType | Primary | Secondary candidates |
|---|---|---|
| Freshwater fish | **Aquarium Co-Op** | SeriouslyFish, FishBase, Practical Fishkeeping |
| Saltwater fish | **LiveAquaria care guides** | Reef2Reef wiki, FishBase, Bluezooaquatics |
| Freshwater plants | **Buce Plant** | Tropica, 2HR Aquarist, AquariumPlants.com |
| Saltwater plants / macroalgae | **AlgaeBase** | Reef2Reef macroalgae wiki, ReefCleaners |
| Cultivated algae | **AlgaeBase** | ReefCleaners, Bulk Reef Supply guides |

Universal taxonomy / scientific-name fallback: **FishBase** (animals), **AlgaeBase** (plants/algae).

### Review workflow

After each wave:

1. CI runs `npm run validate` across the tree. Hard fail blocks merge.
2. User scans `git diff src/species/` for the wave (~10 files; quick visual sanity check of prose and flagged discrepancies).
3. `dataStatus: "needs_review"` entries are listed in the wave summary. User either corrects in-place and bumps to `"researched"`, or kicks back to a single re-research agent with extra context.
4. For trusted waves, user may optionally bump `dataStatus` to `"reviewed"` and set `lastReviewed`. Separate sweep, not part of the agent workflow.

### Out of scope (deferred)

- **Image curation.** R2 buckets already populated; agents don't touch images.
- **InfoPage frontend rework.** The new schema fields will need new UI to display them. Separate design.
- **`tanks.json` redesign.** Different data type, different research pattern.
- **Pointer-based pairwise compatibility** (e.g. specific species-ID references in `compatibility.goodWith`). Future enhancement on top of the current tag-based model.

## Risks and mitigations

| Risk | Mitigation |
|---|---|
| Agent inserts factually wrong data | Mandatory cross-source verification; conservative-figure rule on disagreement; `needs_review` flag for significant conflicts. |
| Agent typos enum values, breaks filtering silently | JSON Schema validation hard-gates the build. |
| Bundle grows past Cloudflare's 1 MiB compressed limit | Migrate `dist/species.json` to Cloudflare KV; compile script becomes uploader. Triggered around ~1,500 species. |
| Slug collisions between species | Migration script detects and suffixes (`-2`, `-3`). Rare in practice. |
| Source whitelist proves wrong over time | Whitelist is editable in the spec; agent playbook reads it as input. Change in one place. |
| Frontend can't render new fields | Acceptable; frontend rework is the next overhaul step after this foundation lands. |

## Implementation order (high-level — detailed plan to follow)

1. Schema + enums + validator (Section 4 tooling).
2. Migration script (Section 5, Phase 1).
3. Worker cutover + legacy file deletion (Section 5, Phase 2).
4. Smoke verification (Section 5, Phase 3).
5. First population wave (~10 high-confidence species; validates the agent playbook end-to-end before scaling).
6. Remaining population waves until all species are `"researched"`.

A detailed implementation plan with task breakdown, parallelizability, and verification steps will be produced via the `superpowers:writing-plans` skill once this spec is approved.
