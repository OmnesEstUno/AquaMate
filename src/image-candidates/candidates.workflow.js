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
    candidatesWritten: { type: 'integer', minimum: 0, maximum: 24 },
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
    '     ALSO read the "summary" and "careNotes" prose and extract this species\' DISTINGUISHING VISUAL',
    '     FEATURES — coloration, pattern, markings, fin shape (e.g. Toba Betta = "blood-red belly with black',
    '     vertical bars"). Use these as BOTH an ID check and a quality bar in STEP 6: the chosen image must',
    '     actually SHOW those features on a live, vibrant, in-colour individual.',
    '     Get your TARGET (max candidates) by running: node src/image-candidates/target.js "' + file + '"',
    '       - TARGET 3  => SPECIES entry: up to 3 images of that one species.',
    '       - TARGET 20 => GENUS entry (bare genus like "Acropora" / "...sp."): up to 20 images chosen to',
    '                      show as MANY DIFFERENT species within the genus as possible.',
    '       - TARGET 24 => UMBRELLA entry (one species with many color/pattern morphs, e.g. Cherry Shrimp):',
    '                      up to 24 images chosen to show as MANY DIFFERENT named color/pattern variants as',
    '                      possible (the variants are usually listed in alsoKnownAs).',
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
    '  C) GBIF (sourceType "research-site") — a meta-aggregator of hundreds of datasets:',
    '     curl -sL "https://api.gbif.org/v1/occurrence/search?scientificName=<SCINAME>&mediaType=StillImage&limit=40" -o $WORK/gbif.json',
    '     For each results[].media[] with type "StillImage": use media.identifier (full image URL),',
    '     media.license (FREE TEXT — may be "CC0", "CC_BY_4.0", "cc-by-sa", or a creativecommons.org URL),',
    '     media.rightsHolder / media.creator (attribution), media.format (keep image/jpeg or image/png).',
    '     CRITICAL: use the per-MEDIA license, NOT the occurrence-level license — they can differ, and the',
    '     query does not constrain media license. GBIF re-aggregates iNaturalist and CalPhotos, so SKIP any',
    '     image whose URL/identifier you already collected from iNaturalist; value GBIF for the OTHER datasets.',
    '',
    '  D) Flickr (sourceType "other") — ONLY if a Flickr API key is available:',
    '     If the env var $FLICKR_API_KEY is set (check with `echo "$FLICKR_API_KEY"`), run:',
    '       curl -sL "https://api.flickr.com/services/rest/?method=flickr.photos.search&api_key=$FLICKR_API_KEY&text=<SCINAME>&license=4,5,8,9,10,11,12&extras=license,url_o,url_l,owner_name&format=json&nojsoncallback=1&per_page=20&sort=relevance" -o $WORK/flickr.json',
    '       license IDs already filter to commercial-friendly: 4=CC BY 2.0, 5=CC BY-SA 2.0, 8=US Gov, 9=CC0,',
    '       10=Public Domain Mark, 11=CC BY 4.0, 12=CC BY-SA 4.0. Build the URL from photos.photo[].url_o (or url_l).',
    '       BEWARE "Flickr washing": users sometimes mislabel others\' images as CC, so the STEP 6 visual ID check',
    '       matters extra here — reject anything whose subject looks wrong. If $FLICKR_API_KEY is NOT set, SKIP Flickr.',
    '',
    'STEP 4 — LICENSE FILTER (hard rule): keep a candidate ONLY if its license is commercial-friendly:',
    '     CC0, Public Domain, CC BY, or CC BY-SA (in any spelling — "CC BY", "cc-by", "CC_BY_4.0", or a',
    '     creativecommons.org/licenses/by[-sa] URL all qualify). REJECT anything NonCommercial (NC),',
    '     NoDerivatives (ND), all-rights-reserved, GFDL, or unknown/blank. When unsure, reject. Record the',
    '     license string EXACTLY as the source gives it (the writer re-validates it).',
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
    '       - Sharpness (STRICT): in focus and crisp. REJECT blurry, soft, hazy, or motion-smeared images,',
    '         and NEVER mark such an image recommended. A hazy/soft photo is not acceptable even if correctly ID\'d.',
    '       - Framing: the WHOLE animal/plant should be in frame, well-lit, not tiny/distant or obscured.',
    '         Avoid extreme macro crops that cut off the subject; a tight feature close-up may be kept as a',
    '         NON-recommended extra but must never be the recommended pick.',
    '       - Shoaling/social species: if the species is a schooling/shoaling fish or a colony/group animal',
    '         (e.g. tetras, rasboras, corydoras, many shrimp), PREFER images showing MULTIPLE individuals /',
    '         a group over a lone specimen — that better represents how it is kept and displayed. A slightly',
    '         softer group shot may be preferred over a tack-sharp lone specimen for these species.',
    '       - Diagnostic features (IMPORTANT): the image must clearly show the distinguishing features you',
    '         extracted from the summary/careNotes in STEP 1 — the correct coloration, pattern, and markings on',
    '         a LIVE, VIBRANT, in-colour individual. Reject dull, washed-out, faded, juvenile, or off-colour',
    '         specimens when a properly-coloured one exists (e.g. a brown, colourless Betta for a species the',
    '         summary describes as blood-red). Full/nuptial/breeding colour beats a drab individual.',
    '       - PHOTOGRAPHS OF LIVE SPECIMENS ONLY (HARD REJECT, no exceptions): the image MUST be a real',
    '         photograph of a live animal/plant. REJECT OUTRIGHT — never include, not even as a last resort —',
    '         any non-photographic or non-live image: illustrations, drawings, paintings, engravings,',
    '         scientific/taxonomic plates, diagrams, POSTAGE STAMPS, logos, and preserved/pressed/dead/',
    '         museum/herbarium specimens. If the ONLY images available are non-photographic or preserved,',
    '         return an EMPTY result and flag "no-cc-live-photo" — an empty entry is BETTER than a non-photo.',
    '       - Technical: adequate resolution (avoid thumbnails); no heavy watermark/text overlay.',
    '     TAXON-SPECIFIC PREFERENCES (apply when relevant):',
    '       - CORALS & ANEMONES: strongly PREFER in-water / in-situ shots, and ESPECIALLY those taken under',
    '         actinic / blue "reef" lighting that brings out fluorescent (neon) coloration — that is the look',
    '         hobbyists actually see and buy, and it should weigh heavily toward the recommended pick. Daylight',
    '         or out-of-water shots are acceptable only as lower-ranked, recommended:false filler when no',
    '         in-water/actinic shot exists.',
    '       - PLANTS: identification confidence is inherently LOW (many species look alike), so do not over-',
    '         value a generic "planted tank" look. Weight these most heavily for the recommended pick: sharp',
    '         focus, ONLY the target species in frame (no other plant species crowding it), and the plant',
    '         centered / shown complete. When unsure between candidates, pick the sharpest clean single-subject',
    '         shot. If you cannot confidently ID the species, add the flag "low-id-confidence".',
    '     Prefer VARIETY (different angles/individuals/species/morphs) over near-duplicates.',
    '',
    'STEP 7 — Select the best candidates up to your TARGET (3 for a species entry, 5 for a genus entry).',
    '     For a GENUS entry, maximize the number of DISTINCT species shown — prefer one strong image each',
    '     of several species over multiple images of the same species. A NON-EMPTY result MUST have EXACTLY',
    '     ONE recommended:true: the single best SURVIVING PHOTOGRAPH. All other entries are recommended:false.',
    '     If zero photographs pass, the result is an EMPTY list — never pad with bad, non-photographic, or',
    '     wrong-species images, and an empty list has no recommended entry.',
    '',
    'STEP 8 — Write the candidates. Create $WORK/out.json containing a JSON array of objects, each with keys:',
    '     url (direct full-res image URL), source (e.g. "Wikimedia Commons"), license (exact string),',
    '     notes (photographer + resolution + one phrase on why chosen / any caveat), recommended (bool).',
    '     (sourceType is derived by the writer; you may omit it.) Then run, from the repo root:',
    '       node src/image-candidates/apply-candidates.js "' + file + '" $WORK/out.json',
    '     The writer enforces the schema, caps at your TARGET (3 species / 5 genus), requires exactly one',
    '     recommended, and re-validates',
    '     the commercial-friendly license. If it exits non-zero, fix your out.json and re-run.',
    '     IMPORTANT: you MUST run apply-candidates.js even when you found ZERO photos — write $WORK/out.json',
    '     as an empty array [] and run the writer so the empty result is RECORDED (not left null).',
    '',
    'STEP 9 — Return ONLY the structured result: the species id, slug, candidatesWritten (0-24), and',
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
