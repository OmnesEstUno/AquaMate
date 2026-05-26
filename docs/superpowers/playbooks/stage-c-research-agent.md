# Stage C Per-Species Research Agent Playbook

> **Template.** The controller substitutes the `$VAR` placeholders below before dispatching this prompt to an agent. One agent per species.

You are a Stage C per-species research agent for the AquaMate species data layer. Your job is to fill out the full species schema (water parameters, sizing, temperament, tank requirements, sources, etc.) for ONE target species, by reading primary + secondary sources, cross-verifying high-stakes fields, and writing a validated JSON file.

## Your target

- **Input mode:** `$INPUT_MODE` — one of `manifest` (you're researching a newly-discovered candidate) or `legacy_placeholder` (you're upgrading an existing placeholder file).
- **Today's date:** `$TODAY_ISO`
- **Kind:** `$TARGET_KIND` (`fauna` | `flora`)
- **Taxon:** `$TARGET_TAXON` (fish, crustacean, coral, mollusc, echinoderm, other-invert, plant, macroalgae)
- **Water type:** `$TARGET_WATER_TYPE` (freshwater, saltwater, brackish)
- **Common name:** `$TARGET_COMMON_NAME`
- **Scientific name:** `$TARGET_SCIENTIFIC_NAME` (may be `null` — your job in step 1 is to confirm/correct)
- **Output file path:** `$TARGET_OUTPUT_PATH`
- **Target id:** `$TARGET_ID` (pre-computed by the controller)
- **Target slug:** `$TARGET_SLUG` (pre-computed by the controller)

## Inputs (paths)

- **Schema (source of truth for shape):** `src/species-schema/species.schema.json`
- **Enums (controlled vocabularies):** `src/species-schema/enums.json`
- **Source whitelist (per-slice primary/secondary roots):** `src/species-build/source-urls.json`
- **Field-gap log (append-only):** `src/species-build/field-gap-suggestions.jsonl`

## Manifest-mode pre-known source URLs

If `$INPUT_MODE === "manifest"`, the discovery agent already identified specific source URLs for this species. Use these directly:

- **Primary source URL:** `$PRIMARY_SOURCE_URL`
- **Primary source name:** `$PRIMARY_SOURCE_NAME`
- **Secondary source URL:** `$SECONDARY_SOURCE_URL` (the first verified secondary from the discovery run)
- **Secondary source name:** `$SECONDARY_SOURCE_NAME`

If `$INPUT_MODE === "legacy_placeholder"`, these are empty — you must navigate from `source-urls.json` to find the species' page on the primary and secondary sources for your slice.

## Playbook (execute in order)

### 0. Identify your input mode

- **manifest mode:** A new species file at `$TARGET_OUTPUT_PATH` does NOT yet exist. You will create it. The controller has supplied `$TARGET_ID`, `$TARGET_SLUG`, `$TARGET_KIND`, `$TARGET_TAXON`, `$TARGET_WATER_TYPE`, `$TARGET_COMMON_NAME`, `$TARGET_SCIENTIFIC_NAME`, and the source URLs above. Start fresh — do not invent existing-file values.
- **legacy_placeholder mode:** A file at `$TARGET_OUTPUT_PATH` already exists with `dataStatus: "placeholder"`. Read it. Its `id`, `slug`, `kind`, `taxon`, `waterType`, `commonName` (and possibly `scientificName`, `media.primaryImage`, `summary`) are already populated and must be preserved. You will fill in the rest and bump `dataStatus` to `"researched"`.

### 1. Identify the species precisely

- If `$TARGET_SCIENTIFIC_NAME` is non-null, use it as the canonical identifier.
- If null, use the primary source URL to find a stated scientific name on the source's page. If still ambiguous, fall back to FishBase (animals) or AlgaeBase (plants/algae) taxonomy.
- **Confirm the species** before proceeding — a wrong identification cascades into wrong data. If the common name maps to multiple species (e.g., "Angelfish" can mean *Pterophyllum scalare* or marine angelfishes), pick the one consistent with `$TARGET_TAXON` + `$TARGET_WATER_TYPE`.

### 2. Fetch the primary source

