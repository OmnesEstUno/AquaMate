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
