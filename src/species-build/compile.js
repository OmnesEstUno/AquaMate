const fs = require('fs');
const path = require('path');
const { globSync } = require('glob');

function emptyOutput() {
  return {
    fauna: {
      freshwater: { items: [] },
      saltwater:  { items: [] },
      brackish:   { items: [] }
    },
    flora: {
      freshwater: { items: [] },
      saltwater:  { items: [] },
      brackish:   { items: [] }
    }
  };
}

function compile({ speciesDir, outPath }) {
  const out = emptyOutput();
  if (fs.existsSync(speciesDir)) {
    const files = globSync('**/*.json', { cwd: speciesDir, absolute: true });
    for (const filePath of files) {
      const entry = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      const { kind, waterType } = entry;
      if (!out[kind] || !out[kind][waterType]) {
        throw new Error(`Invalid kind/waterType combination in ${filePath}: ${kind}/${waterType}`);
      }
      out[kind][waterType].items.push(entry);
    }
  }
  // Stable ordering — sort by id within each bucket
  for (const k of Object.keys(out)) {
    for (const w of Object.keys(out[k])) {
      out[k][w].items.sort((a, b) => a.id.localeCompare(b.id));
    }
  }
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2) + '\n');
  return { totalItems: countItems(out) };
}

function countItems(out) {
  let n = 0;
  for (const k of Object.keys(out)) {
    for (const w of Object.keys(out[k])) {
      n += out[k][w].items.length;
    }
  }
  return n;
}

if (require.main === module) {
  const repoRoot = path.resolve(__dirname, '..', '..');
  const report = compile({
    speciesDir: path.join(repoRoot, 'src', 'species'),
    outPath: path.join(repoRoot, 'dist', 'species.json')
  });
  console.log(`Compiled ${report.totalItems} species entries into dist/species.json.`);
}

module.exports = { compile, emptyOutput };
