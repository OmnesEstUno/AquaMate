const fs = require('fs');
const path = require('path');

const PROMOTION_THRESHOLD = 5;

function summarize(logPath) {
  if (!fs.existsSync(logPath)) {
    return { groups: [], promotionCandidates: [], malformedLines: 0, totalSuggestions: 0 };
  }
  const raw = fs.readFileSync(logPath, 'utf8');
  const lines = raw.split('\n').filter(l => l.trim().length > 0);

  const byField = new Map();
  let malformedLines = 0;
  for (const line of lines) {
    let suggestion;
    try {
      suggestion = JSON.parse(line);
    } catch {
      malformedLines++;
      continue;
    }
    const field = suggestion.suggestedField;
    if (!field) {
      malformedLines++;
      continue;
    }
    if (!byField.has(field)) {
      byField.set(field, {
        suggestedField: field,
        count: 0,
        species: [],
        suggestedTypes: new Set(),
        reasons: []
      });
    }
    const group = byField.get(field);
    group.count++;
    group.species.push(suggestion.species);
    if (suggestion.suggestedType) group.suggestedTypes.add(suggestion.suggestedType);
    if (suggestion.reason) group.reasons.push(suggestion.reason);
  }

  const groups = [...byField.values()]
    .map(g => ({
      suggestedField: g.suggestedField,
      count: g.count,
      species: g.species,
      suggestedTypes: [...g.suggestedTypes],
      sampleReasons: g.reasons.slice(0, 3)
    }))
    .sort((a, b) => b.count - a.count);

  const promotionCandidates = groups.filter(g => g.count >= PROMOTION_THRESHOLD);

  return {
    groups,
    promotionCandidates,
    malformedLines,
    totalSuggestions: lines.length - malformedLines
  };
}

function formatSummary(s) {
  const lines = [];
  lines.push(`Field-gap suggestions: ${s.totalSuggestions} valid, ${s.malformedLines} malformed`);
  lines.push('');
  lines.push(`Promotion candidates (>= ${PROMOTION_THRESHOLD} suggestions):`);
  if (s.promotionCandidates.length === 0) {
    lines.push('  (none)');
  } else {
    for (const g of s.promotionCandidates) {
      lines.push(`  - ${g.suggestedField} [${g.suggestedTypes.join(', ') || '?'}]: ${g.count} species`);
      lines.push(`      species: ${g.species.join(', ')}`);
      for (const r of g.sampleReasons) lines.push(`      reason: ${r}`);
    }
  }
  lines.push('');
  lines.push('All groups (advisory):');
  if (s.groups.length === 0) {
    lines.push('  (none)');
  } else {
    for (const g of s.groups) {
      lines.push(`  - ${g.suggestedField}: ${g.count}`);
    }
  }
  return lines.join('\n');
}

if (require.main === module) {
  const repoRoot = path.resolve(__dirname, '..', '..');
  const logPath = path.join(repoRoot, 'src', 'species-build', 'field-gap-suggestions.jsonl');
  const summary = summarize(logPath);
  console.log(formatSummary(summary));
}

module.exports = { summarize, formatSummary, PROMOTION_THRESHOLD };
