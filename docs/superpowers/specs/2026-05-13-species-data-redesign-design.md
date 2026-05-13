# Species Data Redesign — Design Spec

**Date:** 2026-05-13
**Status:** Approved by user, ready for implementation planning
**Scope:** Foundational data-layer overhaul for AquaMate. Replaces the current `src/fauna.json` / `src/flora.json` placeholder data with a structured, validated, per-species data layer, then populates it via parallel-agent research.

## Context

AquaMate is a React app served via Cloudflare Workers, with image assets on Cloudflare R2. Today the worker imports two flat JSON files (`src/fauna.json`, ~125 species; `src/flora.json`, 1 entry) and serves paginated species listings and search to the frontend. Each species currently carries only `id`, `commonName`, `scientificName`, `category`, `image_url`, and a placeholder `description`.

The goals of this overhaul:

1. Establish a rich, validated data schema covering everything an aquarist needs to keep a species — water parameters, sizing, temperament, tank requirements, sources, etc.
2. Move from monolithic JSON files to per-species source files for clean git diffs, easier authoring, and scale.
3. Discover new species via the curated source whitelist, score them by Wikipedia-derived popularity for human-reviewable scope decisions, and research-and-populate the schema for both legacy and discovered species using parallel agents with mandatory cross-source verification.
4. Make source attribution first-class (every species credits a primary source plus up to 5 secondary sources).

The current site's API contract, frontend wiring, and worker logic are explicitly subject to change. This redesign is the foundational step in a broader site overhaul; preservation of existing behavior is not a constraint.

## Section 1 — Directory layout & module boundaries

```
src/
├── species/
│   ├── fish/<slug>.json
│   ├── crustacean/<slug>.json
│   ├── coral/<slug>.json
│   ├── mollusc/<slug>.json
│   ├── echinoderm/<slug>.json
│   ├── other-invert/<slug>.json
│   ├── plant/<slug>.json
│   └── macroalgae/<slug>.json
├── species-schema/
│   ├── species.schema.json   # JSON Schema, source of truth for shape & validation
│   └── enums.json            # Shared vocabularies referenced by the schema
├── species-build/
│   ├── validate.js           # Ajv-based validation pass over species/**/*.json
│   ├── compile.js            # Bundles per-species files into dist/species.json
│   ├── migrate-from-legacy.js # One-shot conversion from old fauna/flora JSON
│   ├── review-field-gaps.js  # Summarizer for the field-gap log
│   ├── field-gap-suggestions.jsonl  # Append-only log of agent-suggested new fields
│   └── discovery/            # Stage A discovery manifests (committed, then human-trimmed)
│       ├── fish-freshwater.json
│       ├── fish-saltwater.json
│       ├── crustacean-freshwater.json
│       ├── …
│       └── other-invert-review.json   # candidates that didn't fit any catalogued taxon
└── backend/worker.js         # Imports dist/species.json (replaces old imports)

dist/                         # gitignored build output
└── species.json
```

**Folder strategy:** files are grouped **by taxon**, not by water type. Water type is a field inside each file. This keeps folder count bounded (8 taxa total) and avoids combinatorial explosion (8 taxa × 3 water types = 24 folders, most sparsely populated).

**Module boundaries:**

- `src/species/` holds pure data — no logic, no derived fields. Hand-authored by humans or by research agents.
- `src/species-schema/` is the contract. Schema + enums are the single source of truth that validator, compiler, and (eventually) frontend filter UI all read from.
- `src/species-build/` holds pure transforms. Each script is independently runnable and testable.
- `src/backend/worker.js` consumes the compiled artifact; it doesn't know about per-species files.

**Output shape:** A flat-list-per-(kind × waterType) artifact, e.g.:

