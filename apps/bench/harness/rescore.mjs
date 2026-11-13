// Scores the recorded commits of the runs of a version again, after a change
// to the tests, with the adapters saved at the time.
// node harness/rescore.mjs [--version pilot2] [--only sonnet/a/1]
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { prepare, runTests } from './score.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const arg = (name, fallback) => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : fallback; };
const BASE = path.join(here, '../runs', arg('version', 'pilot3'));
const only = arg('only', '');
const dirs = (p) => fs.readdirSync(p, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name).sort();

for (const model of dirs(BASE)) for (const arm of dirs(path.join(BASE, model))) for (const seed of dirs(path.join(BASE, model, arm))) {
  const run = path.join(BASE, model, arm, seed);
  if (only && `${model}/${arm}/${seed}` !== only) continue;
  const meta = JSON.parse(fs.readFileSync(path.join(run, 'meta.json'), 'utf8'));
  for (const d of dirs(run).filter((x) => x.startsWith('step-'))) {
    const usageFile = path.join(run, d, 'usage.json');
    if (!fs.existsSync(usageFile) || !fs.existsSync(path.join(run, d, 'score.json'))) continue;
    const { commit, step } = JSON.parse(fs.readFileSync(usageFile, 'utf8'));
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bench-rescore-'));
    spawnSync('sh', ['-c', `git -C "${meta.work}" archive ${commit} | tar -x -C "${tmp}"`]);
    const prepared = prepare(tmp);
    const score = await runTests(prepared, step, path.join(run, d, 'adapter.mjs'));
    prepared.cleanup();
    fs.rmSync(tmp, { recursive: true, force: true });
    fs.writeFileSync(path.join(run, d, 'score.json'), JSON.stringify(score, null, 2));
    console.log(`${model}/${arm}/${seed} step ${step}: build ${score.build.ok ? 'ok' : 'FAILED'}, tests ${score.tests.filter((t) => t.pass).length}/${score.tests.length}, provider files ${score.metrics.providerFiles}`);
  }
}
process.exit(0);
