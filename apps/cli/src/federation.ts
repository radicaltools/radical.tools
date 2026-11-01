import { execFile } from 'node:child_process'
import { readFile, realpath, stat, writeFile } from 'node:fs/promises'
import { isAbsolute, join, relative, resolve } from 'node:path'
import { parseArgs, promisify } from 'node:util'
import type { DiagramData, DiagramSnapshot, DiagramView } from '@radical/common/c4'
import { originOf } from '@radical/common/model'
import {
  DEPS_FILE, FEDERATION_FILE, composeFederation, originFor, otherModelView, parseDeps, serializeFederationFile,
  type Dependency, type Deps, type FederationFile, type FetchedDependency,
} from '@radical/common/federation'
import { deserializeFromMdFolder, type FolderFiles } from '@radical/common/formats/mdFolder'
import { MdFolderSession } from '@radical/common/formats/mdFolderSync'
import { diskFolderStorage } from '@radical/node-files/diskFolderStorage'
import { fetchDependency, isAddress, repoAddress } from '@radical/node-files/gitDeps'
import { writeEditorStateFile } from '@radical/node-files/selectionFile'
import type { Io } from './check'

export const FEDERATION_USAGE = `Usage: radical federation fetch [folder] [options]

Fetches the models a model folder's ${DEPS_FILE} names, and theirs, and writes
their elements and relations into ${FEDERATION_FILE} in the model folder (out
of git), each marked with its origin (<name>@<commit>). Studio and the MCP
server open the model folder itself and show them beside its own, read-only;
they never write them into the folder. A model pinned twice is fetched at the
nearest pin: the folder's own ${DEPS_FILE} first, then its dependencies'.
radical hooks install runs it after a checkout, a commit, a pull and a rebase.

  folder              the model folder (default: the working directory); with
                      no ${DEPS_FILE} there is nothing to fetch
  --quiet             print nothing
  --detach            fetch in the background and return at once (the hooks)

${DEPS_FILE}: { "name": "<this model>", "dependencies": [ { "name": "orders",
"repo": "<git address, or a path relative to the model folder>", "path":
"<the model folder in that repository>", "ref": "<branch, tag or commit>" } ] }

Exit status: 0 fetched (or nothing to fetch), 2 it could not run.`

const exec = promisify(execFile)
const readText = (path: string): Promise<string | null> => readFile(path, 'utf8').catch(() => null)

async function readDeps(root: string): Promise<{ deps: Deps; text: string } | null> {
  const text = await readText(join(root, DEPS_FILE))
  return text === null ? null : { deps: parseDeps(text), text }
}

/** Fetches the dependencies at their refs, and
 *  theirs in turn. A model pinned twice is composed at the nearest pin:
 *  this model's own deps.json first, then its dependencies' in the order
 *  they are declared, level by level; the other pin is a note, and this
 *  model's own deps.json settles it. A pin back to this model is a cycle
 *  and left out. */
async function fetchAll(root: string, deps: Deps): Promise<{ fetched: FetchedDependency[]; notes: string[]; sources: Map<string, { dep: Dependency; home: string }> }> {
  const fetched: FetchedDependency[] = []
  const notes: string[] = []
  // Where each model was fetched from, for the versions milestones keep.
  const sources = new Map<string, { dep: Dependency; home: string }>()
  const chosen = new Map<string, { ref: string; repo: string; via: string }>()
  let level: Array<{ dep: Dependency; home: string | undefined; via?: string }> = deps.dependencies.map((dep) => ({ dep, home: root }))
  while (level.length) {
    const next: typeof level = []
    // One after the other: two dependencies may share a repository (and its cache).
    for (const { dep, home, via } of level) {
      if (dep.name === deps.name) continue
      const kept = chosen.get(dep.name)
      if (kept) {
        if (kept.ref !== dep.ref || kept.repo !== dep.repo) {
          notes.push(`${dep.name}: ${via ?? deps.name} pins ${dep.ref}, ${kept.via} pins ${kept.ref}; ${kept.ref} is composed, the nearer pin (pin it in ${DEPS_FILE} to choose).`)
        }
        continue
      }
      if (home === undefined && !isAbsolute(dep.repo) && !isAddress(dep.repo)) {
        notes.push(`${dep.name}: ${via} names its repository as the path ${dep.repo}, which only a repository on disk can resolve; pin it in ${DEPS_FILE}.`)
        continue
      }
      chosen.set(dep.name, { ref: dep.ref, repo: dep.repo, via: via ?? deps.name })
      sources.set(dep.name, { dep, home: home ?? root })
      const got = await fetchDependency(dep, home ?? root)
      fetched.push(via ? { ...got, via } : got)
      for (const child of got.deps?.dependencies ?? []) next.push({ dep: child, home: got.home, via: dep.name })
    }
    level = next
  }
  return { fetched, notes, sources }
}