```jsonc
{
  "fauna": {
    "freshwater": { "items": [/* fish, crustaceans, molluscs… */] },
    "saltwater":  { "items": [/* fish, crustaceans, corals, molluscs, echinoderms… */] },
    "brackish":   { "items": [...] }
  },
  "flora": {
    "freshwater": { "items": [/* plants */] },
    "saltwater":  { "items": [/* macroalgae, marine plants */] },
    "brackish":   { "items": [...] }
  }
}
```

The worker paginates flat arrays on the fly via slice arithmetic. Frontend filters by `taxon` client-side when finer-grained views are needed (e.g. "show me only freshwater shrimp"). No pre-grouped pages in source data — page boundaries are server-computed.

## Section 2 — Schema: core fields (kind-agnostic)

Every species file contains these fields regardless of kind:

```jsonc
{
  // Identity
  "id": "fw-001",
  "slug": "neon-tetra",
  "kind": "fauna",                 // "fauna" | "flora"  — high-level category for filtering UI
  "taxon": "fish",                 // sub-discriminator that gates the variant block:
                                   //   fauna: "fish" | "crustacean" | "coral" | "mollusc" | "echinoderm" | "other-invert"
                                   //   flora: "plant" | "macroalgae"
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
  // All are nullable. Filled when sources specify; null when they don't.
  // Relevance varies by taxon (e.g. gH is critical for shrimp, important for many freshwater fish,
  // less commonly tracked for saltwater life). Frontend conditionally hides irrelevant rows on display.
  "waterParameters": {
    "temperatureC": { "min": 20,  "max": 26 },
    "pH":           { "min": 5.5, "max": 7.5 },
    "gH":           { "min": 1,   "max": 10 },  // most relevant in freshwater
    "kH":           { "min": 0,   "max": 4 },   // freshwater carbonate hardness; for saltwater this is the same measurement as reef "alkalinity"
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

  // Variant block — exactly one of these is present, gated by `taxon`
  "fish":         { /* present iff taxon === "fish"         */ },
  "crustacean":   { /* present iff taxon === "crustacean"   */ },
  "coral":        { /* present iff taxon === "coral"        */ },
  "mollusc":      { /* present iff taxon === "mollusc"      */ },
  "echinoderm":   { /* present iff taxon === "echinoderm"   */ },
  "other-invert": { /* present iff taxon === "other-invert" */ },
  "plant":        { /* present iff taxon === "plant"        */ },
  "macroalgae":   { /* present iff taxon === "macroalgae"   */ },

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
4. **`adultSizeCm`** interprets as body length for fish, height/spread for plants, colony size for corals and macroalgae, shell length for molluscs, and adult body span for other invertebrates. Documented in the schema description.
5. **`id` values from the legacy data are preserved verbatim** so favorites and any external references stay valid. New `slug` field is URL-safe.
6. **New ID prefix scheme** for entries added post-migration: `<watertype>-<taxon-short>-NNN` (e.g. `fw-crus-001` for a cherry shrimp, `sw-coral-001` for a hammer coral, `sw-fish-014` for a clownfish). Existing `fw-NNN`/`sw-NNN`/`fl-NNN` are grandfathered and never reissued. The schema accepts both formats.
7. **`waterType` × `taxon` constraint:** `taxon === "coral"` ⇒ `waterType === "saltwater"` (no freshwater corals exist). Enforced by JSON Schema `if/then`. Other taxa may span any water type.

## Section 3 — Schema: variant blocks

Each variant block is present iff `taxon` matches. JSON Schema enforces conditionally via `if/then`.

### `fish` block — `taxon === "fish"` (fauna)

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

### `crustacean` block — `taxon === "crustacean"` (fauna)

Covers freshwater shrimp/crayfish/crabs and saltwater shrimp/crabs.

```jsonc
"crustacean": {
  "copperSensitive": true,                // most are; copper-based meds kill them — defaults to true
  "moltingFrequencyDays": 30,             // approximate; null if not in source
  "moltingNotes": "Hide for 24–48h after molting; do not remove old exoskeleton.",
  "escapeRisk": "low",                    // "low" | "moderate" | "high" — crabs especially
  "breedingDifficulty": "easy",           // same enum as fish.breedingDifficulty
  "breedingNotes": "Drops single-stage shrimplets; no larval phase.",
  "speciesOnlyTankRecommended": false     // some, like Sulawesi shrimp, demand species-only setups
}
```

### `coral` block — `taxon === "coral"` (fauna, saltwater only)

```jsonc
"coral": {
  "coralType": "LPS",                     // "LPS" | "SPS" | "soft" | "anemone" | "zoanthid" | "mushroom"
  "lighting": { "minPAR": 50, "maxPAR": 150 },   // Photosynthetically Active Radiation range
  "flow": "medium",                       // "low" | "medium" | "high"
  "placement": "lower",                   // "lower" | "middle" | "upper" | "anywhere"
  "aggressionRangeCm": 10,                // stinging-tentacle reach; null if non-stinging
  "feedingFrequency": "weekly",           // "none" | "weekly" | "daily"
  "calciumPPM":   { "min": 380, "max": 450 },    // reef-specific chemistry lives here, not in waterParameters
  "magnesiumPPM": { "min": 1250, "max": 1400 }
}
```

- Reef chemistry (calcium, magnesium) is coral-specific and lives in this variant rather than `waterParameters` — no other taxon cares about it.
- Alkalinity is captured in `waterParameters.kH`, which is the same measurement reef-keepers know as "alkalinity" (dKH).

### `mollusc` block — `taxon === "mollusc"` (fauna)

Covers snails (fresh and salt), clams, conches.

```jsonc
"mollusc": {
  "copperSensitive": true,                // virtually all are
  "substrateNeeds": "sand",               // "any" | "sand" | "gravel" | "soft"
  "climbsOutOfTank": false,               // true for many freshwater snails (mystery, ramshorn)
  "algaeTypesConsumed": ["green film", "diatoms"]   // for cleanup-crew utility; empty array if not algivorous
}
```

### `echinoderm` block — `taxon === "echinoderm"` (fauna, typically saltwater)

Covers sea stars, urchins, cucumbers.

```jsonc
"echinoderm": {
  "copperSensitive": true,
  "minTankAgeMonths": 6,                  // many require mature, biologically stable systems
  "coralSafe": true,                      // urchins can graze coralline; cucumbers can release toxins under stress
  "waterStabilitySensitivity": "high"     // "low" | "moderate" | "high"
}
```

### `other-invert` block — `taxon === "other-invert"` (fauna, catch-all)

For nudibranchs, polychaetes, sea jellies, sponges, anything that doesn't fit cleanly above. Intentionally minimal — if anything in here becomes common, promote it to its own variant.

```jsonc
"other-invert": {
  "notes": "Free-form husbandry summary; the taxon is rare enough that we don't pre-shape its fields."
}
```

### `plant` block — `taxon === "plant"` (flora)

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

### `macroalgae` block — `taxon === "macroalgae"` (flora)

```jsonc
"macroalgae": {
  "lighting": "high",
  "growthRate": "fast",
  "form": "macroalgae",          // "macroalgae" | "filamentous" | "calcareous" | "encrusting"
  "placement": "refugium",       // "refugium" | "display" | "sump"
  "nutrientUptake": "high",      // "low" | "moderate" | "high"
  "propagation": ["fragmentation"]
}
```

- No CO₂ field — marine setups don't dose CO₂.
- Macroalgae overlaps with `plant` in some fields (lighting, growth, propagation) but adds nutrient-export framing (placement: refugium, nutrientUptake) that's central to how they're used in saltwater systems.

### Shared enums

All enum vocabularies live once in `src/species-schema/enums.json` and are referenced via JSON Schema `$ref`. Adding a biotope, grouping type, or coral type is a one-file edit. Frontend filter UI reads the same file.

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
- `kind` ↔ `taxon` consistency (fauna allows fish/crustacean/coral/mollusc/echinoderm/other-invert; flora allows plant/macroalgae).
- `taxon` ↔ variant block consistency (exactly one variant block present, matching `taxon`).
- `taxon === "coral"` ⇒ `waterType === "saltwater"` (no freshwater corals).
- `waterType === "saltwater"` AND `taxon === "fish"` ⇒ `fish.reefSafe` non-null.
- `sources.additional.length ≤ 5`.
- All enum-valued fields match `enums.json` vocabularies.
- Range fields: `min ≤ max`, both numeric.
- `id` matches either the legacy format `^(fw|sw|fl)-\d{3,}$` or the new format `^(fw|sw|br)-(fish|crus|coral|moll|echi|invert|plant|algae)-\d{3,}$`. `slug` matches `^[a-z0-9-]+$`.
- Schema is **closed**: `additionalProperties: false` at the top level and inside every variant block. Unknown fields are rejected. This prevents agents from silently forking the schema by adding ad-hoc fields — gap suggestions must go to `field-gap-suggestions.jsonl` instead (see Section 6).

**`dataStatus`-conditional required fields** (via JSON Schema `if/then`):

| `dataStatus` | Required | Allowed null |
|---|---|---|
| `"placeholder"` | Identity fields (`id`, `slug`, `kind`, `taxon`, `waterType`, `commonName`, `scientificName`) | All research fields, including `media.primaryImage` |
| `"researched"` | Full schema (water params, sizing, temperament, tank, diet, compatibility, variant block), primary source set | `breedingNotes`, `taxonomy.*`, `lifespanYears`, `media.primaryImage` (discovered species often lack images), and other genuinely-unknown fields where sources are silent |
| `"needs_review"` | Same as researched; written by agents when sources disagree or validation retries exhaust | Same |
| `"reviewed"` | Same as researched, plus `lastReviewed` within last 12 months | Same |

This makes structural migration (Section 5) commit-able before any research happens, and lets newly-discovered species be `"researched"` even when no image exists yet.

### `npm run compile-species` — bundle compiler

- Reads every `src/species/**/*.json`.
- Groups by `kind` + `waterType` into flat arrays.
- Writes `dist/species.json` (single artifact):

```jsonc
{
  "fauna": {
    "freshwater": { "items": [...] },
    "saltwater":  { "items": [...] },
    "brackish":   { "items": [...] }
  },
  "flora": {
    "freshwater": { "items": [...] },
    "saltwater":  { "items": [...] },
    "brackish":   { "items": [...] }
  }
}
```

Frontend or worker callers filter by `taxon` (and any other field) client-side when finer-grained views are needed.

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
  - Infers `kind` from source file (`fauna.json` → `"fauna"`; `flora.json` → `"flora"`).
  - Infers `waterType` from source key inside the file (`freshwater`/`saltwater`/`brackish`).
  - Infers `taxon` by inspecting `commonName` against a small keyword map (`"shrimp"|"crayfish"|"crab"` → `crustacean`; `"snail"|"clam"` → `mollusc`; `"coral"|"anemone"|"zoanthid"|"polyp"` → `coral`; `"starfish"|"sea star"|"urchin"|"cucumber"` → `echinoderm`); otherwise defaults to `"fish"` for fauna entries and `"plant"` for flora entries. Edge cases that the keyword pass mis-categorizes are corrected by hand after the migration runs — the migration script writes a `dataStatus: "placeholder"` so post-hoc taxon fixes are cheap.
  - Sets `dataStatus: "placeholder"`.
  - Preserves: `id`, `commonName`, `scientificName`, `category`, `image_url` → `media.primaryImage`, `description` → `summary`.
  - Initializes remaining schema with valid-but-empty defaults that pass placeholder-mode validation.
- Writes per-species files into `src/species/<taxon>/<slug>.json`.
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

After Section 5, every legacy species exists as a placeholder file in `src/species/`. This section covers two complementary populating workflows that share infrastructure:

1. **Discovery + popularity scoring** — expands the dataset beyond the legacy ~125 species by crawling the primary sources to find every species they cover, enriching each candidate with a popularity signal so scope can be trimmed on data rather than personal familiarity.
2. **Per-species research** — for both the legacy placeholders and the approved discovered candidates, parallel agents fill in the schema with cross-verified data.

A user-review gate sits between them so total scope is visible (and trimmable) before the long research run kicks off.

### Three-stage flow

```
Stage A — Discovery + popularity enrichment        (a few hours, agent-driven)
Stage B — User review of manifests                 (manual, however long)
Stage C — Per-species research, ~10 species/wave    (long, agent-driven)
```

### Model choice

**Sonnet 4.6 across all stages.** The work is bounded structured extraction with cross-source verification — Sonnet's wheelhouse. Opus would be slower per agent without meaningfully improving output quality on this shape of task; throughput matters at 1,000+ candidates. Haiku struggles with multi-source synthesis.

### Stage A — Discovery + popularity enrichment

For each `(taxon, waterType)` slice across the 7 catalogued taxa (`other-invert` is excluded from targeted discovery — see below):

1. **Index acquisition.** Discovery agent fetches the primary source's species index for the slice (e.g., Aquarium Co-Op's freshwater fish care-guide index, WWC's coral catalog, Buce Plant's plant index).
2. **Candidate extraction.** Agent emits `{ commonName, scientificName, primarySourceUrl, inferredTaxon }` for every species the primary source covers.
3. **Secondary verification cull.** For each candidate, the agent queries the first secondary source from the whitelist. If absent, drop. If present, record `secondarySourceUrl`. (Your scope rule.)
4. **Dedup against legacy.** Filter out anything matching an already-present species file in `src/species/` (by `scientificName` if available, else normalized `commonName`).
5. **Popularity enrichment.** For each surviving candidate, look up Wikipedia (preferring `scientificName`, falling back to `commonName + (taxon hint)`) and record:
   - `wikipediaUrl` (null if no article exists)
   - `wikipediaPageviewsMonthly` — 12-month average from the Wikimedia REST pageviews API
   - `wikipediaArticleSizeBytes`
   - `sourceCoverageCount` — number of whitelist sources covering this species (primary + N secondaries)
6. **Composite `popularityScore` (0–10):** `0` if no Wikipedia article. Otherwise, log-scaled pageviews (cap 5 pts) + `sourceCoverageCount` (cap 5 pts).
7. **Taxon-fit check.** If a candidate doesn't cleanly fit the slice's target taxon (e.g., a nudibranch surfaced via the mollusc index but actually closer to `other-invert`), it's routed to a separate `src/species-build/discovery/other-invert-review.json` manifest for human reassignment rather than auto-classified.
8. **Manifest emission.** Discovery writes `src/species-build/discovery/<taxon>-<waterType>.json`, sorted by `popularityScore` descending.

**Why Wikipedia for popularity:** real public API, unambiguous signal (pageviews map to interest), no scraping/captcha issues. Google result counts are inflated and ambiguous (e.g., "Emperor" returns Roman emperors, not the angelfish). Wikipedia article *existence* is itself a strong popularity signal. Sparse Wikipedia coverage for niche taxa is fine — those entries land at `popularityScore: 0`, which is correct: surface them for human review.

**No hard cap on discovery.** The source-availability filter (primary + at least one secondary) is the only scope cap during discovery. Stage B handles scope tightening based on the actual results.

**Example manifest entries:**

```jsonc
[
  { "commonName": "Neon Tetra",         "scientificName": "Paracheirodon innesi",  "popularityScore": 10, "wikipediaPageviewsMonthly": 18400, "sourceCoverageCount": 4, "primarySourceUrl": "…", "secondarySourceUrl": "…" },
  { "commonName": "Cherry Shrimp",      "scientificName": "Neocaridina davidi",    "popularityScore":  9, "wikipediaPageviewsMonthly":  9200, "sourceCoverageCount": 3, "primarySourceUrl": "…", "secondarySourceUrl": "…" },
  { "commonName": "Threadfin Rainbow",  "scientificName": "Iriatherina werneri",   "popularityScore":  4, "wikipediaPageviewsMonthly":   420, "sourceCoverageCount": 2, "primarySourceUrl": "…", "secondarySourceUrl": "…" },
  { "commonName": "Obscure Variant X",  "scientificName": "…",                     "popularityScore":  1, "wikipediaPageviewsMonthly":     0, "sourceCoverageCount": 2, "primarySourceUrl": "…", "secondarySourceUrl": "…" }
]
```

### Stage B — User review of discovery manifests

After Stage A commits all manifests:

- User opens each `<taxon>-<waterType>.json` and scans the popularity-sorted list.
- Trims entries below the user's threshold (or selectively).
- Opens `other-invert-review.json` and either reassigns each entry to the correct taxon, accepts as legitimate `other-invert`, or drops.
- Manifests are committed in their trimmed/approved form. No agent activity during this gate.

The approved manifests are the input to Stage C.

### Stage C — Per-species research

Each entry in the approved manifests becomes one research agent's task, alongside the legacy placeholder files from Section 5.

**Dispatch model:**

- One agent per species, via `superpowers:dispatching-parallel-agents`.
- Batch size: ~10 species per wave, parallel within the wave, sequential across waves.
- Order: highest `popularityScore` first within each manifest, legacy placeholders interleaved. Validates the agent playbook on well-documented species before tackling obscure ones.
- Checkpoint: commit after each wave for reviewable, surgically-revertible history.

**Agent inputs (every dispatch identical):**

1. Target entry: either a legacy placeholder file OR an approved discovery manifest row.
2. `src/species-schema/species.schema.json`.
3. `src/species-schema/enums.json`.
4. The source whitelist.
5. The research-and-write playbook (below).

### Research-and-write playbook

```
0. Identify input mode.
   - Legacy placeholder mode: input is an existing src/species/<taxon>/<slug>.json
     file with dataStatus="placeholder". File path, id, slug, kind, taxon,
     waterType, commonName are already set.
   - Manifest mode: input is a row from a discovery manifest with
     {commonName, scientificName, primarySourceUrl, secondarySourceUrl, taxon}.
     A new species file must be created. Generate:
       - slug from commonName (kebab-case)
       - id using new prefix scheme: <watertype>-<taxon-short>-NNN
         (read existing IDs in the slice to pick the next NNN)
       - kind from taxon (fauna or flora)

