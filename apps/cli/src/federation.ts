import { createHash } from 'node:crypto'
import { copyFile, mkdir, readFile, realpath, rm, stat } from 'node:fs/promises'
import { join, relative, resolve } from 'node:path'
import { parseArgs } from 'node:util'
import { CHECK_CONFIG_FILE, TEST_RESULTS_FILE } from '@radical/common/check'
import type { DiagramData } from '@radical/common/c4'
import { originOf } from '@radical/common/model'
import {
  DEPS_FILE, FEDERATION_DIR, FEDERATION_FILE, composeFederation, formatRefused, originFor, parseDeps, splitFederation,
  type Deps, type FetchedDependency, type RefusedChange,
} from '@radical/common/federation'
import { MD_MANIFEST_FILE, deserializeFromMdFolder, serializeToMdFolder, type FolderFiles } from '@radical/common/formats/mdFolder'
import { MdFolderSession } from '@radical/common/formats/mdFolderSync'
import { MODEL_BASE_FILE, serializeModelBase } from '@radical/common/formats/modelBase'
import { diskFolderStorage } from '@radical/node-files/diskFolderStorage'
import { fetchDependency } from '@radical/node-files/gitDeps'
import { currentBranch, readModelAtCommit, resolveGitBase } from '@radical/node-files/gitModel'
import { readEditorStateFile, writeEditorStateFile } from '@radical/node-files/selectionFile'
import type { Io } from './check'

export const FEDERATION_USAGE = `Usage: radical federation <open|sync|watch> [folder] [options]

Composes a model folder with the models its deps.json names into one folder
to open in Studio or with the MCP server: ${FEDERATION_DIR}/ in the model folder.
Its own elements and relations are there as they are, every dependency's
marked with its origin (<name>@<commit>), read-only.

  open    fetch each dependency at its pinned ref (cached; a partial clone per
          repository) and compose the folder
  sync    carry the composed folder's own changes back to the model folder;
          changes to other models' elements are kept out and named
  watch   open, then keep both in step until stopped: each change of the
          composed folder goes home, and an outside change of the model folder
          or its deps.json (a checkout, a pull) composes it again

  folder              the model folder with deps.json (default: the working directory)
  --force             open: compose again though the composed folder has changes
                      not synced (they are lost); sync: carry them home though the
                      model folder changed too

deps.json: { "name": "<this model>", "dependencies": [ { "name": "orders",
"repo": "<git address, or a path relative to the model folder>", "path":
"<the model folder in that repository>", "ref": "<branch, tag or commit>" } ] }

Exit status: 0 done, 1 changes kept out (sync) or both copies changed,
2 it could not run.`

/** What the composed folder was made from, in its FEDERATION_FILE. */
interface FederationState {
  version: 1
  name: string
  dependencies: Array<{ name: string; repo: string; path: string; ref: string; commit: string }>
  /** Hashes of the model files when the two copies were last in step. */
  home: string
  composed: string
  deps: string
}

/** A hash of a folder's model files: equal hashes, equal models. */
const hashFiles = (files: FolderFiles): string => {
  const hash = createHash('sha1')
  for (const path of Object.keys(files).sort()) hash.update(path).update('\0').update(files[path]).update('\0')
  return hash.digest('hex')
}

const readText = (path: string): Promise<string | null> => readFile(path, 'utf8').catch(() => null)

/** The name in a manifest's frontmatter. */
function manifestName(files: FolderFiles): string | undefined {
  const line = files[MD_MANIFEST_FILE]?.match(/^name:\s*(.+?)\s*$/m)?.[1]
  if (!line) return undefined
  try { return line.startsWith('"') ? JSON.parse(line) as string : line } catch { return line }
}

export const federationDir = (root: string): string => join(root, FEDERATION_DIR)

async function readDeps(root: string): Promise<{ deps: Deps; text: string } | null> {
  const text = await readText(join(root, DEPS_FILE))
  return text === null ? null : { deps: parseDeps(text), text }
}

/** Fetches the dependencies at their refs, or at the commits given. */
async function fetchAll(root: string, deps: Deps, commits?: Map<string, string>): Promise<FetchedDependency[]> {
  const fetched: FetchedDependency[] = []
  // One after the other: two dependencies may share a repository (and its cache).
  for (const dep of deps.dependencies) fetched.push(await fetchDependency(dep, root, commits?.get(dep.name) ? { commit: commits.get(dep.name) } : {}))
  return fetched
}

