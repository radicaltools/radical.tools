// Compares the arms from the scores and usage of the runs of a version.
// node harness/report.mjs [--version pilot1]   → runs/<version>/report.md and report.json
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const i = process.argv.indexOf('--version');
const version = i > 0 ? process.argv[i + 1] : 'pilot3';
const BASE = path.join(here, '../runs', version);
const STANDARD_TAGS = new Set(JSON.parse(fs.readFileSync(path.join(here, '../systems/shop/standards.json'), 'utf8')).standards.flatMap((s) => s.tags));
const ARMS = { a: 'A bare', b: 'B docs', c: 'C radical' };

const dirs = (p) => (fs.existsSync(p) ? fs.readdirSync(p, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name).sort() : []);
const json = (p) => (fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : null);
const median = (xs) => { const v = xs.filter((x) => x !== null && x !== undefined && !Number.isNaN(x)).sort((a, b) => a - b); if (!v.length) return null; const m = v.length >> 1; return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2; };
const range = (xs) => { const v = xs.filter((x) => x !== null && x !== undefined && !Number.isNaN(x)); return v.length ? [Math.min(...v), Math.max(...v)] : null; };
const share = (tests) => (tests.length ? tests.filter((t) => t.pass).length / tests.length : null);
const pct = (x) => (x === null ? '–' : `${Math.round(x * 100)}%`);
const cell = (xs, f = pct) => { const m = median(xs); if (m === null) return '–'; const r = range(xs); return xs.length > 1 && r[0] !== r[1] ? `${f(m)} (${f(r[0])}–${f(r[1])})` : f(m); };
const num = (d = 0) => (x) => (x === null ? '–' : x.toFixed(d));

// runs[model][arm] = [{ seed, steps: [{ step, score, usage, m: {...metrics} }] }]
const runs = {};
for (const model of dirs(BASE)) for (const arm of dirs(path.join(BASE, model))) for (const seed of dirs(path.join(BASE, model, arm))) {
  const run = { seed, steps: [] };
  let previous = null;
  for (const d of dirs(path.join(BASE, model, arm, seed)).filter((x) => x.startsWith('step-'))) {
    const p = path.join(BASE, model, arm, seed, d);
    const score = json(path.join(p, 'score.json')); const usage = json(path.join(p, 'usage.json'));
    if (!score || !usage) continue;
    const step = score.step; const t = score.tests;
    const has = (tag) => (x) => x.tags.includes(tag);
    const passed = new Set(t.filter((x) => x.pass).map((x) => x.id));
    const trap = (rule) => { const done = t.find(has(`trap:${rule}:done`)); const kept = t.find(has(`trap:${rule}:kept`)); return !done ? null : !done.pass ? 'not done' : kept.pass ? 'kept' : 'BROKEN'; };
    const trapRules = [...new Set(t.filter((x) => x.from === step).flatMap((x) => x.tags).filter((g) => g.startsWith('trap:')).map((g) => g.split(':')[1]))];
    const m = {
      current: share(t.filter((x) => x.from === step)),
      earlier: share(t.filter((x) => x.from < step)),
      all: share(t),
      hd: share(t.filter((x) => x.tags.some((g) => g.startsWith('HD-')))),
      hdCurrent: share(t.filter((x) => x.from === step && x.tags.some((g) => g.startsWith('HD-')))),
      standards: share(t.filter((x) => x.tags.some((g) => STANDARD_TAGS.has(g)))),
      standardsCurrent: share(t.filter((x) => x.from === step && x.tags.some((g) => STANDARD_TAGS.has(g)))),
      plain: share(t.filter((x) => !x.tags.some((g) => g.startsWith('HD-')))),
      ruleTests: share(t.filter((x) => x.tags.some((g) => g === 'R1' || g === 'R2'))),
      regressions: previous ? [...previous].filter((id) => t.some((x) => x.id === id) && !passed.has(id)).length : 0,
      providerFiles: score.metrics.providerFiles, cycles: score.metrics.cycles, tableSpread: score.metrics.tableSpreadMean,
      codeSize: score.metrics.lines, largestFile: score.metrics.largestFile,
      unsupported: t.length ? t.filter((x) => x.unsupported).length / t.length : null,
      adapter: score.adapter,
      build: score.build.ok,
      trap: trapRules.length ? trapRules.map((rule) => `${rule} ${trap(rule)}`).join(', ') : null,
      cost: (usage.costUsd ?? 0) + (usage.poCostUsd ?? 0),
      minutes: usage.wallMs / 60000,
      turns: usage.turns,
      outTokens: usage.usage?.output_tokens ?? null,
      questions: usage.poQuestions,
      codeLines: usage.diff ? usage.diff.codeAdded + usage.diff.codeRemoved : null,
      otherLines: usage.diff ? usage.diff.added + usage.diff.removed - usage.diff.codeAdded - usage.diff.codeRemoved : null,
      repoKTokens: usage.repo ? usage.repo.chars / 4000 : null, codeKTokens: usage.repo ? usage.repo.codeChars / 4000 : null,
      timedOut: usage.timedOut,
    };
    previous = passed;
    run.steps.push({ step, m });
  }
  if (run.steps.length) ((runs[model] ??= {})[arm] ??= []).push(run);
}

const out = [];
const table = (head, rows) => { out.push(`| ${head.join(' | ')} |`, `|${head.map(() => '---').join('|')}|`, ...rows.map((r) => `| ${r.join(' | ')} |`), ''); };
out.push(`# Benchmark report — ${version}`, '', `Generated ${new Date().toISOString()}. A cell is the median over the runs of an arm, with the range when the runs differ.`, '');

