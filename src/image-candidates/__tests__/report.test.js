const { buildReport } = require('../report');

const rows = [
  { id: 'fw-1', slug: 'a', taxon: 'fish', count: 3 },
  { id: 'fw-2', slug: 'b', taxon: 'fish', count: 1 },
  { id: 'fw-3', slug: 'c', taxon: 'coral', count: 0 },
  { id: 'fw-4', slug: 'd', taxon: 'plant', count: null },
];

test('summarizes counts and lists the shortfalls', () => {
  const md = buildReport(rows);
  expect(md).toContain('Total species: 4');
  expect(md).toContain('Processed: 3');
  expect(md).toContain('Unprocessed (imageCandidates null): 1');
  expect(md).toContain('Zero candidates found: 1');
  expect(md).toContain('Fewer than 3 (1-2): 1');
  expect(md).toContain('fw-2'); // the 1-candidate entry appears in the shortfall list
  expect(md).toContain('fw-3'); // the zero entry appears
  expect(md).not.toContain('fw-1'); // the complete entry is not listed as a shortfall
});
