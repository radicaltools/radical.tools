// One run of the benchmark: an arm, a model and a seed, through the steps.
// node harness/run.mjs --arm a|b|c --model sonnet|opus --seed 1 [--steps 0-8] [--version pilot1]
// A run can be stopped and started again: finished steps are skipped.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { startPO, cleanEnv } from './po.mjs';
import { prepare, runTests } from './score.mjs';
import { writeAdapter } from './adapter.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(here, '..');
const SYSTEM = path.join(ROOT, 'systems/shop');
// Outside the repository: beside the checkout unless BENCH_WORK says otherwise.
const WORK_ROOT = process.env.BENCH_WORK ?? path.resolve(ROOT, '../../..', 'bench-work');
const MODELS = { sonnet: 'claude-sonnet-5-5', opus: 'claude-opus-5-5' };
const RADICAL = '0.4.0';
const MINUTES = 60_000;
const timeoutOf = (step) => (step === 0 ? 150 : 60) * MINUTES;

const arg = (name, fallback) => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : fallback; };
const arm = arg('arm'); const model = arg('model', 'sonnet'); const seed = arg('seed', '1'); const version = arg('version', 'pilot3');
const lastStep = Math.max(...fs.readdirSync(path.join(SYSTEM, 'steps')).map((f) => Number(f.slice(0, 2))));
const [first, last] = arg('steps', `0-${lastStep}`).split('-').map(Number);
// The size of the context a session works in. Capped so that the grown system cannot be held whole.
const context = arg('context', '100k');
// How many steps back the product owner remembers, the current one included; 0 for everything.
const poMemory = Number(arg('po-memory', '0'));
// 1: the client belongs to a group with standards. The Radical arm gets them as a model it depends on; the others ask.
const standards = arg('standards', '0') === '1';
const STANDARDS_REF = arg('standards-ref', 'v2.0.0');
// A Radical build of a checkout (its apps/cli and apps/mcp dist) instead of the published packages.
const radicalLocal = arg('radical-local', '');
const CLI = radicalLocal ? ['node', [path.join(radicalLocal, 'apps/cli/dist/index.js')]] : ['npx', ['-y', `@radicaltools/cli@${RADICAL}`]];
const CLI_TEXT = radicalLocal ? `node ${path.join(radicalLocal, 'apps/cli/dist/index.js')}` : `npx -y @radicaltools/cli@${RADICAL}`;
const radicalLabel = () => (radicalLocal ? `${radicalLocal}@${spawnSync('git', ['-C', radicalLocal, 'rev-parse', '--short', 'HEAD'], { encoding: 'utf8' }).stdout.trim()}` : RADICAL);
// Text put into the system prompt of every session of every arm, to make the window they work in smaller: '30k' is about 30 000 tokens.
const ballast = arg('ballast', '0');
const BALLAST_FILE = path.join(ROOT, 'harness', `ballast-${ballast}.txt`);
if (ballast !== '0' && !fs.existsSync(BALLAST_FILE)) { console.error(`no ${BALLAST_FILE}: make it with node harness/ballast.mjs ${ballast}`); process.exit(2); }
const STANDARDS_REPO = process.env.BENCH_STANDARDS ?? path.resolve(ROOT, '../../..', 'radical.bench.standards');
if (!['a', 'b', 'c'].includes(arm) || !MODELS[model]) { console.error('usage: run.mjs --arm a|b|c --model sonnet|opus --seed N'); process.exit(2); }

const LOG = path.join(ROOT, 'runs', version, model, arm, String(seed));
fs.mkdirSync(LOG, { recursive: true });
const say = (s) => { const line = `${new Date().toISOString()} [${model}/${arm}/${seed}] ${s}`; console.log(line); fs.appendFileSync(path.join(LOG, 'run.log'), line + '\n'); };
const git = (work, ...args) => spawnSync('git', ['-c', 'user.name=bench', '-c', 'user.email=bench@example.invalid', ...args], { cwd: work, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });

