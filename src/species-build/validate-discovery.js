const fs = require('fs');
const path = require('path');
const Ajv = require('ajv/dist/2020');
const addFormats = require('ajv-formats');

const SCHEMA_PATH = path.resolve(__dirname, '..', 'species-schema', 'manifest.schema.json');
const DEFAULT_DIR = path.resolve(__dirname, 'discovery');

function makeValidator() {
  const ajv = new Ajv({ allErrors: true, strict: true });
  addFormats(ajv);
  const schema = JSON.parse(fs.readFileSync(SCHEMA_PATH, 'utf8'));
  return ajv.compile(schema);
}

const validate = makeValidator();

function validateOneManifest(payload) {
  const ok = validate(payload);
  return {
    ok: !!ok,
    errors: validate.errors ? validate.errors.map(e => ({
      keyword: e.keyword,
      instancePath: e.instancePath,
      schemaPath: e.schemaPath,
      message: e.message,
      params: e.params
    })) : []
  };
}

function validateDiscoveryDir(dir) {
  if (!fs.existsSync(dir)) {
    return { ok: true, fileResults: [] };
  }
  const files = fs.readdirSync(dir)
    .filter(name => name.endsWith('.json'))
    .map(name => path.join(dir, name));
  const fileResults = files.map(file => {
    let payload;
    try {
      payload = JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch (err) {
      return { file, ok: false, errors: [{ keyword: 'parse', message: `JSON parse error: ${err.message}` }] };
    }
    const result = validateOneManifest(payload);
    return { file, ok: result.ok, errors: result.errors };
  });
  const ok = fileResults.every(r => r.ok);
  return { ok, fileResults };
}

function formatResult(result) {
  const lines = [];
  for (const r of result.fileResults) {
    const display = path.relative(process.cwd(), r.file);
    if (r.ok) {
      lines.push(`✓ ${display}`);
    } else {
      lines.push(`✗ ${display}`);
      for (const e of r.errors) {
        lines.push(`    ${e.instancePath || '(root)'}: ${e.message}`);
      }
    }
  }
  if (result.fileResults.length === 0) {
    lines.push('(no manifests found)');
  }
  return lines.join('\n');
}

if (require.main === module) {
  const dir = process.argv[2] || DEFAULT_DIR;
  const result = validateDiscoveryDir(dir);
  console.log(formatResult(result));
  if (!result.ok) {
    console.error(`\nValidation failed for ${result.fileResults.filter(r => !r.ok).length} file(s).`);
    process.exit(1);
  }
  console.log(`\nValidated ${result.fileResults.length} manifest file(s) successfully.`);
}

module.exports = { validateOneManifest, validateDiscoveryDir, formatResult };
