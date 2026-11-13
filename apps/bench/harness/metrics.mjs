// Static measures of a repository that do not assume any layout.
import fs from 'node:fs';
import path from 'node:path';

const SKIP = new Set(['node_modules', 'dist', 'build', 'docs', 'coverage']);
function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP.has(e.name) || e.name.startsWith('.')) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.(ts|mts|cts|js|mjs|cjs|sql)$/.test(e.name) && !/\.d\.ts$/.test(e.name)) out.push(p);
  }
  return out;
}

export function measure(repo) {
  const rel = (f) => path.relative(repo, f);
  const isTest = (f) => /(\.|\/)(test|spec)\.[a-z]+$/.test(rel(f)) || /(^|\/)(tests?|__tests__)\//.test(rel(f));
  const all = walk(repo).filter((f) => !isTest(f));
  const code = all.filter((f) => !f.endsWith('.sql'));
  const text = Object.fromEntries(all.map((f) => [f, fs.readFileSync(f, 'utf8')]));
  const lines = (f) => text[f].split('\n').length;

  // R3: how many files know about a payment provider.
  const providerFiles = code.filter((f) => /PAYMENT_PROVIDER/.test(text[f])).map(rel);

  // Import cycles among the source files.
  const resolve = (from, spec) => {
    const base = path.resolve(path.dirname(from), spec).replace(/\.(js|mjs|cjs)$/, '');
    for (const c of [base, `${base}.ts`, `${base}.mts`, `${base}.js`, `${base}.mjs`, path.join(base, 'index.ts'), path.join(base, 'index.js')]) if (text[c] !== undefined) return c;
    return null;
  };
  const graph = new Map(code.map((f) => [f, []]));
  for (const f of code) for (const m of text[f].matchAll(/(?:from\s+|import\s*\(\s*|require\s*\(\s*)['"](\.[^'"]+)['"]/g)) { const t = resolve(f, m[1]); if (t && t !== f) graph.get(f).push(t); }
  let index = 0; const stack = []; const on = new Set(); const idx = new Map(); const low = new Map(); let cycles = 0; let filesInCycles = 0;
  const visit = (v) => {
    idx.set(v, index); low.set(v, index); index += 1; stack.push(v); on.add(v);
    for (const w of graph.get(v)) {
      if (!idx.has(w)) { visit(w); low.set(v, Math.min(low.get(v), low.get(w))); }
      else if (on.has(w)) low.set(v, Math.min(low.get(v), idx.get(w)));
    }
    if (low.get(v) === idx.get(v)) { let n = 0; let w; do { w = stack.pop(); on.delete(w); n += 1; } while (w !== v); if (n > 1) { cycles += 1; filesInCycles += n; } }
  };
  for (const f of code) if (!idx.has(f)) visit(f);

  // How many source files name each database table.
  const tables = new Set();
  for (const f of all) for (const m of text[f].matchAll(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?["`]?([A-Za-z_][A-Za-z0-9_]*)/gi)) tables.add(m[1]);
  const spread = [...tables].map((t) => code.filter((f) => new RegExp(`\\b${t}\\b`).test(text[f])).length);

  return {
    files: code.length,
    lines: code.reduce((s, f) => s + lines(f), 0),
    largestFile: code.reduce((m, f) => Math.max(m, lines(f)), 0),
    providerFiles: providerFiles.length, providerFileList: providerFiles,
    cycles, filesInCycles,
    tables: tables.size,
    tableSpreadMean: spread.length ? spread.reduce((a, b) => a + b, 0) / spread.length : null,
    tableSpreadMax: spread.length ? Math.max(...spread) : null,
  };
}

if (import.meta.url === `file://${process.argv[1]}`) console.log(JSON.stringify(measure(path.resolve(process.argv[2])), null, 2));