function init() {
  const metaFile = path.join(LOG, 'meta.json');
  if (fs.existsSync(metaFile)) return JSON.parse(fs.readFileSync(metaFile, 'utf8'));
  fs.mkdirSync(WORK_ROOT, { recursive: true });
  const work = fs.mkdtempSync(path.join(WORK_ROOT, 'shop-'));
  fs.mkdirSync(path.join(work, 'docs'));
  fs.writeFileSync(path.join(work, 'docs/brief.md'), fs.readFileSync(path.join(SYSTEM, 'brief.md'), 'utf8') + (standards ? fs.readFileSync(path.join(SYSTEM, 'brief-group.md'), 'utf8') : ''));
  const rules = fs.readFileSync(path.join(ROOT, 'arms/common.md'), 'utf8') + (arm === 'a' ? '' : fs.readFileSync(path.join(ROOT, `arms/${arm}.md`), 'utf8')) + (arm === 'c' && standards ? fs.readFileSync(path.join(ROOT, 'arms/c-standards.md'), 'utf8') : '');
  fs.writeFileSync(path.join(work, 'CLAUDE.md'), rules.replaceAll('npx -y @radicaltools/cli@0.4.0', CLI_TEXT));
  fs.writeFileSync(path.join(work, '.gitignore'), 'node_modules/\ndist/\n*.sqlite\n*.sqlite-*\n*.db\n*.db-*\n');
  git(work, 'init', '-q');
  if (arm === 'c') {
    const r = spawnSync(CLI[0], [...CLI[1], 'setup', '--yes', '--client', 'claude-code', '--no-hooks', '--no-check', ...(standards ? ['--depends-on', `standards=${STANDARDS_REPO}#${STANDARDS_REF}:.radical/model`] : [])], { cwd: work, encoding: 'utf8' });
    if (r.status !== 0) throw new Error(`radical setup failed: ${r.stdout}${r.stderr}`);
  }
  git(work, 'add', '-A'); git(work, 'commit', '-qm', 'start');
  const meta = { work, arm, model, modelId: MODELS[model], seed, version, context, poMemory, standards, standardsRef: standards ? STANDARDS_REF : null, ballast, radical: arm === 'c' ? radicalLabel() : null, created: new Date().toISOString() };
  fs.writeFileSync(metaFile, JSON.stringify(meta, null, 2));
  return meta;
}

function session(work, prompt, mcp, dir, timeout) {
  return new Promise((resolve) => {
    // Claude Code keeps a memory folder per project; a step must know only what the repository holds.
    fs.rmSync(path.join(os.homedir(), '.claude/projects', work.replace(/[^A-Za-z0-9]/g, '-')), { recursive: true, force: true });
    const out = fs.createWriteStream(path.join(dir, 'transcript.jsonl'));
    const child = spawn('claude', ['-p', prompt, '--model', MODELS[model], '--output-format', 'stream-json', '--verbose', '--permission-mode', 'auto',
      '--strict-mcp-config', '--mcp-config', JSON.stringify(mcp), '--setting-sources', 'project', '--no-session-persistence', ...(context === 'auto' ? [] : ['--autocompact', context]), ...(ballast === '0' ? [] : ['--append-system-prompt-file', BALLAST_FILE])],
    { cwd: work, env: cleanEnv(), detached: true, stdio: ['ignore', 'pipe', 'pipe'] });
    let tail = ''; let timedOut = false; let err = ''; let ending = null;
    // A session that has reported its result is over, whatever it left running (a test that never exits keeps the pipe open).
    const endSoon = () => { ending ??= setTimeout(() => { try { process.kill(-child.pid, 'SIGKILL'); } catch { /* gone */ } }, 15_000); };
    child.stdout.on('data', (c) => { out.write(c); tail = (tail + c).slice(-400_000); if (String(c).includes('"type":"result"')) endSoon(); });
    child.stderr.on('data', (c) => (err = (err + c).slice(-2000)));
    const timer = setTimeout(() => { timedOut = true; try { process.kill(-child.pid, 'SIGKILL'); } catch { /* gone */ } }, timeout);
    child.on('close', (code) => {
      clearTimeout(timer); clearTimeout(ending); out.end();
      try { process.kill(-child.pid, 'SIGKILL'); } catch { /* nothing left running */ }
      let result = null;
      for (const line of tail.split('\n').reverse()) { try { const j = JSON.parse(line); if (j.type === 'result') { result = j; break; } } catch { /* partial line */ } }
      resolve({ code, timedOut, stderr: err, result });
    });
  });
}

