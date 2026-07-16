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