1. Identify species precisely.
   Use scientificName if non-empty; else fuzzy-match commonName via FishBase
   / AlgaeBase taxonomy. Confirm correct species before proceeding.

2. Fetch primary source.
   - Manifest mode: use primarySourceUrl from the manifest row directly.
   - Legacy placeholder mode: look up the primary source for this taxon/waterType
     from the whitelist and fetch its species page.
   Extract all schema fields it can fill.

3. Cross-source verification (mandatory).
   - Manifest mode: fetch secondarySourceUrl from the manifest row.
   - Legacy placeholder mode: fetch the first secondary source from the
     whitelist for this taxon/waterType.
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

4a. If you encounter a fact you can't fit into any existing field:
    - ALWAYS put the fact itself into careNotes so it isn't lost.
    - IF the fact felt like it deserved its own typed field (not just prose),
      ALSO append a suggestion to src/species-build/field-gap-suggestions.jsonl
      describing the suggested field, type, reason, and value for this species.
    - DO NOT invent new top-level fields or variant-block fields in the species
      file itself — the validator will reject them.

5. Write the species JSON file.
   - Path: src/species/<taxon>/<slug>.json
   - dataStatus = "researched" (or "needs_review" per step 3)
   - sources.primary set with name/url/accessedDate
   - additional sources used, cap at 5
   - lastReviewed = today

