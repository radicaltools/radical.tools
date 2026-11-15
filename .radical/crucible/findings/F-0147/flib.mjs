// Helpers for run 218's scripts: the CLI built in the repository, run on
// small git repositories made in a scratch directory (the system's temporary
// directory, or --scratch <dir>), removed afterwards unless --keep.
import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

/** The repository: up from this file to the folder with .radical/crucible/crucible.json. */
export function repoRoot(from = dirname(fileURLToPath(import.meta.url))) {
  for (let dir = resolve(from); ; dir = dirname(dir)) {
    if (existsSync(join(dir, '.radical', 'crucible', 'crucible.json'))) return dir
    if (dirname(dir) === dir) throw new Error('no repository above ' + from)
  }
}
export const CLI = join(repoRoot(), 'apps', 'cli', 'dist', 'index.js')

const arg = (name) => { const i = process.argv.indexOf(name); return i < 0 ? undefined : process.argv[i + 1] }
const made = []
/** A fresh directory for one try. */
export function scratch(tag) {
  const base = resolve(arg('--scratch') ?? tmpdir())
  mkdirSync(base, { recursive: true })
  const dir = mkdtempSync(join(base, `radical-218-${tag}-`))
  made.push(dir)
  return dir
}
/** Removes the scratch directories unless --keep. */
export function cleanUp() { if (!process.argv.includes('--keep')) for (const d of made.splice(0)) rmSync(d, { recursive: true, force: true }) }

/** Runs the CLI in `cwd`: { code, out, err }. */
export function radical(cwd, args, env = {}) {
  const r = spawnSync(process.execPath, [CLI, ...args], { cwd, encoding: 'utf8', env: { ...process.env, ...env } })
  return { code: r.status, out: r.stdout, err: r.stderr }
}
/** Prints a command and what it said. */
export function show(label, cwd, args, env) {
  const r = radical(cwd, args, env)
  console.log(`$ (${label}) radical ${args.map((a) => (/\s/.test(a) ? JSON.stringify(a) : a)).join(' ')}  → exit ${r.code}`)
  const text = (r.out + (r.err ? `[stderr] ${r.err}` : '')).trim()
  if (text) console.log(text.split('\n').map((l) => `    ${l}`).join('\n'))
  return r
}

export function git(cwd, ...args) {
  return execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@example.com', '-c', 'commit.gpgsign=false', ...args], { cwd, encoding: 'utf8' }).trim()
}

const frontMatter = (n) => `---\n${Object.entries(n).filter(([k]) => k !== 'path').map(([k, v]) => `${k}: ${JSON.stringify(v)}`).join('\n')}\n---\n`

/** Writes a Markdown model folder: nodes [{ id, type, label, path (under nodes/), ...props }], relations. */
export function writeModel(folder, nodes, relations, name = 'shop') {
  mkdirSync(join(folder, 'nodes'), { recursive: true })
  writeFileSync(join(folder, 'radical.md'), `---\nradicalFormat: "md-folder"\nversion: 1\nname: ${JSON.stringify(name)}\n---\n\n# ${name}\n`)
  for (const n of nodes) {
    const file = join(folder, 'nodes', n.path)
    mkdirSync(dirname(file), { recursive: true })
    writeFileSync(file, frontMatter(n))
  }
  writeFileSync(join(folder, 'relations.json'), JSON.stringify(relations.map((r) => ({ label: '', ...r })), null, 2) + '\n')
}

/** An EARS requirement of the ubiquitous kind. */
export const requirement = (id, label, system, path = `${id}.md`) => ({ id, type: 'requirement', label, path, earsType: 'ubiquitous', action: label.toLowerCase(), system })

export { join, readFileSync, writeFileSync, mkdirSync }
