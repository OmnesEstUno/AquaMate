#!/usr/bin/env node
// Saltwater placeholder cleanup — same treatment as fish-fw.
// CRITICAL: only operate on entries where dataStatus === 'placeholder'.
// Researched legacy sw-NNN entries (same ID format) must not be touched.

const fs = require('fs');
const path = require('path');
const FISH_DIR = path.resolve(__dirname, '..', 'species', 'fish');

// Trade common name → scientific name mapping for all SW placeholders.
const MAPPING = {
  'sw-001': { sci: 'Amphiprion ocellaris', note: 'Ocellaris Clownfish — primary "false percula" of trade' },
  'sw-003': { sci: 'Amphiprion ocellaris', note: 'Black Ocellaris — color morph of A. ocellaris' },
  'sw-004': { sci: 'Amphiprion ocellaris', note: 'Snowflake Clownfish — A. ocellaris designer morph' },
  'sw-005': { sci: 'Amphiprion percula', note: 'Picasso Clownfish — A. percula designer morph' },
  'sw-006': { sci: 'Premnas biaculeatus', note: 'Maroon Clownfish (now Amphiprion biaculeatus per recent revision)' },
  'sw-007': { sci: 'Premnas biaculeatus', note: 'Gold Stripe Maroon — color morph of P. biaculeatus' },
  'sw-008': { sci: 'Amphiprion frenatus', note: 'Tomato Clownfish' },
  'sw-009': { sci: 'Amphiprion clarkii', note: "Clarkii Clownfish — Clark's Anemonefish" },
  'sw-011': { sci: 'Paracanthurus hepatus', note: 'Blue Tang / Hippo Tang / Dory' },
  'sw-012': { sci: 'Zebrasoma flavescens', note: 'Yellow Tang' },
  'sw-013': { sci: 'Zebrasoma xanthurum', note: 'Purple Tang' },
  'sw-014': { sci: 'Ctenochaetus strigosus', note: 'Kole Tang — Yellow-Eye Kole' },
  'sw-015': { sci: 'Ctenochaetus hawaiiensis', note: 'Chevron Tang' },
  'sw-016': { sci: 'Acanthurus leucosternon', note: 'Powder Blue Tang' },
  'sw-017': { sci: 'Acanthurus japonicus', note: 'Powder Brown Tang / White-Faced' },
  'sw-018': { sci: 'Acanthurus achilles', note: 'Achilles Tang' },
  'sw-019': { sci: 'Zebrasoma desjardinii', note: 'Sailfin Tang — Z. desjardinii (Indo-Pacific) or Z. veliferum (Pacific)' },
  'sw-020': { sci: 'Naso lituratus', note: 'Naso Tang / Orange-Spine Unicornfish' },
  'sw-021': { sci: 'Pseudocheilinus hexataenia', note: 'Six Line Wrasse' },
  'sw-022': { sci: 'Halichoeres melanurus', note: 'Melanurus Wrasse' },
  'sw-024': { sci: 'Labroides dimidiatus', note: 'Cleaner Wrasse — Common Bluestreak Cleaner' },
  'sw-025': { sci: 'Macropharyngodon meleagris', note: 'Leopard Wrasse — M. meleagris most common' },
  'sw-026': { sci: 'Thalassoma trilobatum', note: 'Christmas Wrasse' },
  'sw-027': { sci: 'Cirrhilabrus spp.', note: 'Fairy Wrasses — genus group (many species)' },
  'sw-028': { sci: 'Paracheilinus spp.', note: 'Flasher Wrasses — genus group' },
  'sw-029': { sci: 'Novaculichthys taeniourus', note: 'Dragon Wrasse / Rockmover (juvenile color)' },
  'sw-031': { sci: 'Cryptocentrus cinctus', note: 'Yellow Watchman Goby' },
  'sw-033': { sci: 'Nemateleotris magnifica', note: 'Firefish Goby — actually a dartfish' },
  'sw-034': { sci: 'Nemateleotris decora', note: 'Purple Firefish' },
  'sw-035': { sci: 'Pholidichthys leucotaenia', note: 'Engineer Goby — actually Convict Blenny' },
  'sw-036': { sci: 'Gobiodon okinawae', note: 'Clown Goby — Yellow Clown Goby most common' },
  'sw-037': { sci: 'Valenciennea puellaris', note: 'Diamond Watchman Goby' },
  'sw-038': { sci: 'Amblygobius phalaena', note: 'Sleeper Banded Goby' },
  'sw-039': { sci: 'Koumansetta rainfordi', note: "Court Jester Goby / Rainford's" },
  'sw-040': { sci: 'Lythrypnus dalli', note: 'Catalina Goby — temperate water' },
  'sw-043': { sci: 'Ecsenius midas', note: 'Midas Blenny' },
  'sw-044': { sci: 'Ecsenius bicolor', note: 'Bicolor Blenny' },
  'sw-045': { sci: 'Salarias ramosus', note: 'Starry Blenny' },
  'sw-046': { sci: 'Meiacanthus oualanensis', note: 'Canary Blenny — Yellow Fang' },
  'sw-055': { sci: 'Centropyge loricula', note: 'Flame Angel' },
  'sw-058': { sci: 'Pomacanthus imperator', note: 'Emperor Angel' },
  'sw-059': { sci: 'Pygoplites diacanthus', note: 'Regal Angel' },
  'sw-061': { sci: 'Pomacanthus navarchus', note: 'Majestic Angel / Blue-Girdled Angel' },
  'sw-063': { sci: 'Pomacanthus paru', note: 'French Angel' },
  'sw-067': { sci: 'Chaetodon auriga', note: 'Threadfin Butterfly' },
  'sw-068': { sci: 'Chaetodon kleinii', note: "Klein's Butterfly" },
  'sw-071': { sci: 'Neocirrhites armatus', note: 'Flame Hawkfish' },
  'sw-072': { sci: 'Oxycirrhites typus', note: 'Longnose Hawkfish' },
  'sw-073': { sci: 'Cirrhitichthys falco', note: 'Falco Hawkfish' },
  'sw-074': { sci: 'Paracirrhites arcatus', note: 'Arc Eye Hawkfish' },
  'sw-076': { sci: 'Pseudanthias bartlettorum', note: "Bartlett's Anthias" },
  'sw-077': { sci: 'Pseudanthias dispar', note: 'Dispar Anthias / Madder Seaperch' },
  'sw-078': { sci: 'Pseudanthias pleurotaenia', note: 'Squareback Anthias / Square-Spot' },
  'sw-080': { sci: 'Pseudanthias bicolor', note: 'Bicolor Anthias' },
  'sw-081': { sci: 'Rhinecanthus aculeatus', note: 'Picasso Trigger / Lagoon Triggerfish' },
  'sw-082': { sci: 'Odonus niger', note: 'Niger Trigger / Red-Tooth' },
  'sw-083': { sci: 'Balistoides conspicillum', note: 'Clown Trigger' },
  'sw-084': { sci: 'Xanthichthys auromarginatus', note: 'Blue Throat Trigger' },
  'sw-085': { sci: 'Melichthys vidua', note: 'Pink Tail Trigger' },
  'sw-086': { sci: 'Diodon holocanthus', note: 'Porcupine Puffer (Long-Spined)' },
  'sw-087': { sci: 'Arothron nigropunctatus', note: 'Dogface Puffer' },
  'sw-088': { sci: 'Arothron hispidus', note: 'Stars and Stripes Puffer' },
  'sw-090': { sci: 'Canthigaster solandri', note: 'Blue Spotted Puffer / Sharp-Nose Puffer' },
  'sw-091': { sci: 'Pterois volitans', note: 'Volitan Lionfish' },
  'sw-092': { sci: 'Dendrochirus brachypterus', note: 'Dwarf Lionfish / Fuzzy Dwarf' },
  'sw-093': { sci: 'Dendrochirus biocellatus', note: 'Fu Manchu Lionfish / Twin-Spot' },
  'sw-095': { sci: 'Echidna nebulosa', note: 'Snowflake Eel / Snowflake Moray' },
  'sw-098': { sci: 'Enchelycore pardalis', note: 'Dragon Moray — Hawaiian Dragon Eel' },
  'sw-099': { sci: 'Hemiscyllium ocellatum', note: 'Epaulette Shark' },
  'sw-100': { sci: 'Chiloscyllium punctatum', note: 'Bamboo Shark — Brownbanded' },
  'sw-101': { sci: 'Atelomycterus marmoratus', note: 'Coral Catshark' },
  'sw-102': { sci: 'Taeniura lymma', note: 'Blue Spotted Ray / Bluespotted Ribbontail Ray' },
  'sw-103': { sci: 'Synchiropus splendidus', note: 'Mandarin Dragonet — Mandarinfish' },
  'sw-104': { sci: 'Synchiropus ocellatus', note: 'Scooter Blenny — actually a Scooter Dragonet' },
  'sw-105': { sci: 'Pterapogon kauderni', note: 'Banggai Cardinalfish' },
  'sw-106': { sci: 'Sphaeramia nematoptera', note: 'Pajama Cardinalfish' },
  'sw-107': { sci: 'Sargocentron caudimaculatum', note: 'Squirrelfish — multiple Holocentridae spp.' },
  'sw-108': { sci: 'Myripristis kuntee', note: 'Soldierfish — multiple Holocentridae spp.' },
  'sw-109': { sci: 'Oxymonacanthus longirostris', note: 'Filefish — Orange-Spotted most common' },
  'sw-110': { sci: 'Siganus vulpinus', note: 'Rabbitfish — Foxface Lo Rabbitfish most common' },
  'sw-111': { sci: 'Zanclus cornutus', note: 'Moorish Idol' },
  'sw-112': { sci: 'Hippocampus erectus', note: 'Seahorses — genus group (many species)' },
  'sw-113': { sci: 'Doryrhamphus excisus', note: 'Pipefish — Banded/Janss most common in trade' },
  'sw-114': { sci: 'Scaridae spp.', note: 'Parrotfish — genus group; many species, mostly public-aquarium' },
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
  // Build researched-SW sci → id map
  const researchedSci = new Map();
  for (const f of fs.readdirSync(FISH_DIR)) {
    const j = JSON.parse(fs.readFileSync(path.join(FISH_DIR, f), 'utf8'));
    if (j.waterType === 'saltwater' && j.dataStatus === 'researched') {
      researchedSci.set((j.scientificName || '').toLowerCase().trim(), j.id);
    }
  }

  let deleted = 0, annotated = 0, skipped = 0, notFound = 0;
  const summary = { dups: [], kept: [] };

  for (const [id, info] of Object.entries(MAPPING)) {
    const f = findFile(id);
    if (!f) { notFound++; continue; }
    // SAFETY: only act on actual placeholders
    if (f.data.dataStatus !== 'placeholder') {
      console.error(`! SAFETY SKIP: ${id} is dataStatus=${f.data.dataStatus} (not placeholder); leaving untouched.`);
      skipped++;
      continue;
    }

    const sciLower = info.sci.toLowerCase().trim();
    const isGenusGroup = /spp\.|\bgenus\b/i.test(info.sci);
    const matchedId = researchedSci.get(sciLower);

    if (matchedId || isGenusGroup) {
      // delete dup
      fs.unlinkSync(f.path);
      deleted++;
      summary.dups.push(`${id} ${f.data.commonName} → ${info.sci}${matchedId ? ' (' + matchedId + ')' : ' (generic group)'}`);
    } else {
      // annotate keeper
      f.data.scientificName = info.sci;
      f.data.alsoKnownAs = [...(f.data.alsoKnownAs || []), `[pending-research] ${info.note}`];
      fs.writeFileSync(f.path, JSON.stringify(f.data, null, 2) + '\n');
      annotated++;
      summary.kept.push(`${id} ${f.data.commonName} → ${info.sci}`);
    }
  }

  console.log('\n=== DELETED (dups of researched + generic groups) ===');
  summary.dups.forEach(s => console.log('  ✗', s));
  console.log('\n=== ANNOTATED (kept for audit) ===');
  summary.kept.forEach(s => console.log('  ✎', s));
  console.log(`\nDeleted: ${deleted}  Annotated: ${annotated}  Safety-skipped: ${skipped}  Not-found: ${notFound}`);
}

if (require.main === module) main();