/** The model folder composed with its pinned dependencies, as radical check
 *  checks it: null when the folder has no deps.json. */
export async function composeFolder(root: string): Promise<{ deps: Deps; fetched: FetchedDependency[] } | null> {
  const read = await readDeps(root)
  if (!read) return null
  return { deps: read.deps, fetched: await fetchAll(root, read.deps) }
}

/** The dependencies' elements and relations, with their origin, as the
 *  model folder's `files` are composed with them. */
export function federationOthers(files: FolderFiles, fetched: FetchedDependency[]): Pick<DiagramData, 'nodes' | 'relations'> {
  let own: DiagramData = { nodes: [], relations: [] }
  try { own = deserializeFromMdFolder(files).data } catch { /* radical check names what is wrong with the files */ }
  const { data } = composeFederation(own, fetched)
  return { nodes: data.nodes.filter((n) => originOf(n)), relations: data.relations.filter((r) => originOf(r)) }
}

/** The dependencies with their commits, for a line of output. */
export const describeDeps = (fetched: FetchedDependency[]): string =>
  fetched.map((d) => `${originFor(d.name, d.commit)}${d.ref === d.commit ? '' : ` (${d.ref})`}`).join(', ')

class Federation {
  readonly dir: string
  private readonly home: MdFolderSession
  private readonly composed: MdFolderSession

  constructor(readonly root: string, private readonly io: Io) {
    this.dir = federationDir(root)
    this.home = new MdFolderSession(diskFolderStorage(root))
    this.composed = new MdFolderSession(diskFolderStorage(this.dir))
  }

  private where = (): string => relative(this.io.cwd, this.dir) || this.dir

  async state(): Promise<FederationState | null> {
    const text = await readEditorStateFile(this.dir, FEDERATION_FILE)
    if (!text) return null
    try {
      const state = JSON.parse(text) as FederationState
      return state.version === 1 ? state : null
    } catch { return null }
  }

  private readHome = (): Promise<FolderFiles> => this.home.readAll()
  private readComposed = async (): Promise<FolderFiles> =>
    (await stat(join(this.dir, MD_MANIFEST_FILE)).then(() => true, () => false)) ? this.composed.readAll() : {}

  /** Hashes of both copies and deps.json now. */
  async hashes(): Promise<{ home: string; composed: string; deps: string }> {
    return {
      home: hashFiles(await this.readHome()),
      composed: hashFiles(await this.readComposed()),
      deps: hashFiles({ deps: (await readText(join(this.root, DEPS_FILE))) ?? '' }),
    }
  }

  /** Composes the folder from the model folder and the dependencies (at
   *  their refs, or at the commits the folder was composed with). */
  async compose(options: { refetch: boolean }): Promise<{ fetched: FetchedDependency[]; notes: string[]; ownCount: number; otherCount: number }> {
    const read = await readDeps(this.root)
    if (!read) throw new Error(`there is no ${DEPS_FILE} in the model folder`)
    const old = options.refetch ? null : await this.state()
    const commits = old ? new Map(old.dependencies.map((d) => [d.name, d.commit])) : undefined
    const fetched = await fetchAll(this.root, read.deps, commits)
    const homeFiles = await this.readHome()
    if (!homeFiles[MD_MANIFEST_FILE]) throw new Error('it holds no Radical model (no radical.md)')
    const own = deserializeFromMdFolder(homeFiles).data
    const { data, notes } = composeFederation(own, fetched)
    await mkdir(this.dir, { recursive: true })
    const name = manifestName(homeFiles) ?? read.deps.name
    const files = serializeToMdFolder(data, name)
    const written = await this.composed.write(files)
    if (!written.ok) throw new Error(`the composed folder changed while it was composed (${written.conflict.join(', ')}); try again`)
    await this.syncBeside()
    await this.writeBase(fetched)
    const state: FederationState = {
      version: 1,
      name,
      dependencies: fetched.map(({ name: dep, repo, path, ref, commit }) => ({ name: dep, repo, path, ref, commit })),
      home: hashFiles(homeFiles),
      composed: hashFiles(files),
      deps: hashFiles({ deps: read.text }),
    }
    await writeEditorStateFile(this.dir, FEDERATION_FILE, JSON.stringify(state, null, 2) + '\n')
    return { fetched, notes, ownCount: own.nodes.length, otherCount: data.nodes.length - own.nodes.length }
  }

