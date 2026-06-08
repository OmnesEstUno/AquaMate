#!/usr/bin/env node
// Resolve the 40 unmatched placeholder scientificNames in the fish-freshwater
// manifest, using well-known hobby taxonomy.

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..', '..', '..', '..');
const MANIFEST = path.join(ROOT, 'src/species-build/discovery/fish-freshwater.json');
const DISPATCH = path.join(ROOT, '.dispatch-prompts-fish-fw/dispatch.json');

const RESOLUTIONS = {
  'Albino Tiger Barb': { sci: 'Puntigrus tetrazona', family: 'Cyprinidae', note: 'Color morph of Tiger Barb' },
  'Angelfish': { sci: 'Pterophyllum scalare', family: 'Cichlidae' },
  'Axolotl': { sci: 'Ambystoma mexicanum', family: 'Ambystomatidae', note: 'AMPHIBIAN (salamander) — not a fish, but commonly kept in fish setups' },
  'Balloon Molly': { sci: 'Poecilia sphenops', family: 'Poeciliidae', note: 'Selectively-bred balloon-bodied morph' },
  'Betta splendens': { sci: 'Betta splendens', family: 'Osphronemidae' },
  'Bichir': { sci: 'Polypterus senegalus', family: 'Polypteridae', note: 'Genus-level entry — P. senegalus most common in trade' },
  'Black Moor': { sci: 'Carassius auratus', family: 'Cyprinidae', note: 'Goldfish telescope-eye fancy variety' },
  'Boesemani Rainbow': { sci: 'Melanotaenia boesemani', family: 'Melanotaeniidae' },
  'Celebes Rainbow': { sci: 'Marosatherina ladigesi', family: 'Telmatherinidae' },
  'Comet Goldfish': { sci: 'Carassius auratus', family: 'Cyprinidae', note: 'Goldfish single-tail long-tail variety' },
  'Common Goldfish': { sci: 'Carassius auratus', family: 'Cyprinidae' },
  'Corydoras aeneus': { sci: 'Corydoras aeneus', family: 'Callichthyidae' },
  'Corydoras julii': { sci: 'Corydoras julii', family: 'Callichthyidae', note: 'Often confused with C. trilineatus in trade' },
  'Corydoras panda': { sci: 'Corydoras panda', family: 'Callichthyidae' },
  'Corydoras sterbai': { sci: 'Corydoras sterbai', family: 'Callichthyidae' },
  'Demasoni': { sci: 'Chindongo demasoni', family: 'Cichlidae', note: 'Mbuna — reclassified from Pseudotropheus to Chindongo per recent revision' },
  'Electric Blue Hap': { sci: 'Sciaenochromis fryeri', family: 'Cichlidae', note: 'Lake Malawi Haplochromine' },
  'Emerald Rasbora': { sci: 'Danio erythromicron', family: 'Danionidae', note: 'Called rasbora colloquially but is actually a Danio per current taxonomy' },
  'Endler’s Livebearer': { sci: 'Poecilia wingei', family: 'Poeciliidae' },
  'Fantail Goldfish': { sci: 'Carassius auratus', family: 'Cyprinidae', note: 'Goldfish twin-tail egg-body variety' },
  'Figure 8 Puffer': { sci: 'Dichotomyctere ocellatus', family: 'Tetraodontidae', note: 'Brackish — euryhaline. Reclassified from Tetraodon to Dichotomyctere.' },
  'Green Tiger Barb': { sci: 'Puntigrus tetrazona', family: 'Cyprinidae', note: 'Color morph of Tiger Barb' },
  'Jack Dempsey': { sci: 'Rocio octofasciata', family: 'Cichlidae', note: 'Reclassified from Cichlasoma to Rocio' },
  'Liberty Molly': { sci: 'Poecilia salvatoris', family: 'Poeciliidae' },
  'Neon Dwarf Rainbow': { sci: 'Melanotaenia praecox', family: 'Melanotaeniidae' },
  'Opaline Gourami': { sci: 'Trichopodus trichopterus', family: 'Osphronemidae', note: 'Color morph of Three-Spot Gourami' },
  'Oranda': { sci: 'Carassius auratus', family: 'Cyprinidae', note: 'Goldfish wen-headed twin-tail variety' },
  'Peacock Cichlids': { sci: 'Aulonocara sp.', family: 'Cichlidae', note: 'Genus-level entry — Aulonocara has many species (jacobfreibergi, baenschi, stuartgranti, etc.)' },
  'Ranchu': { sci: 'Carassius auratus', family: 'Cyprinidae', note: 'Goldfish dorsal-less wen-headed variety' },
  'Red Rainbow': { sci: 'Glossolepis incisus', family: 'Melanotaeniidae' },
  'Red Zebra': { sci: 'Maylandia estherae', family: 'Cichlidae', note: 'Mbuna — also called Esther Grant\'s Zebra' },
  'Ropefish': { sci: 'Erpetoichthys calabaricus', family: 'Polypteridae' },
  'Rummy Nose Tetra': { sci: 'Hemigrammus rhodostomus', family: 'Characidae', note: 'Common Rummy-nose. True Rummy-nose is Petitella georgiae; Firehead is P. bleheri.' },
  'Ryukin': { sci: 'Carassius auratus', family: 'Cyprinidae', note: 'Goldfish twin-tail high-back variety' },
  'Shubunkin': { sci: 'Carassius auratus', family: 'Cyprinidae', note: 'Goldfish calico color variety' },
  'Synodontis multipunctatus': { sci: 'Synodontis multipunctatus', family: 'Mochokidae', note: 'Tanganyikan cuckoo catfish — brood-parasite on mouth-brooding cichlids' },
  'Synodontis petricola': { sci: 'Synodontis petricola', family: 'Mochokidae', note: 'Tanganyikan rock-dwelling synodontis' },
  'Threadfin Rainbow': { sci: 'Iriatherina werneri', family: 'Melanotaeniidae' },
  'Tropheus moorii': { sci: 'Tropheus moorii', family: 'Cichlidae', note: 'Tanganyika color-variant rich species' },
  'Turquoise Rainbow': { sci: 'Melanotaenia lacustris', family: 'Melanotaeniidae' },
};

function main() {
  const manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
  const dispatch = JSON.parse(fs.readFileSync(DISPATCH, 'utf8'));

  let resolved = 0;
  let notes = [];

  for (const entry of manifest.entries) {
    if (!entry.existingPlaceholder) continue;
    if (entry.scientificName && entry.scientificName.match(/^[A-Z][a-z]+\s+[a-z]+/)) continue;
    const res = RESOLUTIONS[entry.commonName];
    if (!res) {
      notes.push(`UNRESOLVED: ${entry.commonName} (${entry.id})`);
      continue;
    }
    entry.scientificName = res.sci;
    entry.family = entry.family || res.family;
    if (res.note) {
      entry.notes = entry.notes ? `${entry.notes} ${res.note}` : res.note;
    }
    resolved++;
  }

  // Sync to dispatch plan
  for (const d of dispatch) {
    const m = manifest.entries.find(e => e.id === d.id);
    if (m) {
      d.scientificName = m.scientificName;
      d.family = m.family;
      d.notes = m.notes;
    }
  }

  fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2) + '\n');
  fs.writeFileSync(DISPATCH, JSON.stringify(dispatch, null, 2) + '\n');

  console.log(`Resolved: ${resolved} placeholder scientificNames`);
  console.log(`Unresolved: ${notes.length}`);
  for (const n of notes) console.log('  ' + n);
}

if (require.main === module) main();
