const path = require('path');
const { buildWorklist } = require('../list-species');

const FIXTURES = path.resolve(__dirname, 'fixtures');

test('builds a sorted worklist with identifiers', () => {
  const list = buildWorklist(FIXTURES);
  expect(list).toHaveLength(2);
  expect(list[0].id).toBe('fw-fish-900'); // sorted by id
  expect(list[0]).toMatchObject({
    slug: 'test-a', taxon: 'fish', waterType: 'freshwater',
    commonName: 'Test A', scientificName: 'Genus speciesa', alsoKnownAs: ['Old namea'],
  });
  expect(list[0].file).toContain('a.json');
});
