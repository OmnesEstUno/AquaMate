const { seededShuffle } = require('../shuffle');

describe('seededShuffle', () => {
  test('same seed produces same order', () => {
    const items = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const a = seededShuffle(items, 42);
    const b = seededShuffle(items, 42);
    expect(a).toEqual(b);
  });

  test('different seeds produce different order (in most cases)', () => {
    const items = Array.from({ length: 50 }, (_, i) => i);
    const a = seededShuffle(items, 1);
    const b = seededShuffle(items, 2);
    expect(a).not.toEqual(b);
  });

  test('output contains exactly the input elements', () => {
    const items = [1, 2, 3, 4, 5];
    const shuffled = seededShuffle(items, 999);
    expect(shuffled.sort()).toEqual([1, 2, 3, 4, 5]);
  });

  test('does not mutate the input array', () => {
    const items = [1, 2, 3, 4, 5];
    const before = [...items];
    seededShuffle(items, 42);
    expect(items).toEqual(before);
  });

  test('empty array returns empty', () => {
    expect(seededShuffle([], 42)).toEqual([]);
  });

  test('single element returns single element', () => {
    expect(seededShuffle(['x'], 42)).toEqual(['x']);
  });
});
