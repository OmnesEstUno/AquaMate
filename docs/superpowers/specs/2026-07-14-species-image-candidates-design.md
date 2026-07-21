# Species Image-Candidate Sourcing — Design

**Date:** 2026-07-14
**Status:** Approved (design), pending implementation plan
**Owner:** Kyle (reviewer/curator) · Claude (author of pipeline)

## Goal

Populate striking, well-focused, colorful, correctly-identified candidate
images for all 1696 species in the AquaMate catalog, so the reviewer can pick
the best per species, download it, and upload it to R2/KV for permanent
hosting.

The pipeline's job is to **produce and curate candidate suggestions**, not to
host final images. Final image selection and hosting is a manual downstream
step performed by the reviewer.

## Decisions (locked)

| Decision | Choice |
|---|---|
| Target field | `media.imageCandidates` (existing schema structure), full metadata per image |
| Scope | All 1696 entries; regenerate/overwrite `imageCandidates` |
| Verification | Visually verify every candidate (agent downloads and *looks at* each image) |
| License policy | Commercial-friendly only: CC0, Public Domain, CC BY, CC BY-SA. Reject NC, ND, all-rights-reserved |
| Sources | CC-only multi-source: Wikimedia Commons (primary) + iNaturalist research-grade CC (secondary) + Flickr CC (best-effort). FishBase/AlgaeBase excluded |
| Sparse case | Include only verified images (0–3). Never pad with wrong/low-confidence images. Log species with <3 for a manual worklist |
| Cost/scale | Explicitly acceptable — token/time cost is not a constraint |

## Data contract

For each species file (`src/species/<taxon>/<slug>.json`), (re)write **only**
`media.imageCandidates`. **Do not touch** `media.primaryImage` or
`media.gallery` — the 155 fish already wired to R2 must keep working, and
those fields are the reviewer's promote-to-R2 slots.

`imageCandidates` is an array of **0 to 3** objects (schema allows max 5; we
cap at 3). Each object has all six required keys:

```json
{
  "url": "https://upload.wikimedia.org/wikipedia/commons/…/Paracheirodon_innesi.jpg",
  "source": "Wikimedia Commons",
  "sourceType": "wikimedia",
  "license": "CC BY-SA 4.0",
  "notes": "Photographer: Jane Doe • 3000×2000 • sharp lateral view, strong neon stripe",
  "recommended": true
}
```

- `url` — direct URL to the full-resolution image file (not a page URL).
- `source` — human-readable source name (e.g. "Wikimedia Commons",
  "iNaturalist", "Flickr").
- `sourceType` — schema enum. Map: Wikimedia → `wikimedia`; iNaturalist →
  `research-site`; Flickr → `other`.
- `license` — exact license string (e.g. "CC0", "Public Domain",
  "CC BY 4.0", "CC BY-SA 4.0").
- `notes` — photographer/author, resolution if known, and a short phrase on
  why it was chosen or any caveat.
- `recommended` — exactly **one** candidate per species is `true` (the single
  best); the rest `false`. If the array is empty, there is no recommended.

Schema authority: `src/species-schema/species.schema.json` (`media` block,
lines ~332–360). `additionalProperties:false` throughout — no extra keys.

## Sources & licensing

**Accept only** CC0 / Public Domain / CC BY / CC BY-SA. **Reject** any
NonCommercial (NC), NoDerivatives (ND), or all-rights-reserved image.

1. **Wikimedia Commons** — primary. Open API (`commons.wikimedia.org/w/api.php`),
   no key. Query by scientific name; pull `imageinfo` with `extmetadata` for
   license (`LicenseShortName`) and author (`Artist`). `sourceType: wikimedia`.
2. **iNaturalist** — secondary. Open API (`api.inaturalist.org/v1`), no key.
   Resolve taxon by scientific name, read `taxon_photos`; keep only
   `license_code ∈ {cc0, cc-by, cc-by-sa}`. `sourceType: research-site`.
3. **Flickr Creative Commons** — best-effort top-up for rare species. No API
   key available, so web-search driven; drop if unreliable. `sourceType: other`.