for (const model of Object.keys(runs)) {
  const arms = Object.keys(runs[model]).sort();
  const steps = [...new Set(arms.flatMap((a) => runs[model][a].flatMap((r) => r.steps.map((s) => s.step))))].sort((a, b) => a - b);
  const at = (a, step, key) => runs[model][a].map((r) => r.steps.find((s) => s.step === step)?.m[key]).filter((x) => x !== undefined);
  const upTo = (a, step, key) => runs[model][a].filter((r) => r.steps.some((s) => s.step === step)).map((r) => r.steps.filter((s) => s.step <= step).reduce((sum, s) => sum + (s.m[key] ?? 0), 0));
  out.push(`## ${model}`, '', `Runs: ${arms.map((a) => `${ARMS[a]} ${runs[model][a].length} (steps done: ${runs[model][a].map((r) => r.steps.length).join(', ')})`).join('; ')}`, '');

  const perStep = (title, key, f) => { out.push(`### ${title}`, ''); table(['Step', ...arms.map((a) => ARMS[a])], steps.map((s) => [s, ...arms.map((a) => cell(at(a, s, key), f))])); };
  perStep('All hidden tests active at the step, passed', 'all');
  perStep('Tests of the step itself, passed', 'current');
  perStep('Tests of earlier steps, still passing', 'earlier');
  perStep('Tests that passed at the previous step and fail now (regressions)', 'regressions', num(0));
  perStep('Tests of hidden details, passed (all active)', 'hd');
  perStep('Tests of the group standards, passed (all active)', 'standards');
  perStep('Tests that need no hidden detail, passed', 'plain');
  perStep('Rule tests R1/R2 through the API, passed', 'ruleTests');
  perStep('Tests failed because the system has no such capability', 'unsupported');
  perStep('Files that know about a payment provider (R3 asks for one place)', 'providerFiles', num(0));
  perStep('Import cycles', 'cycles', num(0));
  perStep('Source files naming each database table, mean', 'tableSpread', num(1));
  perStep('Lines of source code', 'codeSize', num(0));
  perStep('Repository text, thousand tokens (approx.), against a session window of 100', 'repoKTokens', num(0));
  perStep('Of that, code and tests, thousand tokens (approx.)', 'codeKTokens', num(0));
  perStep('Questions to the product owner', 'questions', num(0));
  perStep('Cost of the step, USD (session + product owner)', 'cost', num(2));
  perStep('Minutes', 'minutes', num(0));
  perStep('Lines of code changed (src, tests)', 'codeLines', num(0));
  perStep('Lines changed outside the code (documents, model)', 'otherLines', num(0));

  out.push('### Cumulative cost, USD', '');
  table(['Through step', ...arms.map((a) => ARMS[a])], steps.map((s) => [s, ...arms.map((a) => cell(upTo(a, s, 'cost'), num(2)))]));
  out.push('### Cumulative minutes', '');
  table(['Through step', ...arms.map((a) => ARMS[a])], steps.map((s) => [s, ...arms.map((a) => cell(upTo(a, s, 'minutes'), num(0)))]));

  out.push('### Traps', '');
  table(['Step', ...arms.map((a) => ARMS[a])], steps.filter((s) => arms.some((a) => at(a, s, 'trap').some(Boolean))).map((s) => [s, ...arms.map((a) => at(a, s, 'trap').filter(Boolean).join('; ') || '–')]));

  out.push('### Summary over the change steps (1 and later)', '');
  const over = (a, key, agg) => runs[model][a].map((r) => { const xs = r.steps.filter((s) => s.step >= 1).map((s) => s.m[key]).filter((x) => x !== null && x !== undefined); return xs.length ? agg(xs) : null; });
  const mean = (xs) => xs.reduce((s, x) => s + x, 0) / xs.length; const sum = (xs) => xs.reduce((s, x) => s + x, 0);
  table(['Metric', ...arms.map((a) => ARMS[a])], [
    ['Mean share of all tests passed', ...arms.map((a) => cell(over(a, 'all', mean)))],
    ['Mean share of the step\'s own tests passed', ...arms.map((a) => cell(over(a, 'current', mean)))],
    ['Mean share of earlier tests passing', ...arms.map((a) => cell(over(a, 'earlier', mean)))],
    ['Regressions, total', ...arms.map((a) => cell(over(a, 'regressions', sum), num(0)))],
    ['Hidden-detail tests of the step passed, mean', ...arms.map((a) => cell(over(a, 'hdCurrent', mean)))],
    ['Files that know a payment provider, last step', ...arms.map((a) => cell(runs[model][a].map((r) => r.steps.at(-1).m.providerFiles), num(0)))],
    ['Questions, total', ...arms.map((a) => cell(over(a, 'questions', sum), num(0)))],
    ['Cost, USD, total (steps ≥ 1)', ...arms.map((a) => cell(over(a, 'cost', sum), num(2)))],
    ['Minutes, total (steps ≥ 1)', ...arms.map((a) => cell(over(a, 'minutes', sum), num(0)))],
  ]);
  const problems = arms.flatMap((a) => runs[model][a].flatMap((r) => r.steps.filter((s) => s.m.timedOut || !s.m.build || !s.m.adapter).map((s) => `${ARMS[a]} seed ${r.seed} step ${s.step}: ${s.m.timedOut ? 'timed out' : ''}${!s.m.build ? ' build failed' : ''}${s.m.build && !s.m.adapter ? ' no adapter' : ''}`)));
  if (problems.length) out.push('### Timed out or failed to build', '', ...problems.map((p) => `- ${p}`), '');
}

fs.writeFileSync(path.join(BASE, 'report.md'), out.join('\n'));
fs.writeFileSync(path.join(BASE, 'report.json'), JSON.stringify(runs, null, 2));
console.log(out.join('\n'));
