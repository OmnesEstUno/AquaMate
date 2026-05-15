const fs = require('fs');
const path = require('path');
const Ajv = require('ajv/dist/2020');
const addFormats = require('ajv-formats');

const schemaPath = path.resolve(__dirname, '..', 'manifest.schema.json');
const enumsPath  = path.resolve(__dirname, '..', 'enums.json');
const validFixturePath = path.resolve(__dirname, 'fixtures', 'valid-manifest.json');

function makeValidator() {
  const ajv = new Ajv({ allErrors: true, strict: true });
  addFormats(ajv);
  const enums = JSON.parse(fs.readFileSync(enumsPath, 'utf8'));
  ajv.addSchema(enums, 'enums.json');
  const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
  return ajv.compile(schema);
}

function loadValid() {
  return JSON.parse(JSON.stringify(JSON.parse(fs.readFileSync(validFixturePath, 'utf8'))));
}

describe('manifest.schema.json', () => {
  test('accepts the valid fixture', () => {
    const validate = makeValidator();
    const ok = validate(loadValid());
    expect(validate.errors).toBeNull();
    expect(ok).toBe(true);
  });

  test('rejects when meta is missing', () => {
    const validate = makeValidator();
    const m = loadValid();
    delete m.meta;
    expect(validate(m)).toBe(false);
  });

  test('rejects unknown top-level properties', () => {
    const validate = makeValidator();
    const m = loadValid();
    m.surpriseField = 'oops';
    expect(validate(m)).toBe(false);
  });

  test('rejects taxon outside the enum', () => {
    const validate = makeValidator();
    const m = loadValid();
    m.meta.taxon = 'dragon';
    expect(validate(m)).toBe(false);
  });

  test('rejects entries with popularityScore > 10', () => {
    const validate = makeValidator();
    const m = loadValid();
    m.entries[0].popularityScore = 11;
    expect(validate(m)).toBe(false);
  });

  test('rejects entries with negative popularityScore', () => {
    const validate = makeValidator();
    const m = loadValid();
    m.entries[0].popularityScore = -1;
    expect(validate(m)).toBe(false);
  });

  test('rejects entries with taxonFitConfidence outside enum', () => {
    const validate = makeValidator();
    const m = loadValid();
    m.entries[0].taxonFitConfidence = 'super-high';
    expect(validate(m)).toBe(false);
  });

  test('accepts entries with null scientificName (some candidates lack one)', () => {
    const validate = makeValidator();
    const m = loadValid();
    m.entries[0].scientificName = null;
    expect(validate(m)).toBe(true);
  });

  test('rejects entries missing primarySourceUrl', () => {
    const validate = makeValidator();
    const m = loadValid();
    delete m.entries[0].primarySourceUrl;
    expect(validate(m)).toBe(false);
  });

  test('rejects entries with non-URI primarySourceUrl', () => {
    const validate = makeValidator();
    const m = loadValid();
    m.entries[0].primarySourceUrl = 'not a url';
    expect(validate(m)).toBe(false);
  });
});
