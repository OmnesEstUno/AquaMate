'use strict';

// Prints the candidate cap for a species file (3 species / 20 genus / 24 umbrella),
// so the curator agent and the writer agree on the target. Usage:
//   node src/image-candidates/target.js <speciesFile>
const fs = require('fs');
const { targetCount } = require('./lib');

if (require.main === module) {
  const [speciesFile] = process.argv.slice(2);
  if (!speciesFile) {
    console.error('usage: node target.js <speciesFile>');
    process.exit(2);
  }
  const data = JSON.parse(fs.readFileSync(speciesFile, 'utf8'));
  process.stdout.write(String(targetCount(data)) + '\n');
}
