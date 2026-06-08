#!/usr/bin/env node
// Retroactively apply hobbyistAdvisory to species researched before the schema
// field existed. Future Stage C dispatches set the field at write time.

const fs = require('fs');
const path = require('path');

const SPECIES_DIR = path.resolve(__dirname, '..', 'species');

const ADVISORIES = {
  // public-aquarium-only — wholly inappropriate for any home setup
  'asian-arowana': {
    level: 'public-aquarium-only',
    reason: 'Reaches ~90 cm and requires 1500 L+ tanks; CITES Appendix I + US Endangered Species Act import ban regardless of farm origin.',
  },
  'electric-eel': {
    level: 'public-aquarium-only',
    reason: 'Reaches 2 m+ and delivers 600 V+ electric discharges; public-aquarium handling protocols and insulated husbandry mandatory.',
  },
  'electric-catfish': {
    level: 'public-aquarium-only',
    reason: 'Reaches 60+ cm and generates 300–400 V discharges; strict species-only tank with handler shock-hazard protocols.',
  },
  'red-tailed-catfish': {
    level: 'public-aquarium-only',
    reason: 'Reaches 130–180 cm in wild; needs 5000 L+ public-aquarium-scale enclosure. Sold tiny but rapidly outgrows every home setup.',
  },
  'basa-catfish': {
    level: 'public-aquarium-only',
    reason: 'Reaches 100+ cm at maturity; commercial food fish kept tiny in trade and outgrows all home setups within months.',
  },
  'clown-knifefish': {
    level: 'public-aquarium-only',
    reason: 'Reaches 80–100 cm; predatory and established invasive in Florida via aquarium releases. Hobby-unsuitable at adult size.',
  },
  'giant-gourami': {
    level: 'public-aquarium-only',
    reason: 'Reaches ~70 cm; needs 1500 L+ tanks. Juveniles sold under the same common name mask the adult size.',
  },
  'payara-vampire-tetra': {
    level: 'public-aquarium-only',
    reason: 'Reaches 60+ cm; needs 1000 L+ high-O2 flowing tanks and a live-fish-only diet. Specialist or public-aquarium setups only.',
  },

  // pond-only — outgrows aquaria but viable in outdoor ponds at adult size
  'common-carp': {
    level: 'pond-only',
    reason: 'Reaches 60–120 cm and lives 40+ years; pond-only at maturity. Koi varieties are the domesticated form of this species.',
  },

  // specialist-only — possible at home but requires an advanced specialist commitment
  'fahaka-puffer': {
    level: 'specialist-only',
    reason: 'Reaches 40–45 cm and requires a strictly species-only tank with no viable tankmates; specialist single-fish setup only.',
  },
  'tire-track-eel': {
    level: 'specialist-only',
    reason: 'Reaches 60–90 cm in aquaria; needs 500 L+ tank with deep sand substrate and tight-sealed gaps. Specialist commitment.',
  },
  'fire-eel': {
    level: 'specialist-only',
    reason: 'Reaches 60–80 cm in aquaria (1 m wild); needs 500 L+ tank with deep sand and sealed gaps. Specialist commitment.',
  },

  // legally-restricted — legal/regulatory barriers regardless of husbandry feasibility
  'mosquitofish': {
    level: 'legally-restricted',
    reason: 'IUCN-listed among the 100 World’s Worst Invasive Alien Species; import/release banned in the EU, Australia, and other jurisdictions.',
  },
};

function main() {
  let applied = 0, skipped = 0, missing = [];
  for (const [slug, advisory] of Object.entries(ADVISORIES)) {
    const candidates = walkFor(SPECIES_DIR, slug + '.json');
    if (candidates.length === 0) { missing.push(slug); continue; }
    if (candidates.length > 1) {
      console.warn(`! Multiple files match ${slug}: ${candidates.join(', ')} — picking first`);
    }
    const fp = candidates[0];
    const j = JSON.parse(fs.readFileSync(fp, 'utf8'));
    if (j.hobbyistAdvisory && j.hobbyistAdvisory.level === advisory.level) {
      skipped++;
      continue;
    }
    j.hobbyistAdvisory = advisory;
    fs.writeFileSync(fp, JSON.stringify(j, null, 2) + '\n');
    applied++;
  }
  console.log(`Applied: ${applied}  Skipped (already-set): ${skipped}  Missing files: ${missing.length}`);
  if (missing.length) console.log('  Missing slugs:', missing.join(', '));
}

function walkFor(dir, name) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walkFor(full, name));
    else if (entry.name === name) out.push(full);
  }
  return out;
}

if (require.main === module) main();
