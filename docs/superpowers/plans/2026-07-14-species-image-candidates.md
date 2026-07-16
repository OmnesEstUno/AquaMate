# Species Image-Candidate Sourcing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Populate `media.imageCandidates` (0–3 visually-verified, commercial-friendly CC images) for all 1696 species by fanning out one curator agent per species over Wikimedia Commons + iNaturalist.

**Architecture:** Deterministic pure helpers (license filter, candidate builder, invariants) and a schema-safe file writer live in ONE self-contained, disposable folder (`src/image-candidates/`) and are unit-tested with Jest. A Workflow script fans out one `general-purpose` agent per species; each agent discovers CC images via open APIs, downloads and *visually inspects* each image, selects the best ≤3, then invokes the tested writer to persist only `media.imageCandidates` (never `primaryImage`/`gallery`). A report script scans the catalog for a <3-candidate manual worklist.

**Tech Stack:** Node 24 (CommonJS), `glob` v10, `ajv`/`ajv-formats` (existing), Jest (`react-scripts test`), the Workflow orchestration tool, Wikimedia Commons API, iNaturalist API.

**Spec:** `docs/superpowers/specs/2026-07-14-species-image-candidates-design.md`

---

## Disposability requirement

All new **code** lives in one folder — `src/image-candidates/` — including its own `__tests__/` subfolder and fixtures. Nothing new is added to the shared `src/species-build/` tree. When the job is done, deleting `src/image-candidates/` removes 100% of the tooling with no dangling references. The only things that live outside that folder are (a) the mutated species data files under `src/species/` (the actual deliverable) and (b) generated docs under `docs/superpowers/` (spec, plan, worklist report). This folder is placed under `src/` deliberately so `react-scripts test` discovers its tests; it is not imported by the React app, so it is never bundled.

## File Structure

Everything below is inside the single disposable folder `src/image-candidates/`:

- `lib.js` — pure helpers: `isCommercialFriendly`, `mapSourceType`, `buildCandidate`, `assertCandidateSet`. No I/O.
- `apply-candidates.js` — reads a species JSON, writes **only** `media.imageCandidates`, enforces invariants via `lib.js`. CLI + exported `applyCandidates`.
- `list-species.js` — builds a worklist (file path + identifiers) for batching. CLI + exported `buildWorklist`.
- `report.js` — scans the catalog, emits a markdown worklist of species with <3 candidates. CLI + exported `scan`/`buildReport`.
- `candidates.workflow.js` — the Workflow script (executed by the Workflow tool, not Jest): meta + per-species agent prompt + pipeline fan-out.
- `README.md` — one paragraph stating this folder is disposable one-off tooling, safe to `rm -rf` after the run.
- `__tests__/lib.test.js`, `__tests__/apply-candidates.test.js`, `__tests__/list-species.test.js`, `__tests__/report.test.js`
- `__tests__/fixtures/a.json`, `__tests__/fixtures/b.json` — a tiny 2-file species dir for the worklist test.

The writer test references two existing (non-deleted) files by relative path: `src/species-build/validate.js` (reuses `validateOne`) and `src/species-schema/__tests__/fixtures/valid-fish-researched.json` (a known-valid entry). These are read-only references, not copies.

> **Note on git:** `docs/superpowers/` is gitignored (`.gitignore:69`). Per the user's earlier decision, force-add spec/plan/report docs with `git add -f` when committing them. Code under `src/image-candidates/` is NOT ignored and commits normally.

---

## Task 0: Scaffold the disposable folder + README

**Files:**
- Create: `src/image-candidates/README.md`

- [ ] **Step 1: Create the folder and README**

Create `src/image-candidates/README.md`:

```markdown
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
```

- [ ] **Step 2: Commit**

```bash
git add src/image-candidates/README.md
git commit -m "chore(image-candidates): scaffold disposable tooling folder"
```

---

## Task 1: Pure helpers (`lib.js`)

**Files:**
- Create: `src/image-candidates/lib.js`
- Test: `src/image-candidates/__tests__/lib.test.js`

- [ ] **Step 1: Write the failing test**

Create `src/image-candidates/__tests__/lib.test.js`:

