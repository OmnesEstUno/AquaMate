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
  return require(`./fixtures/${name}.json`);
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