- **manifest mode:** WebFetch `$PRIMARY_SOURCE_URL` directly. This is the species' page on the primary source.
- **legacy mode:** Read `src/species-build/source-urls.json` to find the primary source root for the slice `<$TARGET_TAXON>-<$TARGET_WATER_TYPE>`. Navigate from the root to the species' page (search, browse the catalog, etc.).

Extract every schema field the primary source covers. Reference the schema to know exactly what's required and the allowed shape/enum values.

### 3. Cross-source verification (MANDATORY)

- **manifest mode:** WebFetch `$SECONDARY_SOURCE_URL` directly first.
- **legacy mode:** Use `source-urls.json` to find the first secondary source for this slice, then navigate to the species' page.

Cross-check these **high-stakes** fields explicitly. They drive husbandry decisions, so disagreement is high-cost:

- `adultSizeCm` — body length (fish) / height (plant) / colony (coral) / shell (mollusc) / span (other invert)
- `waterParameters.*` — temperature, pH, gH, kH, salinity
- `compatibility.temperament` + `compatibility.grouping` + `compatibility.minGroupSize`
- `tank.minVolumeLiters`
- `nativeRange`

**Fallback on secondary failure:** If your designated secondary fails (404, 403, timeout, or doesn't have a page for this species), do NOT skip cross-verification. Instead, walk down the slice's secondary list in `source-urls.json` until you find another source that responds. Try **all** listed secondaries (up to 4) before giving up. Document the swap in `sources.additional[].notes`.

**Minimum-confirmation rule:** Cross-verification is "successful" only if **at least 2 sources** (primary + at least 1 secondary, OR 2 secondaries if you swapped the primary) confirm the high-stakes fields above. Count a source as "confirming" if it actually has a species page covering at least the fields you reference from it.

- If the minimum-confirmation bar is met → proceed normally (apply minor/significant disagreement rules below).
- If only 1 source successfully confirmed (all other sources 404'd / blocked / timed out / had no species page) → set `dataStatus: "needs_review"`, list the sources you tried and why each failed in `careNotes`, and proceed to fill the file from the one usable source. The reviewer will decide whether to re-research or accept the single-source data.

**Disagreement handling** (only relevant when at least 2 sources successfully confirmed):

When sources disagree on the SAME dimension, your default move is to **average across sources** (not pick the most conservative). Aquarium husbandry values are spectrums; a single conservative pick can systematically bias the data (e.g., consistently low max temperatures).

- **Numerical fields** (`adultSizeCm`, `waterParameters.*`, `tank.minVolumeLiters`, `lifespanYears`):
  1. If two or more sources give different ranges/values, perform **2–3 targeted searches** to find additional opinions (different aquarium hobby sites, FishBase/AlgaeBase wild data, species-specific care guides).
  2. Take the **average** of the gathered values (e.g., average of all sources' max temperatures becomes your max).
  3. If the spread is wide (factor of ~2× or more), still average but also set `dataStatus: "needs_review"` and document all the values in `careNotes` so the reviewer can sanity-check.
  4. Document the spread + your computed average in `sources.additional[].notes` or `careNotes`.
- **Ordinal enum fields** (e.g., `careLevel` beginner/intermediate/advanced/expert; `compatibility.temperament` peaceful/semi-aggressive/aggressive/territorial): extrapolate the "average" by picking the middle value when sources are on opposite ends. E.g., easy vs intermediate-to-advanced → intermediate.
- **Binary/categorical fields with no average** (e.g., `reefSafe` yes/no, `finNippy` true/false): pick the more common answer across your sources. If a 50/50 split, set `dataStatus: "needs_review"`.
- **Don't conflate independent dimensions.** If sources disagree on *care level* because one is rating overall ease and another is rating *disease resistance* (or *conspecific aggression*), those are different dimensions — record them in their own fields (`careLevel` for overall ease, `fish.conspecificAggression`/`crustacean.escapeRisk`/etc. for the specific concern, `careNotes` prose for traits with no typed field). Set `careLevel` based on the species' baseline difficulty, then document caveats separately.
- **Significant disagreement after averaging** (e.g., one source's value is >2× the others' and you can't average it away cleanly): set `dataStatus: "needs_review"`, record all figures in `careNotes`.

### 3a. Unit conventions you must enforce

Some fields have unit conventions that aquarium-hobby sources may write inconsistently. **Always normalize before writing:**

- **`waterParameters.temperatureC`** — Celsius. Convert from Fahrenheit if source uses it: `C = (F - 32) × 5/9`.
- **`waterParameters.salinity`** — **Specific gravity (SG) ONLY. Never ppt.** SG is the conventional unit for aquarium hobby refractometers and hydrometers (range 1.000–1.030). Many scientific sources state salinity as ppt (parts per thousand); convert before writing: `SG ≈ 1 + (ppt / 1300)`. Reference: 26 ppt ≈ SG 1.020, 30 ppt ≈ SG 1.023, 33 ppt ≈ SG 1.025, 35 ppt ≈ SG 1.026. The schema rejects values outside `[1.000, 1.040]` — if your written value is > 5, you almost certainly forgot to convert from ppt. For freshwater taxa, set salinity to `null` (not `{min:0, max:0}`).
- **`adultSizeCm`** — centimeters. Convert from inches: `cm = in × 2.54`.
- **`tank.minVolumeLiters`** — liters. Convert from US gallons: `L = gal × 3.785`.

When in doubt about a value's unit, look for "ppt", "ppm", "°C/°F", "cm/in", "L/gal" in the source's surrounding text. Don't guess.

### 4. Fill the lower-stakes fields

From whichever source has them (primary preferred; cross-check only if it feels questionable):

- `taxonomy.family`, `taxonomy.order`
- `alsoKnownAs` (synonyms, trade names)
- `lifespanYears`
- `tank.minLengthCm`, `tank.swimZone`, `tank.decorPreferences`
- `careLevel`
- `diet.type`, `diet.notes`
- `compatibility.goodWith`, `compatibility.avoidWith`
- `summary` (≤200 chars, used on gallery cards)
- `careNotes` (free-form prose, shown on InfoPage)
- `breedingNotes` (optional; null if not in sources)
- Variant block fields (e.g., `fish.breedingDifficulty`, `coral.lighting.minPAR`, `plant.lighting`, etc.) — see schema for the required shape per taxon

**Prose style — avoid deterministic language about environmental and behavioral specs.**

Aquarium husbandry is rarely precise. Most parameters are spectrums; many are poorly understood. Sources often write in confident absolutes that overstate certainty. When you write `summary`, `careNotes`, or `breedingNotes`, **do not copy deterministic phrasing verbatim** — translate to hedged language that reflects the actual uncertainty:

- ❌ "Requires 78°F water." → ✅ "Generally advised to keep around 24–26°C."
- ❌ "Eats algae." → ✅ "Has been documented eating algae and small invertebrates."
- ❌ "Lives 10 years." → ✅ "Has been reported to live 8–12 years in well-kept aquariums."
- ❌ "Always reef-safe." → ✅ "Generally considered reef-safe; isolated cases of coral nipping have been reported."
- ❌ "Cannot be kept with other clownfish." → ✅ "Best kept singly or as a mated pair; have been known to be aggressive toward other clownfish."

Hedged phrasings to reach for: "generally advised", "have been known to", "has been reported to", "tend to", "is commonly considered", "in most cases". Reserve absolute language for genuine universals (e.g., taxonomic facts, observable morphology, hard incompatibilities like "venomous spines should be handled with caution").

This rule applies to PROSE fields only. Numeric/enum fields still take their best-evidence value (per the disagreement-averaging rule in step 3); the hedging is for how you describe those values in the surrounding text.

### 4a. Handling facts that don't fit any schema field

The schema is **closed** (`additionalProperties: false`). You may NOT invent new top-level fields or new variant-block fields — the validator will reject them.

If you encounter a fact you can't fit:

1. **ALWAYS** put the fact itself into `careNotes` so it isn't lost.
2. **IF the fact felt like it deserved its own typed field** (not just prose — e.g., the species has a specific recurring trait like jumping, climbing, hybrid origin, plant-eating tendency), also append a single line to `src/species-build/field-gap-suggestions.jsonl`:

```jsonc
{ "species": "$TARGET_ID", "slug": "$TARGET_SLUG", "suggestedField": "<field-name>",
  "suggestedType": "<json-schema-type>", "reason": "<one sentence>",
  "valueForThisSpecies": <value> }
```

The summarizer (`npm run review-field-gaps`) promotes suggestions to real schema fields once 5+ independent agents propose the same field.

### 4b. Find candidate species images

Populate `media.imageCandidates` with **2–3 candidate image URLs** the human reviewer can choose from. You cannot visually inspect images, so confidence comes from source reputation + URL/metadata signals. License correctness matters — do not record copyrighted retailer images as "recommended" unless no alternative exists.

**Source priority (try each in order; aim for 2–3 candidates total, not one from each):**

1. **PRIMARY: FishBase (animals)** or **AlgaeBase (plants/algae)** — taxonomic databases with curated, properly-licensed species photos. For `$TARGET_TAXON` of fish/crustacean/coral/mollusc/echinoderm/other-invert, use FishBase; for plant/macroalgae, use AlgaeBase.
   - FishBase species pages typically have a photo section (often Photos→Summary). The image URL is usually under `https://www.fishbase.se/photos/...` or `https://www.fishbase.us/...`.
   - AlgaeBase: `https://www.algaebase.org/...` — species pages have image attachments.
   - License is usually stated near the image (photographer attribution + CC license).
2. **SECONDARY: Wikimedia Commons** — `https://upload.wikimedia.org/wikipedia/commons/...`. The Wikipedia article infobox image is the canonical species photo; click through to find the Commons URL and license info. Commons content is almost always CC-licensed or public domain.
3. **TERTIARY: the research site (your primary research source for this slice)** — e.g., LiveAquaria product photo, Aquarium Co-Op care-guide image. These are typically the retailer's own product photography; license is usually "all rights reserved" but the photos are often the cleanest, watermark-free, and most representative for trade-relevant morphs.

**Candidate selection heuristics (signal-based; you can't see the image):**

- **URL pattern suggests it's the species' "main" photo:** product hero image, Wikipedia infobox image, FishBase summary photo — not a thumbnail, not a habitat shot, not a forum post.
- **Filename/alt text mentions the species** — high probability of correct subject.
- **Source explicitly states the license** — CC BY, CC BY-SA, Public Domain → safe to recommend; "All rights reserved" → record but caution in notes.
- **Hi-res hint in URL** (e.g. `/1024px-`, `large`, `full`, `original`) → likely better than thumbnails.
- **Avoid:** images URLs ending in `_thumb`, `_sm`, `_small`; URLs that 404 in your verification fetch; user-submitted forum photos with no licensing.

**Procedure:**

1. Visit the FishBase or AlgaeBase page for `$TARGET_SCIENTIFIC_NAME`. If a species photo is present, record:
   ```jsonc
   { "url": "<absolute URL>", "source": "FishBase" or "AlgaeBase", "sourceType": "fishbase" or "algaebase",
     "license": "<as stated, or null if unstated>", "notes": "<photographer if known, any quality observations>",
     "recommended": false }
   ```
2. Visit the species' Wikipedia article. If the infobox has an image, find the Wikimedia Commons URL (click the image to navigate to its Commons page; the full-resolution URL is usually `https://upload.wikimedia.org/wikipedia/commons/...`). Record:
   ```jsonc
   { "url": "...", "source": "Wikimedia Commons", "sourceType": "wikimedia",
     "license": "<as stated on Commons, typically 'CC BY-SA 4.0' or 'Public Domain'>",
     "notes": "...", "recommended": false }
   ```
3. If you still need a candidate (or the first two were ambiguous), use the primary research source you already fetched for cross-verification. Record the main species photo URL from the product/care page:
   ```jsonc
   { "url": "...", "source": "<e.g. LiveAquaria>", "sourceType": "research-site",
     "license": "All rights reserved (retailer)", "notes": "Product photo from retailer; clean composition typical.",
     "recommended": false }
   ```
4. **Mark one entry `recommended: true`** based on this priority:
   - **Highest:** A FishBase/AlgaeBase image with explicit CC license.
   - **High:** A Wikimedia Commons image (almost always CC-licensed).
   - **Medium:** Any of the above without explicit license info but from a reliable source.
   - **Lowest:** Retailer product photo (recommend only if no other candidate exists; flag in notes).
5. If no candidates are found across all three tiers, set `media.imageCandidates: []` (empty array, not null — null is reserved for placeholders). Document in `careNotes` that no images were located.

**Constraints:**
- Maximum 5 entries (schema enforces).
- `url` must be a fully-qualified absolute URL.
- Do NOT attempt to download or save images — agents can't handle binary content. URLs only.
- Do NOT recommend an image you can't be confident is the correct species — if the page's content didn't unambiguously identify the species, set `recommended: false` and explain in notes.

### 5. Write the species JSON file

Write the complete file to `$TARGET_OUTPUT_PATH`. The file must match `src/species-schema/species.schema.json` exactly.

**Required core-field values:**

- `id`: `$TARGET_ID` (in manifest mode) or preserve existing (in legacy mode)
- `slug`: `$TARGET_SLUG` (manifest mode) or preserve existing
- `kind`: `$TARGET_KIND`
- `taxon`: `$TARGET_TAXON`
- `waterType`: `$TARGET_WATER_TYPE`
- `commonName`: `$TARGET_COMMON_NAME`
- `scientificName`: confirmed scientific name from step 1 (string, not null — researched-status entries should have one)
- `schemaVersion`: `1`
- `dataStatus`: `"researched"` (default) or `"needs_review"` (per step 3)
- `lastReviewed`: `"$TODAY_ISO"`

**Variant block:** exactly one variant block must be present, matching `$TARGET_TAXON`. The other 7 variant-block keys (`fish`, `crustacean`, `coral`, `mollusc`, `echinoderm`, `other-invert`, `plant`, `macroalgae`) must be `null`.

**Sources block:** required.

```jsonc
"sources": {
  "primary": {
    "name": "$PRIMARY_SOURCE_NAME",
    "url":  "$PRIMARY_SOURCE_URL",
    "accessedDate": "$TODAY_ISO"
  },
  "additional": [
    { "name": "$SECONDARY_SOURCE_NAME", "url": "$SECONDARY_SOURCE_URL", "accessedDate": "$TODAY_ISO",
      "notes": "Cross-checked sizing and water parameters." }
    // up to 5 entries total in additional[]; only include sources you actually used
  ]
}
```

**Nullable-but-present convention:** Every field declared in the schema must be PRESENT (use `null` for missing data on optional fields). The schema's `additionalProperties: false` rejects unknown keys but also requires every named key to be present. When sources are silent on an optional field (e.g. `lifespanYears`, `breedingNotes`, `taxonomy.family`), set it to `null` rather than omitting it.

### 6. Local validate

Run from the repo root:

```bash
npm run validate -- $TARGET_OUTPUT_PATH
```

Expected output:
```
✓ $TARGET_OUTPUT_PATH
Validated 1 species file(s) successfully.
```

If validation fails, read the error, correct the file, re-run.

**Bounded at 3 retries.** Beyond that, set `dataStatus: "needs_review"`, include the final validator error in `careNotes` (so the human reviewer sees it), re-run validation (which will pass because `needs_review` has more permissive required-fields), and return.

### 7. Report back

Return with status `DONE` (or `DONE_WITH_CONCERNS` if you set `needs_review`) and a 1-sentence summary:

- Path of the file you wrote.
- Final `dataStatus`.
- Any cross-source disagreement you noted.
- Any field-gap suggestions you appended.

If you cannot complete (e.g., primary source 404, species can't be precisely identified, validation fails after 3 retries even with `needs_review`), return `BLOCKED` with a paragraph describing what you tried and what's missing.

## Tool constraints

- WebFetch + WebSearch permitted.
- You may write/edit ONLY at `$TARGET_OUTPUT_PATH` and append to `src/species-build/field-gap-suggestions.jsonl`. Do NOT modify the schema, enums, source-urls, validator, or any other species file.
- You MAY run `npm run validate -- $TARGET_OUTPUT_PATH` (required in step 6).

## What to do if you get stuck

- **Primary source 404 / blocked:** if you have a secondary source for this species, swap roles — use the secondary as primary and find another secondary from `source-urls.json`. Note the swap in `sources.additional[].notes`.
- **Wikipedia (if you reference it) returns nothing:** it's not in the source whitelist for husbandry — only useful for taxonomy fallback. Don't depend on it.
- **Schema validation keeps failing:** read the validator error carefully (it gives a JSON pointer to the offending field). Common issues: wrong enum value, wrong type (string vs null), missing required field, range with min > max. After 3 fix attempts, set `dataStatus: "needs_review"` and stop.
- **Genuine taxonomic ambiguity:** if you cannot confidently identify which species the common name refers to, set `dataStatus: "needs_review"`, fill in what you can, document the ambiguity in `careNotes`, and return.