```js
const {
  isCommercialFriendly,
  mapSourceType,
  buildCandidate,
  assertCandidateSet,
} = require('../lib');

describe('isCommercialFriendly', () => {
  test.each(['CC0', 'CC0 1.0', 'Public Domain', 'CC BY 4.0', 'cc-by', 'CC BY-SA 4.0', 'cc-by-sa'])(
    'accepts %s', (l) => expect(isCommercialFriendly(l)).toBe(true)
  );
  test.each([
    'CC BY-NC 4.0', 'cc-by-nc', 'CC BY-ND 2.0', 'cc-by-nc-sa',
    'All rights reserved', '', null, undefined, 'GFDL',
  ])('rejects %s', (l) => expect(isCommercialFriendly(l)).toBe(false));
});

describe('mapSourceType', () => {
  test('wikimedia', () => expect(mapSourceType('Wikimedia Commons')).toBe('wikimedia'));
  test('inaturalist -> research-site', () => expect(mapSourceType('iNaturalist')).toBe('research-site'));
  test('flickr -> other', () => expect(mapSourceType('Flickr')).toBe('other'));
});

describe('buildCandidate', () => {
  test('normalizes to six keys', () => {
    const c = buildCandidate({ url: ' http://x/a.jpg ', source: 'Wikimedia Commons', license: 'CC BY 4.0', notes: 'n', recommended: true });
    expect(c).toEqual({
      url: 'http://x/a.jpg', source: 'Wikimedia Commons', sourceType: 'wikimedia',
      license: 'CC BY 4.0', notes: 'n', recommended: true,
    });
  });
  test('throws without url', () => expect(() => buildCandidate({ source: 'x' })).toThrow(/url/));
  test('throws without source', () => expect(() => buildCandidate({ url: 'http://x' })).toThrow(/source/));
});

describe('assertCandidateSet', () => {
  const ok = { url: 'http://x/a.jpg', source: 'Wikimedia Commons', sourceType: 'wikimedia', license: 'CC BY 4.0', notes: null, recommended: true };
  test('accepts empty', () => expect(() => assertCandidateSet([])).not.toThrow());
  test('accepts one recommended', () => expect(() => assertCandidateSet([ok])).not.toThrow());
  test('rejects more than 3', () => expect(() => assertCandidateSet([ok, ok, ok, ok])).toThrow(/at most 3/));
  test('rejects zero recommended in non-empty set', () =>
    expect(() => assertCandidateSet([{ ...ok, recommended: false }])).toThrow(/exactly one recommended/));
  test('rejects two recommended', () =>
    expect(() => assertCandidateSet([ok, { ...ok, recommended: true }])).toThrow(/exactly one recommended/));
  test('rejects non-commercial license', () =>
    expect(() => assertCandidateSet([{ ...ok, license: 'CC BY-NC 4.0' }])).toThrow(/license/));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `CI=true npx react-scripts test src/image-candidates/__tests__/lib.test.js --watchAll=false`
Expected: FAIL — `Cannot find module '../lib'`.

- [ ] **Step 3: Write minimal implementation**

Create `src/image-candidates/lib.js`:

```js
'use strict';

// Commercial-friendly only: CC0, Public Domain, CC BY, CC BY-SA.
// Reject NonCommercial (NC), NoDerivatives (ND), all-rights-reserved, GFDL, unknown.
const REJECT = /\bnc\b|\bnd\b|non[- ]?commercial|no[- ]?deriv|all rights reserved|gfdl/i;
const ACCEPT = /(^|[^a-z])(cc0|cc[- ]?by([- ]?sa)?|public domain|pdm|no known copyright)([^a-z]|$)/i;

function isCommercialFriendly(license) {
  if (!license || typeof license !== 'string') return false;
  const s = license.trim().toLowerCase();
  if (!s) return false;
  if (REJECT.test(s)) return false;
  return ACCEPT.test(s);
}

function mapSourceType(source) {
  const s = (source || '').toLowerCase();
  if (s.includes('wikimedia') || s.includes('commons')) return 'wikimedia';
  if (s.includes('inaturalist') || s.includes('inat')) return 'research-site';
  return 'other';
}

const KEYS = ['url', 'source', 'sourceType', 'license', 'notes', 'recommended'];

function buildCandidate(raw) {
  const url = (raw.url || '').trim();
  const source = (raw.source || '').trim();
  if (!url) throw new Error('candidate missing url');
  if (!source) throw new Error('candidate missing source');
  return {
    url,
    source,
    sourceType: raw.sourceType || mapSourceType(source),
    license: raw.license ? String(raw.license).trim() : null,
    notes: raw.notes ? String(raw.notes).trim() : null,
    recommended: Boolean(raw.recommended),
  };
}

