// Writes the adapter of one recorded step again (after a change to the
// interface rules) and scores the step with it.
// node harness/readapt.mjs --version pilot8 --only sonnet/c/1 --step 0
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { prepare, runTests } from './score.mjs';
import { writeAdapter } from './adapter.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const arg = (name, fallback) => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : fallback; };
const run = path.join(here, '../runs', arg('version', 'pilot8'), arg('only'));
const step = Number(arg('step', '0'));
const dir = path.join(run, `step-${String(step).padStart(2, '0')}`);
const meta = JSON.parse(fs.readFileSync(path.join(run, 'meta.json'), 'utf8'));
const { commit } = JSON.parse(fs.readFileSync(path.join(dir, 'usage.json'), 'utf8'));

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bench-readapt-'));
spawnSync('sh', ['-c', `git -C "${meta.work}" archive ${commit} | tar -x -C "${tmp}"`]);
const prepared = prepare(tmp);
for (const f of ['adapter.mjs', 'adapter.json', 'score.json']) if (fs.existsSync(path.join(dir, f))) fs.renameSync(path.join(dir, f), path.join(dir, `${f}.before`));
const adapterFile = path.join(dir, 'adapter.mjs');
const previous = path.join(run, `step-${String(step - 1).padStart(2, '0')}`, 'adapter.mjs');
const adapter = await writeAdapter({ prepared, step, previous, outFile: adapterFile, logFile: path.join(dir, 'adapter.json') });
const score = await runTests(prepared, step, adapterFile);
prepared.cleanup();
fs.writeFileSync(path.join(dir, 'score.json'), JSON.stringify(score, null, 2));
console.log(`step ${step}: adapter ${adapter.written ? 'written' : 'NOT written'}, tests ${score.tests.filter((t) => t.pass).length}/${score.tests.length}`);
process.exit(0);
