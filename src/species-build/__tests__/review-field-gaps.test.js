const fs = require('fs');
const os = require('os');
const path = require('path');
const { summarize } = require('../review-field-gaps');

function withTempFile(lines, fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aquamate-gaps-'));
  const file = path.join(dir, 'field-gap-suggestions.jsonl');
  fs.writeFileSync(file, lines.map(l => JSON.stringify(l)).join('\n') + (lines.length ? '\n' : ''));
  try { return fn(file); } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}

describe('review-field-gaps', () => {
  test('returns empty summary for empty log', () => {
    withTempFile([], file => {
      const s = summarize(file);
      expect(s.groups).toEqual([]);
      expect(s.promotionCandidates).toEqual([]);
    });
  });

  test('groups suggestions by suggestedField with counts and species lists', () => {
    withTempFile([
      { species: 'fw-010', slug: 'a', suggestedField: 'plantEater', suggestedType: 'boolean', reason: 'eats plants', valueForThisSpecies: true },
      { species: 'fw-011', slug: 'b', suggestedField: 'plantEater', suggestedType: 'boolean', reason: 'destroys plants', valueForThisSpecies: true }
    ], file => {
      const s = summarize(file);
      expect(s.groups).toHaveLength(1);
      expect(s.groups[0].suggestedField).toBe('plantEater');
      expect(s.groups[0].count).toBe(2);
      expect(s.groups[0].species).toEqual(['fw-010', 'fw-011']);
    });
  });

  test('flags fields with 5+ suggestions as promotion candidates', () => {
    const five = Array.from({ length: 5 }, (_, i) => ({
      species: `fw-${100 + i}`,
      slug: `s${i}`,
      suggestedField: 'plantEater',
      suggestedType: 'boolean',
      reason: 'eats plants',
      valueForThisSpecies: true
    }));
    withTempFile(five, file => {
      const s = summarize(file);
      expect(s.promotionCandidates.map(g => g.suggestedField)).toContain('plantEater');
    });
  });

  test('does NOT flag fields with 4 suggestions as promotion candidates', () => {
    const four = Array.from({ length: 4 }, (_, i) => ({
      species: `fw-${200 + i}`,
      slug: `s${i}`,
      suggestedField: 'lessCommon',
      suggestedType: 'boolean',
      reason: 'rare',
      valueForThisSpecies: false
    }));
    withTempFile(four, file => {
      const s = summarize(file);
      expect(s.promotionCandidates).toEqual([]);
      expect(s.groups[0].count).toBe(4);
    });
  });

  test('skips malformed JSON lines but reports them', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aquamate-gaps-bad-'));
    const file = path.join(dir, 'log.jsonl');
    fs.writeFileSync(file, `${JSON.stringify({ species: 'x', slug: 'x', suggestedField: 'f', suggestedType: 'boolean', reason: 'r', valueForThisSpecies: 1 })}\nnot-json\n`);
    try {
      const s = summarize(file);
      expect(s.malformedLines).toBe(1);
      expect(s.groups).toHaveLength(1);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