function assertCandidateSet(candidates) {
  if (!Array.isArray(candidates)) throw new Error('candidates must be an array');
  if (candidates.length > 3) throw new Error(`at most 3 candidates, got ${candidates.length}`);
  const recommended = candidates.filter((c) => c.recommended);
  if (candidates.length > 0 && recommended.length !== 1) {
    throw new Error(`exactly one recommended required when non-empty, got ${recommended.length}`);
  }
  for (const c of candidates) {
    for (const k of KEYS) {
      if (!(k in c)) throw new Error(`candidate missing key: ${k}`);
    }
    if (!isCommercialFriendly(c.license)) {
      throw new Error(`non-commercial-friendly license: ${c.license}`);
    }
  }
}

module.exports = { isCommercialFriendly, mapSourceType, buildCandidate, assertCandidateSet };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `CI=true npx react-scripts test src/image-candidates/__tests__/lib.test.js --watchAll=false`
Expected: PASS — all cases green.

- [ ] **Step 5: Commit**

```bash
git add src/image-candidates/lib.js src/image-candidates/__tests__/lib.test.js
git commit -m "feat(image-candidates): license filter, candidate builder, invariants"
```

---

## Task 2: Schema-safe writer (`apply-candidates.js`)

**Files:**
- Create: `src/image-candidates/apply-candidates.js`
- Test: `src/image-candidates/__tests__/apply-candidates.test.js`

- [ ] **Step 1: Write the failing test**

Create `src/image-candidates/__tests__/apply-candidates.test.js`:

```js
const fs = require('fs');
const os = require('os');
const path = require('path');
const { applyCandidates } = require('../apply-candidates');
const { validateOne } = require('../../species-build/validate');

const VALID_FIXTURE = path.resolve(__dirname, '../../species-schema/__tests__/fixtures/valid-fish-researched.json');

function tmpCopy() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'apply-cand-'));
  const dest = path.join(dir, 'entry.json');
  fs.copyFileSync(VALID_FIXTURE, dest);
  return dest;
}

const CAND = {
  url: 'https://upload.wikimedia.org/wikipedia/commons/a/aa/Fish.jpg',
  source: 'Wikimedia Commons', license: 'CC BY-SA 4.0', notes: 'sharp lateral view', recommended: true,
};

test('writes only imageCandidates and leaves primaryImage/gallery untouched', () => {
  const file = tmpCopy();
  const before = JSON.parse(fs.readFileSync(file, 'utf8'));
  applyCandidates(file, [CAND, { ...CAND, recommended: false, url: 'https://upload.wikimedia.org/b/Fish2.jpg' }]);
  const after = JSON.parse(fs.readFileSync(file, 'utf8'));
  expect(after.media.imageCandidates).toHaveLength(2);
  expect(after.media.imageCandidates[0].sourceType).toBe('wikimedia');
  expect(after.media.primaryImage).toEqual(before.media.primaryImage);
  expect(after.media.gallery).toEqual(before.media.gallery);
  expect(validateOne(file).ok).toBe(true);
});

test('empty result writes an empty array and still validates', () => {
  const file = tmpCopy();
  applyCandidates(file, []);
  const after = JSON.parse(fs.readFileSync(file, 'utf8'));
  expect(after.media.imageCandidates).toEqual([]);
  expect(validateOne(file).ok).toBe(true);
});

test('caps at 3 candidates', () => {
  const file = tmpCopy();
  applyCandidates(file, [
    CAND,
    { ...CAND, recommended: false, url: 'https://x/2.jpg' },
    { ...CAND, recommended: false, url: 'https://x/3.jpg' },
    { ...CAND, recommended: false, url: 'https://x/4.jpg' },
  ]);
  expect(JSON.parse(fs.readFileSync(file, 'utf8')).media.imageCandidates).toHaveLength(3);
});

test('rejects a non-commercial license (throws, writes nothing)', () => {
  const file = tmpCopy();
  expect(() => applyCandidates(file, [{ ...CAND, license: 'CC BY-NC 4.0' }])).toThrow(/license/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `CI=true npx react-scripts test src/image-candidates/__tests__/apply-candidates.test.js --watchAll=false`
Expected: FAIL — `Cannot find module '../apply-candidates'`.

- [ ] **Step 3: Write minimal implementation**

Create `src/image-candidates/apply-candidates.js`:

```js
'use strict';

const fs = require('fs');
const { buildCandidate, assertCandidateSet } = require('./lib');

function applyCandidates(speciesFile, rawCandidates) {
  const data = JSON.parse(fs.readFileSync(speciesFile, 'utf8'));
  if (!data.media || typeof data.media !== 'object') {
    throw new Error(`no media object in ${speciesFile}`);
  }
  const candidates = (rawCandidates || []).slice(0, 3).map(buildCandidate);
  assertCandidateSet(candidates);
  // Only touch imageCandidates; leave primaryImage & gallery untouched.
  data.media.imageCandidates = candidates;
  fs.writeFileSync(speciesFile, JSON.stringify(data, null, 2) + '\n');
  return candidates;
}

