#!/usr/bin/env node
// Cross-file ID uniqueness check. The per-file validator doesn't catch ID
// collisions across files — this script does.
// Run after each batch commit.

const fs = require('fs');
const path = require('path');

const SPECIES_DIR = path.resolve(__dirname, '..', 'species');

function walkDir(dir) {
  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...walkDir(full));
    else if (entry.isFile() && entry.name.endsWith('.json')) files.push(full);
  }
  return files;
}

function main() {
  const files = walkDir(SPECIES_DIR);
  const ids = {};
  for (const fp of files) {
    const j = JSON.parse(fs.readFileSync(fp, 'utf8'));
    if (!ids[j.id]) ids[j.id] = [];
    ids[j.id].push(path.relative(SPECIES_DIR, fp));
  }
  const duplicates = Object.entries(ids).filter(([_, files]) => files.length > 1);
  if (duplicates.length === 0) {
    console.log(`✓ ${files.length} species files — all IDs unique.`);
    process.exit(0);
  }
  console.error(`✗ Found ${duplicates.length} duplicate ID(s):`);
  for (const [id, paths] of duplicates) {
    console.error(`  ${id}`);
    for (const p of paths) console.error(`    - ${p}`);
  }
  process.exit(1);
}

if (require.main === module) main();
