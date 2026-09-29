#!/usr/bin/env node
// Checks the monorepo's module boundaries. Run with `npm run check:workspaces`.
//
//   1. Dependency direction: packages/* depend only on packages/*; apps/*
//      depend on packages/*. An app may depend on another app only when it is
//      listed in APP_TO_APP below, with the reason.
//   2. Relative imports and triple-slash references stay inside their own
//      workspace; other workspaces are reached through their package name.
//   3. Every imported package is declared in the importing workspace's
//      package.json (no phantom dependencies that only resolve by hoisting).
//   4. tsconfig includes and package.json scripts do not reach into other
//      workspaces.
//   5. Every workspace with source has a `typecheck` script and every
//      workspace with tests has a `test` script, since the root runs them
//      with --if-present.
//
// Imports are read with TypeScript's own pre-processor, not regular
// expressions, so strings and JSX text are never mistaken for imports.

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { builtinModules } from 'node:module'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

/** App → app dependencies that are allowed for now, and why. */
const APP_TO_APP = {
  '@radical/hub': {
    'radical-model': 'the Hub viewer runs on Studio\'s canvas and panels via radical-model/viewer, until packages/ui exists',
  },
  'vscode-radical': {
    'radical-model': 'the extension ships Studio\'s web build (out/renderer) as its webview',
  },
}

/** Modules a host provides at runtime, so they are never in package.json. */
const HOST_PROVIDED = { 'vscode-radical': ['vscode'] }

const SOURCE_EXT = /\.(ts|tsx|mts|cts|js|mjs|cjs)$/
const SKIP_DIRS = new Set(['node_modules', 'out', 'dist', 'webview', 'catalogue', '.vite'])
const CONFIG_FILE = /^(vite|vitest|electron\.vite)(\.[a-z]+)?\.config\.(ts|mts|js|mjs)$/
const BUILTINS = new Set([...builtinModules, ...builtinModules.map((m) => `node:${m}`)])

const errors = []
const fail = (msg) => errors.push(msg)
const rel = (p) => relative(ROOT, p).split(sep).join('/')

// ── Workspaces ───────────────────────────────────────────────────────────────

const rootPkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'))
const workspaces = []
for (const pattern of rootPkg.workspaces) {
  const base = join(ROOT, pattern.replace(/\/\*$/, ''))
  const dirs = pattern.endsWith('/*') ? readdirSync(base).map((d) => join(base, d)) : [base]
  for (const dir of dirs) {
    const pkgPath = join(dir, 'package.json')
    if (!existsSync(pkgPath)) continue
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'))
    workspaces.push({ dir, pkg, name: pkg.name, kind: rel(dir).split('/')[0] })
  }
}
const byName = new Map(workspaces.map((w) => [w.name, w]))
const workspaceOf = (file) => workspaces.find((w) => file === w.dir || file.startsWith(w.dir + sep))

const declaredDeps = (pkg) => new Set([
  ...Object.keys(pkg.dependencies ?? {}),
  ...Object.keys(pkg.devDependencies ?? {}),
  ...Object.keys(pkg.peerDependencies ?? {}),
])

// ── 1. Dependency direction ──────────────────────────────────────────────────

for (const w of workspaces) {
  for (const dep of declaredDeps(w.pkg)) {
    const target = byName.get(dep)
    if (!target) continue
    if (w.kind === 'packages' && target.kind !== 'packages') {
      fail(`${w.name}: a package must not depend on app ${dep}`)
    } else if (w.kind === 'apps' && target.kind === 'apps' && !APP_TO_APP[w.name]?.[dep]) {
      fail(`${w.name}: app-to-app dependency on ${dep} is not allowed (add it to APP_TO_APP with a reason, or move the shared code to packages/)`)
    }
  }
}

// ── 2 + 3. Imports ───────────────────────────────────────────────────────────

function* sourceFiles(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) {
      if (!SKIP_DIRS.has(name) && !name.startsWith('.')) yield* sourceFiles(p)
    } else if (SOURCE_EXT.test(name) && !name.endsWith('.d.ts')) {
      yield p
    } else if (name.endsWith('.d.ts') || name.endsWith('.d.cts')) {
      yield p
    }
  }
}

const packageName = (spec) => (spec.startsWith('@') ? spec.split('/').slice(0, 2).join('/') : spec.split('/')[0])

for (const w of workspaces) {
  const declared = declaredDeps(w.pkg)
  const hostProvided = new Set(HOST_PROVIDED[w.name] ?? [])
  for (const file of sourceFiles(w.dir)) {
    const info = ts.preProcessFile(readFileSync(file, 'utf8'), true, true)
    const specs = [
      ...info.importedFiles.map((f) => f.fileName),
      ...info.referencedFiles.map((f) => (f.fileName.startsWith('.') ? f.fileName : `./${f.fileName}`)),
    ]
    for (const spec of specs) {
      if (spec.startsWith('.')) {
        const target = resolve(dirname(file), spec.split('?')[0])
        if (workspaceOf(target) !== w) fail(`${rel(file)}: relative import '${spec}' leaves ${w.name}; import the other workspace by package name`)
        continue
      }
      if (spec.startsWith('/') || BUILTINS.has(spec) || BUILTINS.has(spec.split('/')[0])) continue
      const name = packageName(spec)
      if (name === w.name || hostProvided.has(name)) continue
      if (!declared.has(name)) fail(`${rel(file)}: imports '${spec}' but ${w.name} does not declare '${name}'`)
    }
  }

  // ── 4. tsconfig includes and scripts ──────────────────────────────────────
  for (const cfg of readdirSync(w.dir).filter((n) => /^tsconfig.*\.json$/.test(n))) {
    const json = ts.parseConfigFileTextToJson(cfg, readFileSync(join(w.dir, cfg), 'utf8')).config ?? {}
    for (const entry of [...(json.include ?? []), ...(json.files ?? [])]) {
      if (workspaceOf(resolve(w.dir, entry.replace(/\*.*$/, ''))) !== w) fail(`${rel(join(w.dir, cfg))}: includes '${entry}' from outside ${w.name}`)
    }
  }
  for (const [script, cmd] of Object.entries(w.pkg.scripts ?? {})) {
    if (/\.\.\//.test(cmd)) fail(`${w.name}: script "${script}" reaches outside the workspace (${cmd})`)
  }
  for (const name of readdirSync(w.dir).filter((n) => CONFIG_FILE.test(n))) {
    const text = readFileSync(join(w.dir, name), 'utf8')
    for (const m of text.matchAll(/['"`](\.\.\/[^'"`]*)['"`]/g)) {
      if (workspaceOf(resolve(w.dir, m[1])) !== w) fail(`${rel(join(w.dir, name))}: path '${m[1]}' reaches outside ${w.name}`)
    }
  }

  // ── 5. Scripts the root relies on ─────────────────────────────────────────
  const hasSource = existsSync(join(w.dir, 'src'))
  const hasTests = existsSync(join(w.dir, 'tests')) &&
    [...sourceFiles(join(w.dir, 'tests'))].some((f) => /\.test\.(ts|tsx|mjs)$/.test(f))
  if (hasSource && !w.pkg.scripts?.typecheck) fail(`${w.name}: has src/ but no "typecheck" script`)
  if (hasTests && !w.pkg.scripts?.test) fail(`${w.name}: has tests/ but no "test" script`)
}

if (errors.length) {
  console.error(`Workspace boundary check failed (${errors.length}):\n  ${errors.join('\n  ')}`)
  process.exit(1)
}
console.log(`Workspace boundaries OK (${workspaces.length} workspaces)`)
