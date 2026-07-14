#!/usr/bin/env node

// Bulk-upload per-species detail JSON files from dist/species-details/<kind>/<slug>.json
// to the appropriate R2 bucket (fauna → AQUAMATE_BUCKET_FAUNA, flora → AQUAMATE_BUCKET_FLORA)
// under the key prefix `species/<slug>.json`.
//
// Uses `wrangler r2 object put` under the hood (one call per file).
//
// Usage:
//   npm run compile-species             # rebuild dist/species-details/
//   node src/species-build/upload-species-details.js
//     [--only-kind fauna|flora]         # limit to one kind
//     [--dry-run]                       # print commands without executing
//     [--concurrency N]                 # default 4 parallel uploads

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? (args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : true) : undefined;
};

const DRY_RUN = flag('--dry-run') === true;
const ONLY_KIND = flag('--only-kind'); // 'fauna' | 'flora' | undefined
const CONCURRENCY = parseInt(flag('--concurrency') || '4', 10);

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const DETAILS_DIR = path.join(REPO_ROOT, 'dist', 'species-details');

const KIND_TO_BUCKET = {
  fauna: 'fauna',
  flora: 'flora',
};

function collectFiles() {
  if (!fs.existsSync(DETAILS_DIR)) {
    throw new Error(`Details dir not found: ${DETAILS_DIR}\nRun \`npm run compile-species\` first.`);
  }
  const jobs = [];
  for (const kind of Object.keys(KIND_TO_BUCKET)) {
    if (ONLY_KIND && ONLY_KIND !== kind) continue;
    const kindDir = path.join(DETAILS_DIR, kind);
    if (!fs.existsSync(kindDir)) continue;
    for (const fname of fs.readdirSync(kindDir)) {
      if (!fname.endsWith('.json')) continue;
      const slug = fname.replace(/\.json$/, '');
      jobs.push({
        kind,
        slug,
        bucket: KIND_TO_BUCKET[kind],
        localPath: path.join(kindDir, fname),
        r2Key: `species/${slug}.json`,
      });
    }
  }
  return jobs;
}

function uploadOne(job) {
  return new Promise((resolve, reject) => {
    if (DRY_RUN) {
      console.log(`[dry-run] wrangler r2 object put ${job.bucket}/${job.r2Key} --file=${job.localPath}`);
      resolve({ job, code: 0 });
      return;
    }
    const proc = spawn('npx', [
      'wrangler', 'r2', 'object', 'put',
      `${job.bucket}/${job.r2Key}`,
      `--file=${job.localPath}`,
      '--content-type=application/json',
      '--remote',
    ], { stdio: ['ignore', 'pipe', 'pipe'] });

    let stderr = '';
    proc.stderr.on('data', (d) => { stderr += d.toString(); });
    proc.on('close', (code) => {
      if (code === 0) resolve({ job, code });
      else reject(new Error(`wrangler r2 put failed for ${job.slug} (exit ${code}): ${stderr.slice(0, 400)}`));
    });
  });
}

async function runPool(jobs, concurrency) {
  const results = [];
  let cursor = 0;
  let done = 0;
  let failed = 0;

  async function worker() {
    while (cursor < jobs.length) {
      const job = jobs[cursor++];
      try {
        const r = await uploadOne(job);
        results.push(r);
        done++;
        if (done % 25 === 0 || done === jobs.length) {
          console.log(`  ${done}/${jobs.length} uploaded (${failed} failed)`);
        }
      } catch (err) {
        failed++;
        console.error(`  ✗ ${job.slug}: ${err.message}`);
      }
    }
  }
  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  return { done, failed };
}

async function main() {
  const jobs = collectFiles();
  console.log(`Uploading ${jobs.length} species detail files to R2${DRY_RUN ? ' (dry run)' : ''}...`);
  console.log(`  Concurrency: ${CONCURRENCY}`);
  console.log(`  Fauna → ${KIND_TO_BUCKET.fauna} bucket`);
  console.log(`  Flora → ${KIND_TO_BUCKET.flora} bucket`);
  console.log('');

  const { done, failed } = await runPool(jobs, CONCURRENCY);
  console.log('');
  console.log(`Done. ${done} uploaded, ${failed} failed.`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});