  /** check.json and the test results: the newer copy wins, both ways. */
  async syncBeside(): Promise<void> {
    for (const path of [CHECK_CONFIG_FILE, TEST_RESULTS_FILE]) {
      const [home, composed] = await Promise.all([this.root, this.dir].map(async (dir) => {
        const file = join(dir, path)
        return { dir, file, text: await readText(file), mtime: await stat(file).then((s) => s.mtimeMs, () => -1) }
      }))
      if (home.text === composed.text) continue
      const [from, to] = composed.text !== null && (home.text === null || composed.mtime > home.mtime) ? [composed, home] : [home, composed]
      if (from.text === null) continue
      if (path === TEST_RESULTS_FILE) await writeEditorStateFile(to.dir, path, from.text)
      else await copyFile(from.file, to.file)
    }
  }

  /** The composed folder's base, for Studio's Changes on branch: the model
   *  folder's version where the branch left main, composed with the same
   *  dependencies, so only this model's changes show. */
  private async writeBase(fetched: FetchedDependency[]): Promise<void> {
    try {
      const base = await resolveGitBase(this.root)
      const files = await readModelAtCommit(this.root, base.commit)
      const old = Object.keys(files).length ? deserializeFromMdFolder(files).data : { nodes: [], relations: [] }
      const { data } = composeFederation({ ...old }, fetched)
      await writeEditorStateFile(this.dir, MODEL_BASE_FILE, serializeModelBase({
        commit: base.commit, described: base.described, branch: await currentBranch(this.root), nodes: data.nodes, relations: data.relations,
      }))
    } catch {
      // Not in git, or no commit yet: no base to compare with.
      await rm(join(this.dir, MODEL_BASE_FILE), { force: true })
    }
  }

  /** Carries the composed folder's own changes home. */
  async sync(options: { force: boolean }): Promise<{ carried: boolean; refused: RefusedChange[]; conflict?: string }> {
    const state = await this.state()
    if (!state) throw new Error(`the federation is not open: run radical federation open first`)
    const composedFiles = await this.readComposed()
    const homeFiles = await this.readHome()
    if (hashFiles(composedFiles) === state.composed) {
      await this.syncBeside()
      return { carried: false, refused: [] }
    }
    if (hashFiles(homeFiles) !== state.home && !options.force) {
      return { carried: false, refused: [], conflict: 'the model folder changed too since the federation was composed' }
    }
    // What was theirs: the federation as composed, from the cached commits.
    const read = await readDeps(this.root)
    const fetched = await fetchAll(this.root, read?.deps ?? { name: state.name, dependencies: state.dependencies }, new Map(state.dependencies.map((d) => [d.name, d.commit])))
    const was = composeFederation(deserializeFromMdFolder(homeFiles).data, fetched).data
    const { own, refused } = splitFederation(deserializeFromMdFolder(composedFiles).data, was)
    const ownFiles = serializeToMdFolder(own, manifestName(homeFiles) ?? state.name)
    const written = await this.home.write(ownFiles)
    if (!written.ok) return { carried: false, refused: [], conflict: `the model folder changed while it was synced (${written.conflict.join(', ')})` }
    await this.syncBeside()
    // Refused changes are undone in the composed folder.
    if (refused.length) {
      const files = serializeToMdFolder(composeFederation(own, fetched).data, manifestName(homeFiles) ?? state.name)
      if ((await this.composed.write(files)).ok) state.composed = hashFiles(files)
    } else {
      state.composed = hashFiles(composedFiles)
    }
    state.home = hashFiles(ownFiles)
    await writeEditorStateFile(this.dir, FEDERATION_FILE, JSON.stringify(state, null, 2) + '\n')
    return { carried: hashFiles(ownFiles) !== hashFiles(homeFiles), refused }
  }

  reportOpen(result: Awaited<ReturnType<Federation['compose']>>): void {
    this.io.out(`Composed into ${this.where()}: ${result.ownCount} element${result.ownCount === 1 ? '' : 's'} of this model and ${result.otherCount} of ${describeDeps(result.fetched) || 'no other model'}.`)
    for (const note of result.notes) this.io.out(`Note: ${note}`)
  }

  reportSync(result: Awaited<ReturnType<Federation['sync']>>): void {
    if (result.conflict) {
      this.io.err(`Not synced: ${result.conflict}. radical federation sync --force carries the composed folder's changes home anyway; radical federation open --force composes it again from the model folder, and its changes are lost.`)
      return
    }
    this.io.out(result.carried ? `Carried the changes home to ${relative(this.io.cwd, this.root) || '.'}.` : 'Nothing to carry home.')
    for (const line of formatRefused(result.refused)) this.io.out(line)
  }