if (require.main === module) {
  const [speciesFile, candidatesFile] = process.argv.slice(2);
  if (!speciesFile || !candidatesFile) {
    console.error('usage: node apply-candidates.js <speciesFile> <candidatesJsonFile>');
    process.exit(2);
  }
  try {
    const raw = JSON.parse(fs.readFileSync(candidatesFile, 'utf8'));
    const written = applyCandidates(speciesFile, raw);
    console.log(`Wrote ${written.length} candidate(s) to ${speciesFile}`);
  } catch (e) {
    console.error(`Failed: ${e.message}`);
    process.exit(1);
  }
}

module.exports = { applyCandidates };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `CI=true npx react-scripts test src/image-candidates/__tests__/apply-candidates.test.js --watchAll=false`
Expected: PASS — 4 tests green.

- [ ] **Step 5: Commit**

```bash
git add src/image-candidates/apply-candidates.js src/image-candidates/__tests__/apply-candidates.test.js
git commit -m "feat(image-candidates): schema-safe writer for media.imageCandidates"
```

---

## Task 3: Worklist generator (`list-species.js`)

**Files:**
- Create: `src/image-candidates/list-species.js`
- Create fixtures: `src/image-candidates/__tests__/fixtures/a.json`, `b.json`
- Test: `src/image-candidates/__tests__/list-species.test.js`

- [ ] **Step 1: Create the two fixture files**

Create `src/image-candidates/__tests__/fixtures/a.json`:

```json
{ "id": "fw-fish-900", "slug": "test-a", "taxon": "fish", "waterType": "freshwater", "commonName": "Test A", "scientificName": "Genus speciesa", "alsoKnownAs": ["Old namea"] }
```

Create `src/image-candidates/__tests__/fixtures/b.json`:

```json
{ "id": "sw-coral-900", "slug": "test-b", "taxon": "coral", "waterType": "saltwater", "commonName": "Test B", "scientificName": "Genus speciesb", "alsoKnownAs": [] }
```

- [ ] **Step 2: Write the failing test**

Create `src/image-candidates/__tests__/list-species.test.js`:

```js
const path = require('path');
const { buildWorklist } = require('../list-species');

const FIXTURES = path.resolve(__dirname, 'fixtures');

test('builds a sorted worklist with identifiers', () => {
  const list = buildWorklist(FIXTURES);
  expect(list).toHaveLength(2);
  expect(list[0].id).toBe('fw-fish-900'); // sorted by id
  expect(list[0]).toMatchObject({
    slug: 'test-a', taxon: 'fish', waterType: 'freshwater',
    commonName: 'Test A', scientificName: 'Genus speciesa', alsoKnownAs: ['Old namea'],
  });
  expect(list[0].file).toContain('a.json');
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `CI=true npx react-scripts test src/image-candidates/__tests__/list-species.test.js --watchAll=false`
Expected: FAIL — `Cannot find module '../list-species'`.

- [ ] **Step 4: Write minimal implementation**

Create `src/image-candidates/list-species.js`:

```js
'use strict';

const fs = require('fs');
const path = require('path');
const { globSync } = require('glob');

const SPECIES_DIR = path.resolve(__dirname, '..', 'species');

function buildWorklist(speciesDir = SPECIES_DIR) {
  const files = globSync('**/*.json', { cwd: speciesDir, absolute: true });
  return files
    .map((file) => {
      const e = JSON.parse(fs.readFileSync(file, 'utf8'));
      return {
        file,
        id: e.id,
        slug: e.slug,
        taxon: e.taxon,
        waterType: e.waterType,
        commonName: e.commonName,
        scientificName: e.scientificName,
        alsoKnownAs: e.alsoKnownAs || [],
      };
    })
    .sort((a, b) => String(a.id).localeCompare(String(b.id)));
}

if (require.main === module) {
  process.stdout.write(JSON.stringify(buildWorklist(), null, 2) + '\n');
}

module.exports = { buildWorklist };
```

- [ ] **Step 5: Run test to verify it passes**

Run: `CI=true npx react-scripts test src/image-candidates/__tests__/list-species.test.js --watchAll=false`
Expected: PASS.

- [ ] **Step 6: Sanity-check against the real catalog**

Run: `node src/image-candidates/list-species.js | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const a=JSON.parse(s);console.log('count',a.length);console.log('sample',a[0]);})"`
Expected: `count 1696` and a sample object with `file`, `id`, `scientificName`.