function diffStat(work) {
  const r = git(work, 'diff', '--numstat', 'HEAD~1', 'HEAD');
  const s = { files: 0, added: 0, removed: 0, codeFiles: 0, codeAdded: 0, codeRemoved: 0 };
  for (const line of r.stdout.split('\n')) {
    const [a, d, file] = line.split('\t');
    if (!file || a === '-' || /package-lock\.json$|^\.radical\/model\/\.state\//.test(file)) continue;
    s.files += 1; s.added += Number(a); s.removed += Number(d);
    if (/^(src|test|tests)\//.test(file)) { s.codeFiles += 1; s.codeAdded += Number(a); s.codeRemoved += Number(d); }
  }
  return s;
}

// Size of what a session could read: all tracked text in the repository, in characters.
function repoSize(work) {
  const files = git(work, 'ls-files').stdout.split('\n').filter((f) => f && !/package-lock\.json$|\.state\//.test(f));
  let all = 0; let code = 0;
  for (const f of files) { try { const n = fs.statSync(path.join(work, f)).size; all += n; if (/^(src|test|tests)\//.test(f)) code += n; } catch { /* gone */ } }
  return { files: files.length, chars: all, codeChars: code };
}

const meta = init();
const po = await startPO({ hiddenDir: path.join(SYSTEM, 'hidden'), logFile: path.join(LOG, 'po.jsonl'), memory: poMemory, standards });
// The product owner is a model's answer: it can take minutes, past Claude Code's idle limit for a tool (pilot 13's step 8 lost an answer after 473 s).
const mcp = { mcpServers: { 'product-owner': { type: 'http', url: po.url, timeout: 30 * MINUTES } } };
if (arm === 'c') mcp.mcpServers.radical = radicalLocal
  ? { type: 'stdio', command: 'node', args: [path.join(radicalLocal, 'apps/mcp/dist/index.js'), '--folder', '.radical/model'] }
  : { type: 'stdio', command: 'npx', args: ['-y', `@radicaltools/mcp@${RADICAL}`, '--folder', '.radical/model'] };
say(`work ${meta.work}`);

for (let step = first; step <= last; step++) {
  const nn = String(step).padStart(2, '0');
  const dir = path.join(LOG, `step-${nn}`);
  if (fs.existsSync(path.join(dir, 'score.json'))) { say(`step ${step} already done`); continue; }
  fs.mkdirSync(dir, { recursive: true });
  po.step = step; po.asked = 0;
  const poBefore = fs.existsSync(path.join(LOG, 'po.jsonl')) ? fs.readFileSync(path.join(LOG, 'po.jsonl'), 'utf8').split('\n').filter(Boolean).length : 0;
  say(`step ${step} session starts`);
  const started = Date.now();
  const s = await session(meta.work, fs.readFileSync(path.join(SYSTEM, 'steps', `${nn}.md`), 'utf8'), mcp, dir, timeoutOf(step));
  const wallMs = Date.now() - started;
  git(meta.work, 'add', '-A');
  const committed = git(meta.work, 'commit', '-qm', `step ${step}`).status === 0;
  const poLines = fs.existsSync(path.join(LOG, 'po.jsonl')) ? fs.readFileSync(path.join(LOG, 'po.jsonl'), 'utf8').split('\n').filter(Boolean).slice(poBefore).map((l) => JSON.parse(l)) : [];
  const usage = {
    step, exitCode: s.code, timedOut: s.timedOut, wallMs,
    costUsd: s.result?.total_cost_usd ?? null, turns: s.result?.num_turns ?? null, durationMs: s.result?.duration_ms ?? null,
    usage: s.result?.usage ?? null, modelUsage: s.result?.modelUsage ?? null, isError: s.result?.is_error ?? null,
    finalMessage: typeof s.result?.result === 'string' ? s.result.result.slice(0, 6000) : null,
    poQuestions: poLines.length, poCostUsd: poLines.reduce((a, l) => a + (l.costUsd ?? 0), 0),
    committed, commit: git(meta.work, 'rev-parse', 'HEAD').stdout.trim(), diff: committed ? diffStat(meta.work) : null,
    repo: repoSize(meta.work),
    stderr: s.result ? undefined : s.stderr,
  };
  fs.writeFileSync(path.join(dir, 'usage.json'), JSON.stringify(usage, null, 2));
  say(`step ${step} session ended: ${s.timedOut ? 'TIMED OUT' : `exit ${s.code}`}, ${Math.round(wallMs / 60000)} min, $${usage.costUsd?.toFixed?.(2) ?? '?'}, ${usage.turns ?? '?'} turns, ${usage.poQuestions} questions`);
  if (!s.result && !s.timedOut) { say(`step ${step} produced no result: ${s.stderr.slice(-300)}; stopping the run`); break; }
  // An adapter for the API this system designed, written by a separate session, then the hidden tests through it.
  const prepared = prepare(meta.work);
  const adapterFile = path.join(dir, 'adapter.mjs');
  const previous = path.join(LOG, `step-${String(step - 1).padStart(2, '0')}`, 'adapter.mjs');
  const adapter = prepared.build.ok ? await writeAdapter({ prepared, step, previous, outFile: adapterFile, logFile: path.join(dir, 'adapter.json') }) : { written: false };
  say(`step ${step} adapter: ${adapter.written ? 'written' : 'NOT written'}${adapter.timedOut ? ' (timed out)' : ''}, $${adapter.costUsd?.toFixed?.(2) ?? '?'}`);
  const score = await runTests(prepared, step, adapterFile);
  prepared.cleanup();
  fs.writeFileSync(path.join(dir, 'score.json'), JSON.stringify(score, null, 2));
  const pass = score.tests.filter((t) => t.pass).length;
  say(`step ${step} score: build ${score.build.ok ? 'ok' : 'FAILED'}, tests ${pass}/${score.tests.length}, unsupported ${score.tests.filter((t) => t.unsupported).length}, provider files ${score.metrics.providerFiles}, cycles ${score.metrics.cycles}`);
}
po.close();
say('run finished');
process.exit(0);
