#!/usr/bin/env node
// Cleanup pre-overhaul fw-NNN placeholder fish-fw entries:
//   - Delete entries that are clear duplicates of researched species
//   - Delete entries that are color morphs of researched species
//   - Delete generic-group entries when we have specific species
//   - For genuinely-missing species: annotate scientificName so the
//     forthcoming audit can identify them

const fs = require('fs');
const path = require('path');

const FISH_DIR = path.resolve(__dirname, '..', 'species', 'fish');

const TO_DELETE = {
  // Duplicates of researched entries (different trade name / scientific name)
  'fw-052': 'Jack Dempsey → fw-fish-195 jack-dempsey-cichlid (Rocio octofasciata)',
  'fw-110': 'Figure 8 Puffer → fw-fish-345 figure-eight-puffer (Dichotomyctere ocellatus)',
  'fw-076': 'Synodontis multipunctatus → fw-fish-170 cuckoo-catfish',
  'fw-077': 'Synodontis petricola → fw-fish-443 petricola-catfish (true S. petricola)',
  'fw-064': 'Tropheus moorii → fw-fish-534 tropheus',
  'fw-059': 'Red Zebra → fw-fish-466 red-zebra-cichlid (Maylandia estherae)',
  'fw-057': 'Yellow Lab (Labidochromis caeruleus) — already in DB under early-batch slug',
  'fw-061': 'Acei Cichlid → fw-fish-138 acei-cichlid (already-done in early batch)',
  'fw-058': 'Electric Blue Hap → fw-fish-329 electric-blue-cichlid (Sciaenochromis fryeri)',
  'fw-020': 'Emerald Rasbora → fw-fish-176 emerald-dwarf-rasbora (Danio erythromicron)',
  'fw-105': 'Koi → fw-fish-165 common-carp (domesticated Cyprinus carpio ornamental form)',
  'fw-108': 'Axolotl → src/species/fish/axolotl.json already exists (researched)',
  'fw-074': 'Rubber Lip Pleco → fw-fish-221 rubber-pleco (Chaetostoma trade group)',
  'fw-094': 'Celebes Rainbow → fw-fish-160 celebes-rainbowfish (Marosatherina ladigesi)',
  'fw-092': '(check) Demasoni → fw-fish-092 demasoni-cichlid (already-done)',

  // Color morphs of base species (mostly already researched)
  'fw-031': 'Balloon Molly — selectively-bred balloon-body Poecilia sphenops morph',
  'fw-032': 'Liberty Molly — Poecilia salvatoris (close to sailfin-molly fw-fish-092)',
  'fw-098': 'Comet Goldfish — single-tail long-tail Carassius auratus variety',
  'fw-097': 'Common Goldfish — Carassius auratus base form',
  'fw-099': 'Fantail Goldfish — twin-tail egg-body Carassius auratus variety',
  'fw-101': 'Oranda — wen-headed twin-tail Carassius auratus variety',
  'fw-102': 'Ranchu — dorsal-less wen-headed Carassius auratus variety',
  'fw-100': 'Ryukin — twin-tail high-back Carassius auratus variety',
  'fw-104': 'Shubunkin — calico-color Carassius auratus variety',
  'fw-103': 'Black Moor — telescope-eye fancy Carassius auratus variety',
  'fw-036': 'Albino Tiger Barb — color morph of Tiger Barb (Puntigrus tetrazona)',
  'fw-035': 'Green Tiger Barb — color morph of Tiger Barb (Puntigrus tetrazona)',
  'fw-087': 'Opaline Gourami — color morph of Three-Spot Gourami (Trichopodus trichopterus)',
  'fw-023': 'Leopard Danio — color morph of Zebra Danio (Danio rerio)',

  // Generic-group entries (we already have specific species under those groups)
  'fw-113': 'Bichir (generic) — covered by specific bichirs in DB (delhezi, ornate, palmas, retropinnis, senegal, endlicheri)',
  'fw-062': 'Peacock Cichlids (generic) — covered by specific peacocks (baenschi, nyassae, OB, sun)',
};

const TO_ANNOTATE_KEEP = {
  // Genuinely missing common species — fill scientificName so audit can find them
  'fw-050': { sci: 'Amatitlania nigrofasciata', note: 'Convict Cichlid — common Central American cichlid; not yet researched.' },
  'fw-051': { sci: 'Thorichthys meeki',          note: 'Firemouth Cichlid — common Central American cichlid; not yet researched.' },
  'fw-054': { sci: 'Andinoacara rivulatus',      note: 'Green Terror — common South American cichlid; not yet researched.' },
  'fw-055': { sci: 'Heros severus',              note: 'Severum — Heros species complex; not yet researched.' },
  'fw-065': { sci: 'Rubricatochromis bimaculatus', note: 'Jewel Cichlid (formerly Hemichromis) — distinct from fw-fish-480 dwarf-jewel-cichlid; not yet researched.' },
  'fw-115': { sci: 'Potamotrygon spp.',          note: 'Freshwater Stingray — large specialist/public-aquarium-only; not yet researched.' },
  'fw-093': { sci: 'Glossolepis incisus',        note: 'Red Rainbow — distinct from fw-fish-216 red-neon-rainbowfish (Pseudomugil luminatus); not yet researched.' },
  'fw-112': { sci: 'Erpetoichthys calabaricus',  note: 'Ropefish — Polypteridae; not yet researched.' },
  'fw-011': { sci: 'Hyphessobrycon eques',       note: 'Serpae Tetra — common community tetra; not yet researched.' },
  'fw-041': { sci: 'Barbonymus schwanenfeldii',  note: 'Tinfoil Barb — common large barb; not yet researched.' },
};

function findFile(id) {
  for (const f of fs.readdirSync(FISH_DIR)) {
    const fp = path.join(FISH_DIR, f);
    const j = JSON.parse(fs.readFileSync(fp, 'utf8'));
    if (j.id === id) return { path: fp, data: j };
  }
  return null;
}

function main() {
  let deleted = 0, missing = 0, annotated = 0;

  for (const [id, reason] of Object.entries(TO_DELETE)) {
    const f = findFile(id);
    if (!f) { missing++; continue; }
    fs.unlinkSync(f.path);
    deleted++;
    console.log(`✗ deleted ${id} — ${reason}`);
  }

  for (const [id, info] of Object.entries(TO_ANNOTATE_KEEP)) {
    const f = findFile(id);
    if (!f) { missing++; continue; }
    f.data.scientificName = info.sci;
    f.data.alsoKnownAs = [...(f.data.alsoKnownAs || []), `[pending-research] ${info.note}`];
    fs.writeFileSync(f.path, JSON.stringify(f.data, null, 2) + '\n');
    annotated++;
    console.log(`✎ annotated ${id} — ${info.sci} (${f.data.commonName})`);
  }

  console.log(`\nDeleted: ${deleted}  Annotated (kept): ${annotated}  Missing: ${missing}`);
}

if (require.main === module) main();