/** The model folder composed with its pinned dependencies, as radical check
 *  checks it: null when the folder has no deps.json. */
export async function composeFolder(root: string): Promise<{ deps: Deps; fetched: FetchedDependency[]; notes: string[] } | null> {
  const read = await readDeps(root)
  if (!read) return null
  return { deps: read.deps, ...await fetchAll(root, read.deps) }
}

/** The dependencies' elements, relations and views, with their origin, as
 *  the model folder's `files` are composed with them, and what did not fit. */
export function federationOthers(files: FolderFiles, fetched: FetchedDependency[]): Pick<DiagramData, 'nodes' | 'relations'> & { views: DiagramView[]; notes: string[] } {
  let own: DiagramData = { nodes: [], relations: [] }
  try { own = deserializeFromMdFolder(files).data } catch { /* radical check names what is wrong with the files */ }
  const { data, notes } = composeFederation(own, fetched)
  const views = fetched.flatMap((dep) => (dep.data.views ?? []).flatMap((view) => otherModelView(view, originFor(dep.name, dep.commit)) ?? []))
  return { nodes: data.nodes.filter((n) => originOf(n)), relations: data.relations.filter((r) => originOf(r)), views, notes }
}

/** The version setup offers for a dependency: the repository's newest
 *  version tag (v1.2.0, 1.2), else its default branch. */
export async function latestRef(repo: string, home: string): Promise<string> {
  const address = repoAddress(repo, home)
  const run = (args: string[]) => exec('git', args, { cwd: home, windowsHide: true, timeout: 30_000 }).then((r) => r.stdout, () => '')
  const tags = (await run(['ls-remote', '--tags', '--refs', address]))
    .split('\n').map((line) => line.split('refs/tags/')[1]?.trim()).filter((tag): tag is string => !!tag && /^v?\d+(\.\d+)*$/.test(tag))
  if (tags.length) {
    const parts = (tag: string) => tag.replace(/^v/, '').split('.').map(Number)
    return tags.sort((a, b) => {
      const [x, y] = [parts(a), parts(b)]
      for (let i = 0; i < Math.max(x.length, y.length); i++) if ((x[i] ?? 0) !== (y[i] ?? 0)) return (x[i] ?? 0) - (y[i] ?? 0)
      return 0
    }).at(-1)!
  }
  return (await run(['ls-remote', '--symref', address, 'HEAD'])).match(/^ref: refs\/heads\/(\S+)\s+HEAD/m)?.[1] ?? 'main'
}

/** A dependency as `radical setup --depends-on` names it:
 *  <name>=<repository>[#<version>[:<model folder>]]. Without a version
 *  `ref` is empty: the newest tag is looked up. */
export function parseDependsOn(spec: string): Dependency {
  const at = spec.indexOf('=')
  if (at < 1) throw new Error(`--depends-on ${spec}: write <name>=<repository>[#<version>[:<model folder>]]`)
  const name = spec.slice(0, at)
  const rest = spec.slice(at + 1)
  const hash = rest.lastIndexOf('#')
  const repo = hash < 0 ? rest : rest.slice(0, hash)
  const [ref = '', path = 'architecture'] = hash < 0 ? [] : rest.slice(hash + 1).split(/:(.*)/s)
  if (!repo) throw new Error(`--depends-on ${spec}: the repository is missing`)
  return { name, repo, path: path || 'architecture', ref }
}

/** The model folder's deps.json with `added` in it: a dependency of the
 *  same name is replaced, the others kept. Throws with what is wrong. */
export async function addDependencies(root: string, added: Dependency[], modelName: string): Promise<Deps> {
  const read = await readDeps(root)
  const deps: Deps = read?.deps ?? { name: modelName, dependencies: [] }
  const names = new Set(added.map((d) => d.name))
  const next = { name: deps.name, dependencies: [...deps.dependencies.filter((d) => !names.has(d.name)), ...added] }
  // Read back as any deps.json is: a wrong name or path is said here.
  parseDeps(JSON.stringify(next))
  await writeFile(join(root, DEPS_FILE), JSON.stringify(next, null, 2) + '\n')
  return next
}

/** What deps.json names, or null without one; throws when it does not read. */
export async function readDependencies(root: string): Promise<Deps | null> {
  return (await readDeps(root))?.deps ?? null
}

/** The dependencies with their commits, for a line of output. */
export const describeDeps = (fetched: FetchedDependency[]): string =>
  fetched.map((d) => `${originFor(d.name, d.commit)}${d.ref === d.commit ? '' : ` (${d.ref})`}${d.via ? ` via ${d.via}` : ''}`).join(', ')

