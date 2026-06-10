#!/usr/bin/env node
// End-of-slice merge consolidation. Pairs were flagged across fish-fw batches
// where two entries describe the same species (2024 Dias Hoplisoma/Gastrodermus
// reclass parallel entries, or trade-name aliasing).

const fs = require('fs');
const path = require('path');

const FISH_DIR = path.resolve(__dirname, '..', 'species', 'fish');

const MERGES = [
  // 2024 Dias/Britto reclass pairs — keep trade name, update genus
  { keep: 'fw-fish-130', retire: 'fw-fish-372',
    newSci: 'Gastrodermus hastatus',
    note: 'Reclassified Corydoras hastatus → Gastrodermus hastatus by Dias et al. (2024); trade name "Tail Spot Cory" retained as primary common name.' },
  { keep: 'fw-fish-087', retire: 'fw-fish-453',
    newSci: 'Gastrodermus pygmaeus',
    note: 'Reclassified Corydoras pygmaeus → Gastrodermus pygmaeus by Dias et al. (2024); trade name "Pygmy Cory" retained.' },
  { keep: 'fw-fish-191', retire: 'fw-fish-487',
    newSci: 'Hoplisoma habrosum',
    note: 'Reclassified Corydoras habrosus → Hoplisoma habrosum by Dias et al. (2024); trade name "Habrosus Cory / Salt-and-Pepper Cory" retained.' },
  { keep: 'fw-fish-175', retire: 'fw-fish-177',
    newSci: 'Brochis splendens',
    note: 'Brochis splendens retained as valid genus by Dias et al. (2024); long-standing trade synonym Corydoras splendens still in commerce.' },

  // Genus-synonymy pairs
  { keep: 'fw-fish-261', retire: 'fw-fish-262',
    newSci: 'Bunocephalus coracoideus',
    note: 'Dysichthys coracoideus synonymised into Bunocephalus coracoideus by Friel 1994/95 Aspredinidae revision. Current valid name retained.' },

  // Orthographic / spelling variants
  { keep: 'fw-fish-278', retire: 'fw-fish-279',
    newSci: 'Fundulopanchax sjostedti',
    note: 'Original Lönnberg 1895 spelling "sjoestedti" simplified to "sjostedti" per Catalog of Fishes accepted form.' },

  // Trade-name / hybrid aliasing
  { keep: 'fw-fish-348', retire: 'fw-fish-349',
    newSci: 'Amphilophus citrinellus × trimaculatus (hybrid)',
    note: 'Artificial Asian-aquaculture hybrid (1990s–2000s) primarily of A. citrinellus + A. trimaculatus + Vieja synspilum. No wild population. Trade lines: ZZ, Red Texas, Kamfa, Golden Monkey, Bonsai, SRD.' },
  { keep: 'fw-fish-360', retire: 'fw-fish-361',
    newSci: 'Baryancistrus xanthellus',
    note: 'B. xanthellus is the formally described species covering L18/L81/L85/L177 trade L-numbers in the Gold Nugget complex; "Baryancistrus spp." is the trade umbrella label.' },
  { keep: 'fw-fish-206', retire: 'fw-fish-423',
    newSci: 'Aulonocara stuartgranti',
    note: 'OB Peacock is an X-linked Mbuna-origin hybrid trade brand commonly assigned the placeholder name A. stuartgranti; not a discrete species.' },
  { keep: 'fw-fish-343', retire: 'fw-fish-539',
    newSci: 'Farlowella acus',
    note: 'Trade specimens of "Twig Catfish" / "Farlowella" cover a genus complex (Farlowella spp.); F. acus is the most-cited canonical species.' },

  // Subspecies/species coverage pair
  { keep: 'fw-fish-287', retire: 'fw-fish-396',
    newSci: 'Liniparhomaloptera disparis',
    note: 'Liniparhomaloptera disparis disparis (nominate subspecies, S China + Vietnam) and L. d. qiongzhongensis (Hainan) are subspecies of the same species; entry covers both at species level.' },
];

function findFileById(id) {
  const files = fs.readdirSync(FISH_DIR);
  for (const f of files) {
    const fp = path.join(FISH_DIR, f);
    const j = JSON.parse(fs.readFileSync(fp, 'utf8'));
    if (j.id === id) return { path: fp, data: j };
  }
  return null;
}

function dedup(arr) {
  const seen = new Set();
  return arr.filter(s => {
    if (!s) return false;
    const norm = s.trim();
    if (seen.has(norm)) return false;
    seen.add(norm);
    return true;
  });
}

function appendNote(existing, addition) {
  if (!existing) return addition;
  if (existing.includes(addition.split('.')[0])) return existing;  // crude dedup
  return existing + '\n\n[Merge consolidation 2026-06-10]: ' + addition;
}

function main() {
  for (const m of MERGES) {
    const keep = findFileById(m.keep);
    const retire = findFileById(m.retire);
    if (!keep) { console.error('! KEEP file missing:', m.keep); continue; }
    if (!retire) { console.error('! RETIRE file missing:', m.retire); continue; }

    // Merge alsoKnownAs (keep's first, then retire's)
    const mergedAka = dedup([
      ...(keep.data.alsoKnownAs || []),
      retire.data.commonName,                 // old common name as alias
      retire.data.scientificName,             // old scientific name as alias
      ...(retire.data.alsoKnownAs || []),
    ]);

    keep.data.alsoKnownAs = mergedAka;

    // Update scientificName to current accepted
    const oldSci = keep.data.scientificName;
    keep.data.scientificName = m.newSci;

    // Append merge note to careNotes
    keep.data.careNotes = appendNote(
      keep.data.careNotes,
      `Consolidated with retired entry ${m.retire} (${retire.data.commonName} / ${retire.data.scientificName}). ${m.note}`,
    );

    // Write keep file
    fs.writeFileSync(keep.path, JSON.stringify(keep.data, null, 2) + '\n');

    // Delete retire file
    fs.unlinkSync(retire.path);

    console.log(`✓ Merged ${m.retire} → ${m.keep}: ${oldSci} → ${m.newSci} (${retire.data.commonName})`);
  }
  console.log(`\nMerge consolidation complete: ${MERGES.length} pairs resolved.`);
}

if (require.main === module) main();
