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
    candidatesWritten: { type: 'integer', minimum: 0, maximum: 5 },
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
    '     Determine entry type: if scientificName is a bare GENUS (a single word like "Acropora", or',
    '     ends in "sp."/"spp."), this is a GENUS entry — TARGET is up to 5 candidates chosen to show',
    '     as MANY DIFFERENT species within that genus as possible (species variety is the goal).',
    '     Otherwise it is a SPECIES entry — TARGET is up to 3 candidates of that one species.',
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
    'STEP 5 — Assemble a pool of license-passing candidates (aim for ~2x your TARGET). For GENUS',
    '     entries, deliberately search several different species in the genus (e.g. query the genus',
    '     name AND individual species names) so the pool spans multiple species. Download each full image:',
    '     curl -sL "<imageUrl>" -o $WORK/cand-N.jpg   (use -L for redirects)',
    '',
    'STEP 6 — VISUALLY VERIFY each downloaded image with the Read tool (Read shows you the image).',
    '     Score each against this rubric and DROP any that fail:',
    '       - Correct ID: depicts THIS species or a clearly-labeled accepted synonym (from alsoKnownAs).',
    '         Reject mislabels, wrong genus, ambiguous subjects.',
    '       - Clear subject: in focus, well-lit, well-framed. Not tiny/distant, not heavily obscured.',
    '       - Striking & representative: colorful, healthy, LIVE specimen showing how it looks in the hobby.',
    '         Reject preserved/dead specimens, museum plates, and line drawings UNLESS nothing else exists',
    '         (then keep it with a caveat note; if it is the sole survivor it is still recommended — see STEP 7).',
    '       - Technical: adequate resolution (avoid thumbnails); no heavy watermark/text overlay.',
    '     Prefer VARIETY (different angles/individuals) over near-duplicates.',
    '',
    'STEP 7 — Select the best candidates up to your TARGET (3 for a species entry, 5 for a genus entry).',
    '     For a GENUS entry, maximize the number of DISTINCT species shown — prefer one strong image each',
    '     of several species over multiple images of the same species. A NON-EMPTY result MUST have EXACTLY',
    '     ONE recommended:true: the single best SURVIVING candidate is always recommended:true — even if it',
    '     is a caveated illustration that survived only because nothing better exists. All other entries are',
    '     recommended:false. If zero candidates pass, the result is an empty list — never pad with bad images,',
    '     and an empty list has no recommended entry.',
    '',
    'STEP 8 — Write the candidates. Create $WORK/out.json containing a JSON array of objects, each with keys:',
    '     url (direct full-res image URL), source (e.g. "Wikimedia Commons"), license (exact string),',
    '     notes (photographer + resolution + one phrase on why chosen / any caveat), recommended (bool).',
    '     (sourceType is derived by the writer; you may omit it.) Then run, from the repo root:',
    '       node src/image-candidates/apply-candidates.js "' + file + '" $WORK/out.json',
    '     The writer enforces the schema, caps at your TARGET (3 species / 5 genus), requires exactly one',
    '     recommended, and re-validates',
    '     the commercial-friendly license. If it exits non-zero, fix your out.json and re-run.',
    '',
    'STEP 9 — Return ONLY the structured result: the species id, slug, candidatesWritten (0-5), and',
    '     flags[] (e.g. "no-cc-image-found", "synonym-used", "flickr-fallback", "illustration-only").',
  ].join('\n');
}

// args may arrive as a real object or as a JSON-encoded string depending on how it was passed.
let parsedArgs = args;
if (typeof parsedArgs === 'string') {
  try {
    parsedArgs = JSON.parse(parsedArgs);
  } catch (e) {
    parsedArgs = {};
  }
}
const files = (parsedArgs && parsedArgs.files) || [];
if (!files.length) {
  log(`No files resolved from args (type=${typeof args}) — nothing to do.`);
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