- [ ] **Step 7: Commit**

```bash
git add src/image-candidates/list-species.js src/image-candidates/__tests__/list-species.test.js src/image-candidates/__tests__/fixtures
git commit -m "feat(image-candidates): worklist generator for batching"
```

---

## Task 4: Report generator (`report.js`)

**Files:**
- Create: `src/image-candidates/report.js`
- Test: `src/image-candidates/__tests__/report.test.js`

- [ ] **Step 1: Write the failing test**

Create `src/image-candidates/__tests__/report.test.js`:

```js
const { buildReport } = require('../report');

const rows = [
  { id: 'fw-1', slug: 'a', taxon: 'fish', count: 3 },
  { id: 'fw-2', slug: 'b', taxon: 'fish', count: 1 },
  { id: 'fw-3', slug: 'c', taxon: 'coral', count: 0 },
  { id: 'fw-4', slug: 'd', taxon: 'plant', count: null },
];

test('summarizes counts and lists the shortfalls', () => {
  const md = buildReport(rows);
  expect(md).toContain('Total species: 4');
  expect(md).toContain('Processed: 3');
  expect(md).toContain('Unprocessed (imageCandidates null): 1');
  expect(md).toContain('Zero candidates found: 1');
  expect(md).toContain('Fewer than 3 (1-2): 1');
  expect(md).toContain('fw-2'); // the 1-candidate entry appears in the shortfall list
  expect(md).toContain('fw-3'); // the zero entry appears
  expect(md).not.toContain('fw-1'); // the complete entry is not listed as a shortfall
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `CI=true npx react-scripts test src/image-candidates/__tests__/report.test.js --watchAll=false`
Expected: FAIL — `Cannot find module '../report'`.

- [ ] **Step 3: Write minimal implementation**

Create `src/image-candidates/report.js`:

```js
'use strict';

const fs = require('fs');
const path = require('path');
const { globSync } = require('glob');

const SPECIES_DIR = path.resolve(__dirname, '..', 'species');

function scan(speciesDir = SPECIES_DIR) {
  const files = globSync('**/*.json', { cwd: speciesDir, absolute: true });
  return files.map((file) => {
    const e = JSON.parse(fs.readFileSync(file, 'utf8'));
    const cands = e.media && e.media.imageCandidates;
    return {
      id: e.id,
      slug: e.slug,
      taxon: e.taxon,
      count: Array.isArray(cands) ? cands.length : null, // null = unprocessed
    };
  });
}

function buildReport(rows) {
  const processed = rows.filter((r) => r.count !== null);
  const unprocessed = rows.filter((r) => r.count === null);
  const zero = processed.filter((r) => r.count === 0);
  const under = processed.filter((r) => r.count > 0 && r.count < 3);
  const lines = ['# Image-candidate worklist', ''];
  lines.push(`- Total species: ${rows.length}`);
  lines.push(`- Processed: ${processed.length}`);
  lines.push(`- Unprocessed (imageCandidates null): ${unprocessed.length}`);
  lines.push(`- Zero candidates found: ${zero.length}`);
  lines.push(`- Fewer than 3 (1-2): ${under.length}`, '');
  const section = (title, rs) => {
    lines.push(`## ${title} (${rs.length})`);
    for (const r of [...rs].sort((a, b) => String(a.id).localeCompare(String(b.id)))) {
      const desc = r.count === null ? 'unprocessed' : `${r.count} candidate(s)`;
      lines.push(`- ${r.id} \`${r.slug}\` (${r.taxon}) — ${desc}`);
    }
    lines.push('');
  };
  section('Zero candidates', zero);
  section('Fewer than 3', under);
  section('Unprocessed', unprocessed);
  return lines.join('\n');
}

if (require.main === module) {
  process.stdout.write(buildReport(scan()));
}

module.exports = { scan, buildReport };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `CI=true npx react-scripts test src/image-candidates/__tests__/report.test.js --watchAll=false`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/image-candidates/report.js src/image-candidates/__tests__/report.test.js
git commit -m "feat(image-candidates): <3-candidate worklist report"
```

---

## Task 5: The curator Workflow script (`candidates.workflow.js`)

This script is executed by the **Workflow tool**, not Jest. It has no unit test; the pilot run in Task 6 is its acceptance test. Write it exactly.

**Files:**
- Create: `src/image-candidates/candidates.workflow.js`

- [ ] **Step 1: Write the workflow script**

Create `src/image-candidates/candidates.workflow.js`:

```js
export const meta = {
  name: 'species-image-candidates',
  description: 'Source & visually verify up to 3 CC-licensed candidate images per species into media.imageCandidates',
  phases: [
    { title: 'Curate', detail: 'one agent per species: search CC sources, download, visually verify, write candidates' },
  ],
};