6. Local validate.
   Run `npm run validate -- src/species/<taxon>/<slug>.json`.
   On failure: read error, correct entry, re-validate.
   Bounded at 3 retries — beyond that, dataStatus = "needs_review",
   include validator error in a note, return for human review.

7. Return path to written file + 1-sentence summary including any flags.
```

### Source whitelist

| Taxon / waterType | Primary | Secondary candidates |
|---|---|---|
| Fish — freshwater | **Aquarium Co-Op** | SeriouslyFish, FishBase, Practical Fishkeeping |
| Fish — saltwater | **LiveAquaria care guides** | Reef2Reef wiki, FishBase, Bluezooaquatics |
| Crustacean — freshwater | **Aquarium Co-Op** | The Shrimp Farm, Flip Aquatics, Practical Fishkeeping |
| Crustacean — saltwater | **LiveAquaria care guides** | Reef2Reef wiki, Bluezooaquatics |
| Coral (saltwater only) | **WWC (World Wide Corals) care sheets** | Reef2Reef wiki, Bulk Reef Supply guides, LiveAquaria |
| Mollusc — freshwater | **Aquarium Co-Op** | The Shrimp Farm (snail section), Practical Fishkeeping |
| Mollusc — saltwater | **LiveAquaria care guides** | Reef2Reef wiki |
| Echinoderm — saltwater | **LiveAquaria care guides** | Reef2Reef wiki, Bulk Reef Supply guides |
| Other invertebrate | **LiveAquaria** (saltwater) / **Aquarium Co-Op** (freshwater) | Reef2Reef wiki, taxon-specific specialist sites |
| Plant — freshwater | **Buce Plant** | Tropica, 2HR Aquarist, AquariumPlants.com |
| Plant — saltwater | **AlgaeBase** | Reef2Reef macroalgae wiki, ReefCleaners |
| Macroalgae (saltwater) | **AlgaeBase** | ReefCleaners, Bulk Reef Supply guides, Reef2Reef wiki |

Universal taxonomy / scientific-name fallback: **FishBase** (animals), **AlgaeBase** (algae/marine plants), **iNaturalist** (general).

### Review workflow

After each wave:

1. CI runs `npm run validate` across the tree. Hard fail blocks merge.
2. User scans `git diff src/species/` for the wave (~10 files; quick visual sanity check of prose and flagged discrepancies).
3. `dataStatus: "needs_review"` entries are listed in the wave summary. User either corrects in-place and bumps to `"researched"`, or kicks back to a single re-research agent with extra context.
4. For trusted waves, user may optionally bump `dataStatus` to `"reviewed"` and set `lastReviewed`. Separate sweep, not part of the agent workflow.

### Handling info that doesn't fit the schema

Two cases that come up during research:

**1. Species-specific quirks (one-offs).** A single species has an important fact that no schema field captures (e.g., a notorious jumper, an unusual photosensitivity, a rare disease susceptibility). These go into `careNotes` — that field is intentionally free-form prose for exactly this purpose. No new mechanism needed. The bar for promoting a fact to a typed field is **not** "this is important"; it's "this applies to many species and drives a real filtering or comparison need." One-offs stay in prose.

**2. Cross-species patterns that hint at a real schema gap.** Multiple agents independently encounter a fact that would be cleaner as a typed field than as prose. This is signal the schema is missing something useful — but only if it's a real pattern, not a coincidence.

To surface these without letting agents fork the schema unilaterally:

- **Agents may not invent new species-file fields.** Anything outside the schema goes into `careNotes` only. The validator hard-rejects unknown top-level fields and unknown variant-block fields.
- **Agents may append to a shared field-gap log** when they encounter a fact that felt like it deserved its own field:

  ```
  src/species-build/field-gap-suggestions.jsonl   # append-only, one suggestion per line
  ```

  Each line:
  ```jsonc
  { "species": "fw-014", "slug": "buenos-aires-tetra", "suggestedField": "plantEater",
    "suggestedType": "boolean", "reason": "Eats most live plants; planted-tank incompatible.
    Not capturable by 'diet.type: omnivore' alone.", "valueForThisSpecies": true }
  ```

- **Post-wave (or post-stage) review.** A simple summarizer script — `npm run review-field-gaps` — groups suggestions by `suggestedField`, shows counts and example reasons. User scans the output.

- **Promotion threshold: 5+ independent suggestions for the same field.** Anything below 5 stays in the log as advisory noise; those species' info already lives in their `careNotes`. At 5+, it's a real signal worth schema-promoting.

**Promotion process** when a gap clears the threshold:

1. Bump `schemaVersion` from 1 to 2 (and so on).
2. Add the field to `species.schema.json` as nullable. Existing entries don't need re-research — they're still valid.
3. Add any new enum values to `enums.json`.
4. Optionally, kick off a small re-research wave for the suggesting species to upgrade `careNotes` content into the new structured field. Optional because entries remain valid without it.

### Out of scope (deferred)

- **Image curation.** R2 buckets currently cover the legacy species. Newly discovered species will land with `media.primaryImage: null`; sourcing/uploading images for them is a separate workstream. The schema's `dataStatus` ladder accepts this — researched entries can have a null primary image.
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
| Migration script mis-infers `taxon` for a legacy species | Keyword heuristic produces a draft; entries are `dataStatus: "placeholder"` so post-migration manual taxon correction is a one-field edit (file moves between taxon folders if needed). Worth a sanity-scan after Phase 1 before population begins. |
| Source whitelist proves wrong over time | Whitelist is editable in the spec; agent playbook reads it as input. Change in one place. |
| Frontend can't render new fields | Acceptable; frontend rework is the next overhaul step after this foundation lands. |
| Discovery surfaces more candidates than expected (e.g., 2,000+ across all slices) | Stage B user review is the explicit checkpoint to trim. Manifests are sorted by `popularityScore` desc, so low-confidence entries cluster at the bottom for easy trimming. |
| Wikipedia coverage is sparse for a taxon (corals, macroalgae, niche inverts) | Affected entries get `popularityScore: 0`. That's the correct signal — surfaces them prominently for user review rather than burying them. User can still keep entries scored 0 if they're known to be hobby-relevant despite Wikipedia silence. |
| Discovery agent misclassifies taxon for a candidate | Routed to `other-invert-review.json` instead of auto-classified. User reassigns during Stage B. |
| Source index page structure changes mid-discovery (site redesign) | Agent reports failure for that slice; user re-runs discovery for the affected slice after the agent prompt is updated. Slices are independent, so one failure doesn't block others. |
| Schema is missing a field that turns out to be broadly important | Field-gap log (Section 6) accumulates suggestions per agent. Promotion to a real field requires 5+ independent suggestions to avoid premature schema bloat. Schema is `additionalProperties: false`, so agents can't quietly invent fields in the meantime. |
| Agents lose important info because no field fits | Playbook step 4a mandates that any unfit fact goes into `careNotes` at minimum. Schema is open-prose-friendly on purpose. |

## Implementation order (high-level — detailed plan to follow)

1. Schema + enums + validator (Section 4 tooling).
2. Migration script (Section 5, Phase 1) — produces legacy placeholder files.
3. Worker cutover + legacy file deletion (Section 5, Phase 2).
4. Smoke verification (Section 5, Phase 3).
5. **Stage A: Discovery + popularity enrichment** — parallel discovery agents across all 7 catalogued taxa; emits sorted manifests.
6. **Stage B: User review** — user trims manifests, reassigns `other-invert-review` entries. No agent activity.
7. **Pilot research wave** — ~10 highest-popularityScore species from the approved manifests + a few legacy placeholders; validates the agent playbook end-to-end before scaling.
8. **Stage C: Remaining research waves** — continue until every legacy placeholder and approved discovered candidate is `"researched"` (or flagged `"needs_review"`).

A detailed implementation plan with task breakdown, parallelizability, and verification steps will be produced via the `superpowers:writing-plans` skill once this spec is approved.