/** Fetches the dependencies of the model folder at `root` and writes them
 *  into its FEDERATION_FILE: null when it has no deps.json. */
export async function fetchFederation(root: string): Promise<{ fetched: FetchedDependency[]; notes: string[]; nodes: number } | null> {
  const read = await readDeps(root)
  if (!read) return null
  const { fetched, notes, sources } = await fetchAll(root, read.deps)
  const own = await new MdFolderSession(diskFolderStorage(root)).readAll()
  const others = federationOthers(own, fetched)
  const all = [...notes, ...others.notes]
  // The versions the milestones keep, where they are not the current ones:
  // a milestone shows the other models as they were when it was made.
  const atCommits: NonNullable<FederationFile['atCommits']> = {}
  let snapshots: DiagramSnapshot[] = []
  try { snapshots = deserializeFromMdFolder(own).data.snapshots ?? [] } catch { /* the folder's own problems are radical check's */ }
  for (const snapshot of snapshots) {
    for (const pin of snapshot.otherModels ?? []) {
      const origin = originFor(pin.name, pin.commit)
      if (atCommits[origin] || fetched.some((d) => d.name === pin.name && d.commit === pin.commit)) continue
      const source = sources.get(pin.name)
      if (!source) { all.push(`${pin.name}: milestone "${snapshot.name}" keeps ${origin}, but ${DEPS_FILE} no longer names ${pin.name}, so it is not fetched.`); continue }
      try {
        const got = await fetchDependency({ ...source.dep, ref: pin.commit }, source.home, { commit: pin.commit })
        atCommits[origin] = {
          nodes: got.data.nodes.map((n) => ({ ...n, origin })),
          relations: got.data.relations.map((r) => ({ ...r, origin })),
        }
      } catch (error) {
        all.push(`${pin.name}: milestone "${snapshot.name}" keeps ${origin}, which could not be fetched: ${(error as Error).message}`)
      }
    }
  }
  await writeEditorStateFile(root, FEDERATION_FILE, serializeFederationFile({
    version: 2,
    name: read.deps.name,
    fetchedAt: new Date().toISOString(),
    dependencies: fetched.map(({ name, repo, path, ref, commit, via, deps }) => ({
      name, repo, path, ref, commit, ...(via ? { via } : {}), ...(deps?.dependencies.length ? { dependsOn: deps.dependencies.map((d) => d.name) } : {}),
    })),
    notes: all,
    nodes: others.nodes,
    relations: others.relations,
    ...(others.views.length ? { views: others.views } : {}),
    ...(Object.keys(atCommits).length ? { atCommits } : {}),
  }))
  return { fetched, notes: all, nodes: others.nodes.length }
}

export async function federationCommand(args: string[], io: Io): Promise<number> {
  let parsed
  try {
    parsed = parseArgs({
      args,
      allowPositionals: true,
      options: {
        quiet: { type: 'boolean', default: false },
        detach: { type: 'boolean', default: false },
        help: { type: 'boolean', short: 'h', default: false },
      },
    })
  } catch (error) {
    io.err(`${(error as Error).message}\n\n${FEDERATION_USAGE}`)
    return 2
  }
  const { values, positionals } = parsed
  if (values.help) { io.out(FEDERATION_USAGE); return 0 }
  const [action, folder = '.', ...rest] = positionals
  if (action !== 'fetch' || rest.length) { io.err(FEDERATION_USAGE); return 2 }
  if (values.detach) {
    if (!io.background) { io.err('radical federation fetch --detach: nothing here can start a command in the background.'); return 2 }
    io.background(['federation', ...args.filter((a) => a !== '--detach')])
    return 0
  }
  const out = (text: string) => { if (!values.quiet) io.out(text) }
  let root: string
  try {
    root = await realpath(resolve(io.cwd, folder))
    if (!(await stat(root)).isDirectory()) throw new Error('not a directory')
  } catch (error) {
    io.err(`radical federation: ${folder}: ${(error as Error).message}`)
    return 2
  }
  // Paths in the output are relative to the working directory as it really is.
  const cwd = await realpath(io.cwd).catch(() => io.cwd)
  try {
    const result = await fetchFederation(root)
    if (!result) { out(`No ${DEPS_FILE} in ${relative(cwd, root) || '.'}: this model depends on no other model, so there is nothing to fetch.`); return 0 }
    const where = relative(cwd, join(root, FEDERATION_FILE))
    out(`Fetched ${describeDeps(result.fetched) || 'no model'}: ${result.nodes} element${result.nodes === 1 ? '' : 's'} into ${where}.`)
    for (const note of result.notes) out(`Note: ${note}`)
    return 0
  } catch (error) {
    io.err(`radical federation fetch: ${(error as Error).message}`)
    return 2
  }
}
