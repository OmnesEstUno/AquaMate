const path = require('path');
const { validateOne, validateAll } = require('../validate');

const FIXTURES = path.resolve(__dirname, 'fixtures');
const SCHEMA_FIXTURES = path.resolve(__dirname, '../../species-schema/__tests__/fixtures');

describe('validate.js — single-file mode', () => {
  test('valid fish entry passes', () => {
    const result = validateOne(path.join(SCHEMA_FIXTURES, 'valid-fish-researched.json'));
    expect(result.errors).toEqual([]);
    expect(result.ok).toBe(true);
  });

  test('invalid extra-property entry fails with structured errors', () => {
    const result = validateOne(path.join(SCHEMA_FIXTURES, 'invalid-extra-property.json'));
    expect(result.ok).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]).toHaveProperty('keyword');
    expect(result.errors[0]).toHaveProperty('instancePath');
  });

  test('rejects min > max in a numeric range (post-schema rule)', () => {
    const result = validateOne(path.join(FIXTURES, 'invalid-min-gt-max.json'));
    expect(result.ok).toBe(false);
    expect(result.errors.some(e =>
      e.keyword === 'min-le-max' && e.instancePath.includes('/adultSizeCm')
    )).toBe(true);
  });

  test('accepts a valid min <= max', () => {
    const result = validateOne(path.join(FIXTURES, 'valid-min-max.json'));
    expect(result.errors).toEqual([]);
    expect(result.ok).toBe(true);
  });
});

describe('validate.js — multi-file mode', () => {
  test('validateAll returns array of {filePath, ok, errors}', () => {
    const results = validateAll([
      path.join(SCHEMA_FIXTURES, 'valid-fish-researched.json'),
      path.join(SCHEMA_FIXTURES, 'invalid-extra-property.json')
    ]);
    expect(results).toHaveLength(2);
    expect(results[0].filePath).toBe(path.join(SCHEMA_FIXTURES, 'valid-fish-researched.json'));
    expect(results[0].ok).toBe(true);
    expect(results[1].ok).toBe(false);
  });
});
