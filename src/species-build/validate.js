const fs = require('fs');
const path = require('path');
const { globSync } = require('glob');
const Ajv = require('ajv/dist/2020');
const addFormats = require('ajv-formats');

const SCHEMA_DIR = path.resolve(__dirname, '..', 'species-schema');
const SPECIES_DIR = path.resolve(__dirname, '..', 'species');

function buildValidator() {
  const schema = JSON.parse(fs.readFileSync(path.join(SCHEMA_DIR, 'species.schema.json'), 'utf8'));
  const enums = JSON.parse(fs.readFileSync(path.join(SCHEMA_DIR, 'enums.json'), 'utf8'));
  const ajv = new Ajv({ allErrors: true, strict: true });
  addFormats(ajv);
  ajv.addSchema(enums, 'enums.json');
  return ajv.compile(schema);
}

// Walk an object looking for any {min, max} where both are numbers and min > max.
// Returns an array of {instancePath, min, max}.
function checkMinMax(obj, instancePath = '') {
  const violations = [];
  if (obj === null || typeof obj !== 'object') return violations;
  if (Array.isArray(obj)) {
    obj.forEach((v, i) => {
      violations.push(...checkMinMax(v, `${instancePath}/${i}`));
    });
    return violations;
  }
  const hasMin = Object.prototype.hasOwnProperty.call(obj, 'min');
  const hasMax = Object.prototype.hasOwnProperty.call(obj, 'max');
  if (hasMin && hasMax && typeof obj.min === 'number' && typeof obj.max === 'number' && obj.min > obj.max) {
    violations.push({ instancePath, min: obj.min, max: obj.max });
  }
  for (const [k, v] of Object.entries(obj)) {
    violations.push(...checkMinMax(v, `${instancePath}/${k}`));
  }
  return violations;
}

const validateAjv = buildValidator();

function validateOne(filePath) {
  let data;
  try {
    data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (e) {
    return {
      filePath,
      ok: false,
      errors: [{ keyword: 'parse', instancePath: '', message: `JSON parse error: ${e.message}` }]
    };
  }
  const ok = validateAjv(data);
  const schemaErrors = ok ? [] : (validateAjv.errors || []).map(e => ({
    keyword: e.keyword,
    instancePath: e.instancePath,
    schemaPath: e.schemaPath,
    message: e.message,
    params: e.params
  }));
  const minMaxViolations = checkMinMax(data).map(v => ({
    keyword: 'min-le-max',
    instancePath: v.instancePath,
    message: `min (${v.min}) must be <= max (${v.max})`
  }));
  const errors = [...schemaErrors, ...minMaxViolations];
  return { filePath, ok: errors.length === 0, errors };
}

function validateAll(filePaths) {
  return filePaths.map(validateOne);
}

function findAllSpeciesFiles() {
  return globSync('**/*.json', { cwd: SPECIES_DIR, absolute: true });
}

function formatErrors(result) {
  if (result.ok) return '';
  const rel = path.relative(process.cwd(), result.filePath);
  const lines = result.errors.map(e =>
    `  ${e.instancePath || '/'} (${e.keyword}): ${e.message || ''}`
  );
  return [`✗ ${rel}`, ...lines].join('\n');
}

// CLI entrypoint
if (require.main === module) {
  const argv = process.argv.slice(2);
  let targets;
  if (argv.length === 0) {
    targets = findAllSpeciesFiles();
  } else {
    targets = argv.map(a => path.resolve(a));
  }
  if (targets.length === 0) {
    console.log('No species files found.');
    process.exit(0);
  }
  const results = validateAll(targets);
  const failures = results.filter(r => !r.ok);
  if (failures.length === 0) {
    console.log(`✓ ${results.length} species file(s) validated successfully.`);
    process.exit(0);
  }
  failures.forEach(r => console.error(formatErrors(r)));
  console.error(`\n${failures.length} of ${results.length} files failed validation.`);
  process.exit(1);
}

module.exports = { validateOne, validateAll, findAllSpeciesFiles, formatErrors };
