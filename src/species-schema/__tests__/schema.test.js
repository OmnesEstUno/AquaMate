const path = require('path');
const Ajv = require('ajv/dist/2020');
const addFormats = require('ajv-formats');
const schema = require('../species.schema.json');
const enums = require('../enums.json');

function buildAjv() {
  const ajv = new Ajv({ allErrors: true, strict: true });
  addFormats(ajv);
  ajv.addSchema(enums, 'enums.json');
  return ajv.compile(schema);
}

function loadFixture(name) {
  return JSON.parse(JSON.stringify(require(`./fixtures/${name}.json`)));
}

describe('species.schema.json — scaffold', () => {
  const validate = buildAjv();

  test('accepts a minimal valid placeholder entry', () => {
    const ok = validate(loadFixture('valid-fish-placeholder'));
    expect(validate.errors).toBeNull();
    expect(ok).toBe(true);
  });

  test('rejects entry with extra top-level property (closed schema)', () => {
    const ok = validate(loadFixture('invalid-extra-property'));
    expect(ok).toBe(false);
    expect(validate.errors.some(e => e.keyword === 'additionalProperties')).toBe(true);
  });

  test('rejects entry missing id', () => {
    const ok = validate(loadFixture('invalid-missing-id'));
    expect(ok).toBe(false);
    expect(validate.errors.some(e =>
      e.keyword === 'required' && e.params.missingProperty === 'id'
    )).toBe(true);
  });
});

describe('species.schema.json — body subschemas', () => {
  const validate = buildAjv();

  test('rejects sources.additional with more than 5 entries', () => {
    const ok = validate(loadFixture('invalid-too-many-additional-sources'));
    expect(ok).toBe(false);
    expect(validate.errors.some(e => e.keyword === 'maxItems' && e.instancePath === '/sources/additional')).toBe(true);
  });

  test('rejects waterParameters with extra property', () => {
    const entry = loadFixture('valid-fish-placeholder');
    entry.waterParameters.unknownParam = { min: 1, max: 2 };
    const ok = validate(entry);
    expect(ok).toBe(false);
    expect(validate.errors.some(e => e.keyword === 'additionalProperties' && e.instancePath === '/waterParameters')).toBe(true);
  });

  test('accepts adultSizeCm with valid min/max range', () => {
    const entry = loadFixture('valid-fish-placeholder');
    entry.adultSizeCm = { min: 3.0, max: 4.0 };
    expect(validate(entry)).toBe(true);
  });

  test.skip('rejects adultSizeCm with min > max (enforced in validate.js post-pass, see Task 8)', () => {
    // moved to validate.test.js
  });
});