4. **Excluded:** FishBase, AlgaeBase (copyrighted photos fail commercial-friendly).

**Synonym fallback:** if `scientificName` yields no accepted images, retry the
queries against each entry in `alsoKnownAs[]` (often contains prior valid
binomials).

## Visual verification loop (quality core)

Per species, one agent performs:

1. Read the species JSON → extract `scientificName`, `commonName`,
   `alsoKnownAs[]`, `taxon`.
2. Query Wikimedia + iNaturalist (Flickr best-effort) → assemble a **pool of
   ~5–8** candidates that already pass the license filter.
3. `curl` each pooled image into the scratchpad directory.
4. **`Read` each downloaded image to visually inspect it** and score against
   the rubric below.
5. Keep the best **≤3**; set exactly one `recommended: true`. Prefer variety
   (different angles/individuals) over near-duplicates.
6. `Edit` the species JSON's `media.imageCandidates` to the selected set.
7. Return structured output for the batch report.

### Verification rubric

- **Correct ID** — image depicts the stated species or a clearly-labeled
  accepted synonym. Reject mislabels, wrong genus, ambiguous subjects.
- **Clear subject** — the animal/plant is the in-focus, well-lit subject;
  not tiny/distant, not heavily obscured.
- **Striking & representative** — colorful, healthy, live specimen showing how
  the species actually looks in the hobby. Reject preserved/dead specimens,
  museum plates, and line drawings **unless nothing else exists** (then include
  with a caveat note and `recommended:false`).
- **Technical** — adequate resolution (avoid thumbnails); no heavy
  watermark/text overlay.

## Orchestration & parallelization

**Vehicle: the Workflow tool.** Deterministic fan-out, resumable via runId,
structured per-agent output, budget-aware. One agent per species. Because the
catalog is one-file-per-species, parallel agents write to distinct files and
never conflict — **no git worktrees required.**

**Phased rollout:**

1. **Pilot** — ~18 species spanning all 8 taxa (fish, plant, coral,
   crustacean, macroalgae, mollusc, echinoderm, amphibian). Reviewer inspects
   candidate quality; tune agent prompt/rubric until good.
2. **Bulk** — process the full catalog in taxon-sized chunks (fish 1147 split
   into sub-batches). Checkpoint between chunks; pause/resume as needed.
3. **Gate after each batch** — run `node src/species-build/validate.js` to
   confirm schema still passes.

**Per-agent structured output** (for the report):
`{ id, slug, taxon, candidatesWritten, sources[], recommendedUrl, flags[] }`.

**Report artifact:** after each batch, emit a list of every species that ended
with **<3** candidates (and which with **0**) as the reviewer's
manual-sourcing worklist.

### Counts (baseline)

| Taxon | Count |
|---|---|
| fish | 1147 |
| plant | 188 |
| coral | 122 |
| macroalgae | 102 |
| crustacean | 77 |
| mollusc | 27 |
| echinoderm | 22 |
| amphibian | 11 |
| **Total** | **1696** |

## Out of scope

- Downloading/hosting final images to R2/KV (manual reviewer step).
- Modifying `primaryImage`, `gallery`, or any non-`media` field.
- Frontend/gallery rendering changes.
- Schema changes (the existing `imageCandidates` shape is sufficient).

## Risks & mitigations

- **Mislabeled source images** → mitigated by mandatory visual verification.
- **Rare species with no CC image** → honest empty/partial arrays + worklist;
  never padded.
- **API rate/availability** → public high-traffic APIs; polite concurrency
  (Workflow cap ~10–14); synonym retries; resumable so partial failures don't
  lose progress.
- **Flickr without API key unreliable** → treated as best-effort top-up only,
  droppable without affecting core coverage.
- **Schema violation on write** → validate.js gate after every batch;
  `additionalProperties:false` keeps writes honest.

## Success criteria

- Every processed species has `media.imageCandidates` regenerated with only
  verified, commercial-friendly, correctly-identified images (0–3 each), one
  `recommended`.
- `primaryImage`/`gallery` untouched; `validate.js` passes for the whole
  catalog.
- A worklist of <3-candidate species is produced for manual follow-up.