const RESULT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['id', 'slug', 'candidatesWritten', 'flags'],
  properties: {
    id: { type: 'string' },
    slug: { type: 'string' },
    candidatesWritten: { type: 'integer', minimum: 0, maximum: 3 },
    flags: { type: 'array', items: { type: 'string' } },
  },
};

function promptFor(file) {
  return [
    'You are a UI/UX image curator for an aquarium hobbyist species catalog.',
    'Your job: find up to 3 STRIKING, well-focused, colorful, correctly-identified candidate images',
    'for ONE species and write them into its JSON. Work from the repository root',
    '(/var/home/Grey/Projects/AquaMate).',
    '',
    `SPECIES FILE: ${file}`,
    '',
    'STEP 1 — Read the species file. Note scientificName, commonName, alsoKnownAs[], taxon.',
    '',
    'STEP 2 — Make a working dir: run `WORK=$(mktemp -d)` and reuse $WORK for all downloads.',
    '',
    'STEP 3 — Discover candidates from these CC-only sources (URL-encode names; spaces -> %20):',
    '',
    '  A) Wikimedia Commons (sourceType "wikimedia"):',
    '     curl -sL "https://commons.wikimedia.org/w/api.php?action=query&format=json&generator=search&gsrnamespace=6&gsrsearch=<SCINAME>&gsrlimit=20&prop=imageinfo&iiprop=url|extmetadata|size|mime&iiurlwidth=1200" -o $WORK/wm.json',
    '     Parse $WORK/wm.json (use `node -e` or Read it). For each page use imageinfo[0].url (full image),',
    '     imageinfo[0].extmetadata.LicenseShortName.value (license), extmetadata.Artist.value (author, may be HTML — strip tags),',
    '     imageinfo[0].mime (keep image/jpeg or image/png only), and size (width/height).',
    '',
    '  B) iNaturalist (sourceType "research-site"):',
    '     curl -sL "https://api.inaturalist.org/v1/taxa?q=<SCINAME>&rank=species&per_page=5" -o $WORK/inat.json',
    '     Take results[0].id, then:',
    '     curl -sL "https://api.inaturalist.org/v1/taxa/<ID>" -o $WORK/inat2.json',
    '     Use results[0].taxon_photos[].photo: license_code, attribution, and url.',
    '     KEEP ONLY license_code in {cc0, cc-by, cc-by-sa}. Map: cc0->"CC0", cc-by->"CC BY", cc-by-sa->"CC BY-SA".',
    '     Build a large URL by replacing "/medium." or "/square." with "/large." in photo.url.',
    '',
    '  C) Flickr Creative Commons — BEST EFFORT ONLY (no API key). Optionally use WebSearch for',
    '     "<scientificName> flickr creative commons". If unreliable, skip it. sourceType "other".',
    '',
    'STEP 4 — LICENSE FILTER (hard rule): keep a candidate ONLY if its license is commercial-friendly:',
    '     CC0, Public Domain, CC BY, or CC BY-SA. REJECT anything NonCommercial (NC), NoDerivatives (ND),',
    '     all-rights-reserved, GFDL, or unknown. When unsure, reject.',
    '',
    'STEP 5 — Assemble a pool of ~5-8 license-passing candidates. Download each full image:',
    '     curl -sL "<imageUrl>" -o $WORK/cand-N.jpg   (use -L for redirects)',
    '',
    'STEP 6 — VISUALLY VERIFY each downloaded image with the Read tool (Read shows you the image).',
    '     Score each against this rubric and DROP any that fail:',
    '       - Correct ID: depicts THIS species or a clearly-labeled accepted synonym (from alsoKnownAs).',
    '         Reject mislabels, wrong genus, ambiguous subjects.',
    '       - Clear subject: in focus, well-lit, well-framed. Not tiny/distant, not heavily obscured.',
    '       - Striking & representative: colorful, healthy, LIVE specimen showing how it looks in the hobby.',
    '         Reject preserved/dead specimens, museum plates, and line drawings UNLESS nothing else exists',
    '         (then keep with a caveat note and recommended:false).',
    '       - Technical: adequate resolution (avoid thumbnails); no heavy watermark/text overlay.',
    '     Prefer VARIETY (different angles/individuals) over near-duplicates.',
    '',
    'STEP 7 — Select the best up to 3. Mark EXACTLY ONE as recommended:true (the single best);',
    '     the rest recommended:false. If zero pass, the result is an empty list — never pad with bad images.',
    '',
    'STEP 8 — Write the candidates. Create $WORK/out.json containing a JSON array of objects, each with keys:',
    '     url (direct full-res image URL), source (e.g. "Wikimedia Commons"), license (exact string),',
    '     notes (photographer + resolution + one phrase on why chosen / any caveat), recommended (bool).',
    '     (sourceType is derived by the writer; you may omit it.) Then run, from the repo root:',
    '       node src/image-candidates/apply-candidates.js "' + file + '" $WORK/out.json',
    '     The writer enforces the schema, caps at 3, requires exactly one recommended, and re-validates',
    '     the commercial-friendly license. If it exits non-zero, fix your out.json and re-run.',
    '',
    'STEP 9 — Return ONLY the structured result: the species id, slug, candidatesWritten (0-3), and',
    '     flags[] (e.g. "no-cc-image-found", "synonym-used", "flickr-fallback", "illustration-only").',
  ].join('\n');
}

