# Stage A2 Enrichment Agent Playbook

> **Template — Pass 2 of two.** This agent takes a CHUNK of candidates from a Pass 1 acquisition file and does the expensive per-candidate work: cross-source verification, Wikipedia enrichment, scoring. Output: a chunk file with verified entries (and a separate misfits chunk). The controller merges chunks into the final manifest.

You are a Stage A2 enrichment agent for the AquaMate species data layer. You take a slice of candidate species (already acquired by Pass 1) and verify each one against secondary sources + Wikipedia, computing popularity scores. Your output is a CHUNK file that the controller later merges with other chunks into the final manifest.

## Your assignment

- **Slice:** `$SLICE_KEY`
- **Taxon:** `$TAXON`
- **Water type:** `$WATER_TYPE`
- **Today's date:** `$TODAY_ISO`
- **Chunk index:** `$CHUNK_INDEX` (0-based)
- **Candidates in your chunk:** `$CHUNK_SIZE` items — these are the candidates from Pass 1 you must process. The list is embedded below.

## Your candidates

```json
$CHUNK_CANDIDATES_JSON
```

Each entry has `{commonName, scientificName, primarySourceUrl, taxonFitConfidence}`. Process every candidate in this list — do not skip any (no soft cap at this stage; the controller already applied the slice-level cap when chunking).

## Secondary sources (try in this order on each candidate)

```json
$SECONDARY_SOURCES_JSON
```

## Output

Write `$OUTPUT_CHUNK_PATH`. This is a chunk file, not a complete manifest. Shape:

```jsonc
{
  "meta": {
    "chunkIndex": $CHUNK_INDEX,
    "chunkSize": $CHUNK_SIZE,
    "slice": "$SLICE_KEY",
    "taxon": "$TAXON",
    "waterType": "$WATER_TYPE",
    "enrichmentDate": "$TODAY_ISO"
  },
  "confident": [
    // entries with taxonFitConfidence "high" or "medium" that survived verification
    // each entry follows manifest.schema.json's entry shape exactly
  ],
  "other": [
    // entries with taxonFitConfidence "low" (taxon misfits)
    // also follows manifest.schema.json's entry shape
  ]
}
```

Sort `confident` and `other` arrays by `popularityScore` descending (ties broken by `commonName` ascending).

## Playbook (execute in order)

### 1. Read the candidates

Your `$CHUNK_CANDIDATES_JSON` is embedded above. Iterate through them.

### 2. Per-candidate cross-source verification

For each candidate:

- Try secondary sources in the order given in `$SECONDARY_SOURCES_JSON`.
- For each secondary, attempt to find a species page for the candidate (search by `scientificName` if available, else `commonName`).
- Record `secondarySourceUrl` from the **first** secondary that confirms the species exists.
- Count `sourceCoverageCount` = 1 (primary) + number of secondaries (out of up to 4 tried) that have a page for this species.
- **If no secondary confirms the candidate, drop it.** Don't include it in either output array.

**Cap your check at the first 4 secondaries per candidate** (matches the source list size). Stop early on a candidate once you've found at least one confirming secondary — you don't need to check the rest unless you want a higher `sourceCoverageCount`.

**Token efficiency:** Aim for ~3 secondary fetches per candidate on average. Don't exhaustively search every secondary for every candidate.

### 3. Wikipedia enrichment

For each candidate that survived step 2:

- Try Wikipedia article lookup by `scientificName` first, then by `commonName`. Use English Wikipedia (`en.wikipedia.org`).
- Record `wikipediaUrl` (or `null` if no article exists for either query).
- If an article exists:
  - Fetch the Wikimedia pageviews REST endpoint:
    ```
    GET https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/en.wikipedia/all-access/all-agents/<URL-ENCODED-TITLE>/monthly/<START>/<END>
    ```
    where `<START>` is 12 calendar months before `$TODAY_ISO` (formatted `YYYYMMDD00`) and `<END>` is `$TODAY_ISO` (formatted `YYYYMMDD00`).
  - Compute `wikipediaPageviewsMonthly` as the mean of the returned `views` (round to nearest integer; if fewer than 12 months returned, average what's available).
  - Skip `wikipediaArticleSizeBytes` for this pass — set it to `null`. (It's not load-bearing for popularity scoring and adds an extra API call per candidate; the schema accepts null.)

### 4. Compute popularityScore

```javascript
function popularityScore(wikipediaPageviewsMonthly, wikipediaUrl, sourceCoverageCount) {
  if (wikipediaUrl === null) return 0;
  const pv = Math.max(1, wikipediaPageviewsMonthly);
  const pageviewsPoints = Math.min(5, Math.floor(Math.log10(pv)));
  const sourcePoints   = Math.min(5, sourceCoverageCount);
  return Math.max(0, Math.min(10, pageviewsPoints + sourcePoints));
}
```

### 5. Build each entry per `manifest.schema.json`

Each output entry has these 11 fields (all required by the manifest schema):

```jsonc
{
  "commonName":                "..." ,                // from candidate
  "scientificName":            "..." or null,         // from candidate (may have been updated during verification)
  "popularityScore":           <0-10 integer>,        // from step 4
  "wikipediaUrl":              "..." or null,         // from step 3
  "wikipediaPageviewsMonthly": <integer >=0>,         // from step 3, default 0 if no article
  "wikipediaArticleSizeBytes": null,                  // skipped in Pass 2 (see note in step 3)
  "sourceCoverageCount":       <integer 1..10>,       // from step 2
  "primarySourceUrl":          "...",                  // from candidate
  "secondarySourceUrl":        "...",                  // from step 2's first confirming secondary
  "taxonFitConfidence":        "high" | "medium" | "low",   // from candidate
  "notes":                     "..." or null          // free text — disagreements, anomalies, taxonomic notes
}
```

### 6. Partition

- Entries with `taxonFitConfidence === "low"` → `other` array.
- All other entries → `confident` array.
- Sort both arrays by `popularityScore` descending; ties broken by `commonName` ascending.

### 7. Write the chunk file

Write `$OUTPUT_CHUNK_PATH` with the shape shown in the "Output" section. Do NOT write to any other path; specifically, do NOT touch `<slice>.json` or `<slice>-other.json` — the controller assembles those from all chunks together.

### 8. Validation note

There is no `validate-chunk` script — the chunk file's `confident` and `other` entries follow `manifest.schema.json`'s entry shape but the wrapper is different (no top-level `meta` field with `dedupListSize`/`candidateCount` — that's controller-supplied at merge time). You don't need to run a validator.

### 9. Report back

Return `DONE` with:

- Chunk index + size.
- Number of entries in `confident` and `other`.
- Number of candidates dropped (no secondary confirmed).
- Any anomalies (secondaries persistently failing, Wikipedia gaps, etc.).

## Tool constraints

- WebFetch + WebSearch permitted.
- You may write ONLY to `$OUTPUT_CHUNK_PATH`.
- Do NOT modify the candidates file, the source-urls file, the manifest schema, or anything else.

## What to do if you get stuck

- **Wikipedia API errors on a single candidate:** treat as "article not found" — `wikipediaUrl: null`, `popularityScore: 0`. Don't fail the whole chunk.
- **A secondary source is persistently failing across all your candidates:** continue trying the other secondaries on the list; note the failing source in your report.
- **Out of tool budget mid-chunk:** write what you have to `$OUTPUT_CHUNK_PATH` (partial chunk) and return `DONE_WITH_CONCERNS` listing which candidates were skipped. The controller may dispatch a fix agent for the remainder.
