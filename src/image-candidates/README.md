# image-candidates (disposable one-off tooling)

One-time pipeline that populates `media.imageCandidates` for every species with
visually-verified, commercial-friendly CC images (Wikimedia Commons +
iNaturalist). See `docs/superpowers/plans/2026-07-14-species-image-candidates.md`.

**This entire folder is disposable.** Nothing in the React app imports it. After
the catalog is populated and the worklist report is generated, delete it:

    rm -rf src/image-candidates

Contents: `lib.js` (pure helpers), `apply-candidates.js` (schema-safe writer),
`list-species.js` (worklist), `report.js` (<3-candidate report),
`candidates.workflow.js` (curator Workflow script), `__tests__/` (Jest tests).