const files = (args && args.files) || [];
if (!files.length) {
  log('No files provided in args.files — nothing to do.');
  return [];
}
log(`Curating image candidates for ${files.length} species.`);

const results = await pipeline(
  files,
  (file) =>
    agent(promptFor(file), {
      label: `curate:${file.split('/').pop()}`,
      phase: 'Curate',
      agentType: 'general-purpose',
      schema: RESULT_SCHEMA,
    })
);

const done = results.filter(Boolean);
log(`Completed ${done.length}/${files.length}. Empty results: ${done.filter((r) => r.candidatesWritten === 0).length}.`);
return done;
```

- [ ] **Step 2: Confirm structure (no standalone syntax check)**

Do **not** run `node --check` or `node` on this file — it uses `export const meta` and top-level `await`, which are Workflow-runtime constructs invalid in standalone CommonJS. Instead, visually confirm the file: begins with `export const meta = {...}`; defines `RESULT_SCHEMA` and `promptFor`; ends with the `pipeline(...)` fan-out that returns `done`. Its real acceptance test is the pilot run (Task 6).

- [ ] **Step 3: Commit**

```bash
git add src/image-candidates/candidates.workflow.js
git commit -m "feat(image-candidates): curator workflow (per-species CC image sourcing)"
```

---

## Task 6: Pilot run (18 species) + review gate

**Goal:** Validate the whole loop on a small, taxon-diverse sample before spending on 1696. This is a manual, tool-driven task performed by the executor (who must be able to call the Workflow tool — the user has explicitly opted into orchestration for this work).

- [ ] **Step 1: Build the pilot file list**

Run (picks a spread across all 8 taxa):

```bash
for t in fish plant coral crustacean macroalgae mollusc echinoderm amphibian; do \
  ls -1 "$PWD"/src/species/$t/*.json | head -n 3; done
```

Expected: ~24 absolute paths (3 per taxon). Take the first ~18 spanning all taxa. Record the chosen absolute paths.

- [ ] **Step 2: Run the curator workflow on the pilot set**

Call the **Workflow tool**:
- `scriptPath`: `src/image-candidates/candidates.workflow.js`
- `args`: `{ "files": [ <the ~18 absolute paths from Step 1> ] }`

Wait for the completion notification. Note the `runId` (needed for resume).

- [ ] **Step 3: Schema gate on the pilot files**

Run: `node src/species-build/validate.js <space-separated pilot file paths>`
Expected: `✓ N species file(s) validated successfully.`

- [ ] **Step 4: Human review gate (STOP)**

Open each pilot species' `media.imageCandidates` and spot-check the recommended image URL in a browser. Confirm:
- Images actually depict the correct species (no mislabels).
- They are striking/colorful/well-focused, not preserved specimens or line art.
- Licenses are all commercial-friendly; `source`/`license`/`notes` look right.
- Exactly one `recommended:true`; ≤3 total; `primaryImage`/`gallery` untouched.

If quality is off, tune the agent prompt in `candidates.workflow.js` (Task 5), re-commit, and re-run the pilot before proceeding. **Do not start the bulk run until the pilot passes review.**

- [ ] **Step 5: Commit the pilot data**

```bash
git add src/species/**/*.json
git commit -m "data(image-candidates): pilot batch (18 species across all taxa)"
```

---

## Task 7: Bulk run (all remaining species) + gates

**Goal:** Process the full catalog in taxon-sized chunks, checkpointing after each. Run the smaller taxa first, then chunk fish.

- [ ] **Step 1: Process the non-fish taxa (one chunk per taxon)**

For each taxon in this order — `amphibian` (11), `echinoderm` (22), `mollusc` (27), `crustacean` (77), `macroalgae` (102), `coral` (122), `plant` (188) — build the file list and run the workflow:

```bash
ls -1 "$PWD"/src/species/<taxon>/*.json
```

Call the **Workflow tool** with `scriptPath: src/image-candidates/candidates.workflow.js` and `args: { "files": [ <that taxon's absolute paths> ] }`. After each taxon completes:

```bash
node src/species-build/validate.js src/species/<taxon>/*.json
git add src/species/<taxon>/*.json
git commit -m "data(image-candidates): <taxon> batch"
```

Expected each time: validation passes; commit succeeds.

- [ ] **Step 2: Chunk and process fish (1147) in sub-batches**

Split fish into ~200-file chunks so each workflow run is checkpointable:

```bash
ls -1 "$PWD"/src/species/fish/*.json | split -l 200 - /tmp/fishchunk_
ls /tmp/fishchunk_*
```

For each `fishchunk_*` file, read its paths and call the **Workflow tool** with `args: { "files": [ <paths in that chunk> ] }`. After each chunk:

```bash
node src/species-build/validate.js $(cat /tmp/fishchunk_XX)
git add src/species/fish/*.json
git commit -m "data(image-candidates): fish batch <n>"
```

If a chunk partially fails, re-run the Workflow tool with `scriptPath` + `resumeFromRunId: <that chunk's runId>` — cached per-species results return instantly and only the failed/unprocessed species re-run.

- [ ] **Step 3: Full-catalog validation gate**

Run: `npm run validate`
Expected: `✓ 1696 species file(s) validated successfully.`

- [ ] **Step 4: Recompile the aggregated catalog**

Run: `npm run compile-species`
Expected: `Compiled 1696 species entries into dist/species.json.`

- [ ] **Step 5: Generate the manual-sourcing worklist report**

```bash
mkdir -p docs/superpowers/reports
node src/image-candidates/report.js > docs/superpowers/reports/image-candidates-worklist.md
```

Expected: a markdown file summarizing totals and listing every species with 0, 1, or 2 candidates (your manual to-do list).

- [ ] **Step 6: Final commit**

```bash
git add -f docs/superpowers/reports/image-candidates-worklist.md
git add dist/species.json
git commit -m "data(image-candidates): complete catalog + worklist report"
```

---

## Task 8: Teardown (after you've curated/uploaded final images)

**Goal:** Remove the disposable tooling once the catalog is populated and you no longer need to re-run it. Do this only when you're done sourcing.

- [ ] **Step 1: Delete the tooling folder**

```bash
rm -rf src/image-candidates
```

- [ ] **Step 2: Confirm nothing references it**

Run: `grep -rn "image-candidates" src/ --include=*.js --include=*.jsx || echo "no references"`
Expected: `no references` (the app never imported it).

- [ ] **Step 3: Verify the app/tests still pass without it**

Run: `npm run validate && CI=true npx react-scripts test --watchAll=false`
Expected: catalog validates; remaining test suites pass.

- [ ] **Step 4: Commit the teardown**

```bash
git add -A
git commit -m "chore(image-candidates): remove disposable tooling after run"
```

---

## Self-Review Notes

- **Spec coverage:** imageCandidates target (Tasks 2,5) ✓; all 1696 overwrite (Tasks 6,7) ✓; visual verification (Task 5 STEP 6) ✓; commercial-friendly only (Task 1 filter + Task 2 defensive re-check + Task 5 STEP 4) ✓; Wikimedia+iNat, Flickr best-effort, FishBase/AlgaeBase excluded (Task 5 STEP 3) ✓; fewer-but-correct / never pad (Task 5 STEP 7) ✓; <3 worklist report (Task 4 + Task 7 STEP 5) ✓; primaryImage/gallery untouched (Task 2 test asserts it) ✓; validate gate (Tasks 6,7) ✓.
- **Disposability:** all code + tests + fixtures live only in `src/image-candidates/`; Task 8 removes the folder and verifies no dangling references. ✓
- **Sparse-case report:** the spec chose "fewer but correct"; the report is an additive convenience the user approved during design.
- **No placeholders:** every code step contains full code; every run step has an exact command and expected output.
- **Type consistency:** `applyCandidates(speciesFile, rawCandidates)`, `buildCandidate`, `assertCandidateSet`, `buildWorklist(speciesDir)`, `scan`/`buildReport(rows)` names are consistent across tasks; the workflow's STEP 8 call matches the CLI signature `apply-candidates.js <speciesFile> <candidatesJsonFile>`; the writer test imports `validateOne` from `../../species-build/validate`.
