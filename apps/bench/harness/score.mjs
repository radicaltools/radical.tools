// Scores a repository at a step: builds a copy, gets an adapter for its API
// (written by a separate session, or one saved earlier), starts it and runs
// the hidden acceptance tests active at that step.
// node harness/score.mjs <repository> <step> <adapter.mjs> [out.json]
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { startProviders } from './kit/providers.mjs';
import { startServer } from './kit/server.mjs';
import { makeHttp } from './kit/http.mjs';
import { measure } from './metrics.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const TESTS = path.join(here, '../systems/shop/tests');

function sh(cmd, args, cwd, timeout) {
  const r = spawnSync(cmd, args, { cwd, timeout, encoding: 'utf8', env: { ...process.env, CI: '1' }, maxBuffer: 64 * 1024 * 1024 });
  return { ok: r.status === 0, out: `${r.stdout ?? ''}${r.stderr ?? ''}`.slice(-3000) };
}

// A built copy of the repository, in a folder of its own: <dir>/system.
export function prepare(repo) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bench-score-'));
  const system = path.join(dir, 'system');
  fs.mkdirSync(system);
  spawnSync('rsync', ['-a', '--exclude', '.git', `${repo}/`, `${system}/`]);
  let build = { ok: false, out: 'no package.json' };
  if (fs.existsSync(path.join(system, 'package.json'))) {
    const install = sh('npm', ['install', '--no-audit', '--no-fund'], system, 600_000);
    const built = install.ok ? sh('npm', ['run', 'build'], system, 600_000) : install;
    build = { ok: install.ok && built.ok, out: built.ok ? '' : built.out };
  }
  return { dir, system, build, metrics: measure(system), cleanup: () => fs.rmSync(dir, { recursive: true, force: true }) };
}

export async function runTests(prepared, step, adapterFile) {
  const result = { step, build: prepared.build, adapter: false, tests: [], metrics: prepared.metrics };
  let createAdapter = null;
  if (adapterFile && fs.existsSync(adapterFile)) {
    try { ({ createAdapter } = await import(`${pathToFileURL(adapterFile).href}?t=${Date.now()}`)); result.adapter = typeof createAdapter === 'function'; }
    catch (e) { result.adapterError = String(e.message).slice(0, 300); }
  }
  const usable = result.build.ok && result.adapter;
  const providers = await startProviders();
  try {
    const suites = fs.readdirSync(TESTS).filter((f) => /^s\d+\.mjs$/.test(f) && Number(f.slice(1, 3)) <= step).sort();
    for (const file of suites) {
      const mod = await import(pathToFileURL(path.join(TESTS, file)).href);
      const from = Number(file.slice(1, 3));
      const active = mod.tests.filter((t) => t.until === undefined || step <= t.until);
      let server = usable ? await startServer(prepared.system, providers, mod.env ?? {}) : { up: false, stop() {}, log: () => '' };
      let restarts = 0;
      for (const t of active) {
        const rec = { id: t.id, from, tags: t.tags ?? [], pass: false };
        // A server that died is started again, at most three times per suite.
        if (usable && restarts < 3 && !(server.up && await server.healthy())) { restarts += 1; server.stop(); server = await startServer(prepared.system, providers, mod.env ?? {}); }
        if (!server.up) rec.error = !result.build.ok ? 'build failed' : !result.adapter ? 'no adapter' : `server did not start: ${server.log().slice(-300)}`;
        else {
          providers.reset();
          const adapter = createAdapter(makeHttp(server.base));
          const sys = new Proxy(adapter, { get: (target, name) => (typeof target[name] === 'function' ? target[name].bind(target) : async () => ({ ok: false, reason: 'unsupported' })) });
          let timer;
          try {
            await Promise.race([t.run({ sys, provider: providers.state }), new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('test timed out')), 60_000); })]);
            rec.pass = true;
          } catch (e) { rec.error = String(e?.message ?? e).slice(0, 400); rec.unsupported = /^unsupported: /.test(rec.error); }
          clearTimeout(timer);
        }
        result.tests.push(rec);
      }
      server.stop();
    }
  } finally { providers.close(); }
  return result;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const prepared = prepare(path.resolve(process.argv[2]));
  const r = await runTests(prepared, Number(process.argv[3] ?? 0), path.resolve(process.argv[4]));
  prepared.cleanup();
  if (process.argv[5]) fs.writeFileSync(process.argv[5], JSON.stringify(r, null, 2));
  console.log(`build ${r.build.ok ? 'ok' : 'FAILED'}; adapter ${r.adapter ? 'ok' : `MISSING ${r.adapterError ?? ''}`}; tests ${r.tests.filter((t) => t.pass).length}/${r.tests.length}; provider files ${r.metrics.providerFiles}, cycles ${r.metrics.cycles}`);
  for (const t of r.tests.filter((x) => !x.pass)) console.log(`  FAIL ${t.id}: ${t.error}`);
  process.exit(0);
}