  /** Until the signal: each change of the composed folder goes home, an
   *  outside change of the model folder or deps.json composes it again. */
  async watch(signal: AbortSignal | undefined, intervalMs: number): Promise<number> {
    this.io.out(`Watching ${this.where()} and ${relative(this.io.cwd, this.root) || '.'}; stop with Ctrl-C.`)
    let stable = await this.stamps()
    let reported = ''
    while (!signal?.aborted) {
      await new Promise((done) => {
        const timer = setTimeout(done, intervalMs)
        signal?.addEventListener('abort', () => { clearTimeout(timer); done(undefined) }, { once: true })
      })
      if (signal?.aborted) break
      // Act only on a folder that has been still for one interval: an editor
      // writes a model in several files.
      const now = await this.stamps()
      if (now !== stable) { stable = now; continue }
      try {
        const state = await this.state()
        if (!state) continue
        const hashes = await this.hashes()
        await this.syncBeside()
        const composedChanged = hashes.composed !== state.composed
        const homeChanged = hashes.home !== state.home || hashes.deps !== state.deps
        if (composedChanged && homeChanged) {
          const message = 'Both the composed folder and the model folder changed: run radical federation sync --force to keep the composed one, or open --force to keep the model folder.'
          if (reported !== message) this.io.err(message)
          reported = message
        } else if (composedChanged) {
          this.reportSync(await this.sync({ force: false }))
          reported = ''
        } else if (homeChanged) {
          const result = await this.compose({ refetch: hashes.deps !== state.deps })
          this.io.out(`The model folder changed: composed again with ${describeDeps(result.fetched) || 'no other model'}.`)
          reported = ''
        }
      } catch (error) {
        const message = `radical federation watch: ${(error as Error).message}`
        if (reported !== message) this.io.err(message)
        reported = message
      }
      stable = await this.stamps()
    }
    return 0
  }

  /** Cheap marks of both copies (file times and sizes), to see a change. */
  private async stamps(): Promise<string> {
    const list = async (dir: string) => diskFolderStorage(dir).list().catch(() => ({}))
    const extra = await Promise.all([DEPS_FILE, CHECK_CONFIG_FILE, TEST_RESULTS_FILE].map((path) => stat(join(this.root, path)).then((s) => `${s.mtimeMs}:${s.size}`, () => '')))
    return JSON.stringify([await list(this.root), await list(this.dir), extra])
  }
}

/** Runs `radical federation` with `args` (after the command name); returns the exit status. */
export async function federationCommand(args: string[], io: Io): Promise<number> {
  let parsed
  try {
    parsed = parseArgs({
      args,
      allowPositionals: true,
      options: {
        force: { type: 'boolean', default: false },
        interval: { type: 'string', default: '500' },
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
  const interval = Number(values.interval)
  if (!['open', 'sync', 'watch'].includes(action) || rest.length || !(interval >= 50)) { io.err(FEDERATION_USAGE); return 2 }
  let federation: Federation
  try {
    const root = await realpath(resolve(io.cwd, folder))
    if (!(await stat(root)).isDirectory()) throw new Error('not a directory')
    // Paths in the output are relative to the working directory as it really is.
    federation = new Federation(root, { ...io, cwd: await realpath(io.cwd).catch(() => io.cwd) })
  } catch (error) {
    io.err(`radical federation: ${folder}: ${(error as Error).message}`)
    return 2
  }
  try {
    if (action === 'sync') {
      const result = await federation.sync({ force: values.force })
      federation.reportSync(result)
      return result.conflict || result.refused.length ? 1 : 0
    }
    const state = await federation.state()
    if (state && !values.force) {
      const hashes = await federation.hashes()
      if (hashes.composed !== state.composed) {
        // Changes not carried home yet go home first.
        const result = await federation.sync({ force: false })
        federation.reportSync(result)
        if (result.conflict) return 1
      }
    }
    federation.reportOpen(await federation.compose({ refetch: true }))
    if (action === 'open') {
      io.out(`Open ${relative(io.cwd, federation.dir) || federation.dir} in Studio, or point the MCP server at it; radical federation sync (or watch) carries its changes home.`)
      return 0
    }
    return await federation.watch(io.signal, interval)
  } catch (error) {
    io.err(`radical federation ${action}: ${(error as Error).message}`)
    return 2
  }
}
