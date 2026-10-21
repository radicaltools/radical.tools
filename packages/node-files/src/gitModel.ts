import { execFile, spawn } from 'node:child_process'
import { promisify } from 'node:util'
import { deserializeFromMdFolder, isMdFolderModelPath, stripBom, type FolderFiles } from '@radical/common/formats/mdFolder'
import { countModelChanges, formatModelChanges, modelChangeReport, type ModelChangeReport } from '@radical/common/modelChanges'
import type { ModelCopy } from '@radical/common/model'
import type { DiagramData } from '@radical/common/c4'
import { MODEL_BASE_FILE, serializeModelBase } from '@radical/common/formats/modelBase'
import { writeEditorStateFile } from './selectionFile'

const exec = promisify(execFile)

/** Branches that serve as the base when none is named, in this order after
 *  origin's own default branch. */
const DEFAULT_BRANCHES = ['origin/main', 'origin/master', 'main', 'master']

async function git(cwd: string, args: string[]): Promise<string> {
  const { stdout } = await exec('git', args, { cwd, maxBuffer: 256 * 1024 * 1024, encoding: 'utf8', windowsHide: true })
  return stdout.trim()
}

const gitOk = (cwd: string, args: string[]): Promise<string | null> => git(cwd, args).catch(() => null)

export interface GitBase {
  /** The commit the folder is compared with. */
  commit: string
  /** How it was chosen, for the reader: "HEAD", "merge base with origin/main". */
  described: string
}

/** The commit to compare a model folder with: `since` (a branch, tag or
 *  commit) when given, else where the current branch left the default
 *  branch (origin's, else main or master), else HEAD. */
export async function resolveGitBase(folder: string, since?: string): Promise<GitBase> {
  if ((await gitOk(folder, ['rev-parse', '--is-inside-work-tree'])) !== 'true') {
    throw new Error(`${folder} is not in a git repository, so there is no earlier version of the model to compare with.`)
  }
  if (since !== undefined) {
    // An option-like ref would reach git as an option.
    const commit = since && !since.startsWith('-') ? await gitOk(folder, ['rev-parse', '--verify', '--quiet', `${since}^{commit}`]) : null
    if (!commit) throw new Error(`Unknown git ref "${since}": name a branch, tag or commit.`)
    return { commit, described: since }
  }
  if (!(await gitOk(folder, ['rev-parse', '--verify', '--quiet', 'HEAD']))) {
    throw new Error('The repository has no commit yet, so there is no earlier version of the model to compare with.')
  }
  const originHead = (await gitOk(folder, ['symbolic-ref', '--quiet', '--short', 'refs/remotes/origin/HEAD'])) ?? undefined
  for (const branch of [...(originHead ? [originHead] : []), ...DEFAULT_BRANCHES]) {
    if (!(await gitOk(folder, ['rev-parse', '--verify', '--quiet', `${branch}^{commit}`]))) continue
    const base = await gitOk(folder, ['merge-base', 'HEAD', branch])
    if (base) return { commit: base, described: `merge base with ${branch}` }
  }
  return { commit: await git(folder, ['rev-parse', 'HEAD']), described: 'HEAD' }
}

/** The model files of `folder` as they are at `commit`: the same files
 *  diskFolderStorage reads (radical.md, the JSON sidecars, nodes/**.md, no
 *  dot entries, no symbolic links). Empty when the folder held no model then. */
export async function readModelAtCommit(folder: string, commit: string): Promise<FolderFiles> {
  // Paths come relative to the folder (the working directory), NUL-separated.
  const listing = await git(folder, ['ls-tree', '-r', '-z', commit, '--', '.'])
  const blobs: Array<{ sha: string; path: string }> = []
  for (const entry of listing.split('\0')) {
    const tab = entry.indexOf('\t')
    if (tab < 0) continue
    const [mode, type, sha] = entry.slice(0, tab).split(' ')
    const path = entry.slice(tab + 1)
    if (type !== 'blob' || mode === '120000' || !isMdFolderModelPath(path)) continue
    if (path.split('/').some((part) => part.startsWith('.'))) continue
    blobs.push({ sha, path })
  }
  if (!blobs.length) return {}
  const contents = await catFiles(folder, blobs.map((blob) => blob.sha))
  return Object.fromEntries(blobs.map((blob, i) => [blob.path, contents[i]]))
}

/** The blobs' contents, read with one `git cat-file --batch`. */
function catFiles(cwd: string, shas: string[]): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const child = spawn('git', ['cat-file', '--batch'], { cwd, windowsHide: true })
    const chunks: Buffer[] = []
    let stderr = ''
    child.stdout.on('data', (chunk: Buffer) => chunks.push(chunk))
    child.stderr.on('data', (chunk: Buffer) => { stderr += chunk.toString() })
    child.on('error', reject)
    child.on('close', (code) => {
      if (code !== 0) { reject(new Error(`git cat-file failed: ${stderr.trim()}`)); return }
      const out = Buffer.concat(chunks)
      const contents: string[] = []
      let at = 0
      for (const sha of shas) {
        const end = out.indexOf(0x0a, at)
        const [gotSha, type, size] = out.subarray(at, end).toString().split(' ')
        if (gotSha !== sha || type !== 'blob') { reject(new Error(`git cat-file: unexpected entry for ${sha}`)); return }
        const start = end + 1
        contents.push(stripBom(out.subarray(start, start + Number(size)).toString('utf8')))
        at = start + Number(size) + 1
      }
      resolve(contents)
    })
    child.stdin.end(shas.join('\n') + '\n')
  })
}

export interface ModelChangesSince {
  base: GitBase
  report: ModelChangeReport
  /** The report as text, with a heading that names the base. */
  text: string
}

export interface ChangesOptions {
  /** Also write the model at the base to .radical/base.json, for Studio. */
  saveBase?: boolean
}

/** The branch checked out in `folder`'s repository; null on a detached HEAD. */
export const currentBranch = (folder: string): Promise<string | null> =>
  gitOk(folder, ['symbolic-ref', '--quiet', '--short', 'HEAD']).then((name) => name || null)

const byId = <T extends { id: string }>(items: T[]): Record<string, T> => Object.fromEntries(items.map((item) => [item.id, item]))

/** What changed in the model in `folder` (`current`, as read from disk, so
 *  uncommitted edits count) since its version at the git base: elements and
 *  relations with their fields, views and layout left out. */
export async function modelChangesSince(folder: string, current: Pick<DiagramData, 'nodes' | 'relations'>, since?: string, options: ChangesOptions = {}): Promise<ModelChangesSince> {
  const base = await resolveGitBase(folder, since)
  const files = await readModelAtCommit(folder, base.commit)
  const old = Object.keys(files).length ? deserializeFromMdFolder(files).data : { nodes: [], relations: [] }
  if (options.saveBase) {
    const content = serializeModelBase({ commit: base.commit, described: base.described, branch: await currentBranch(folder), nodes: old.nodes, relations: old.relations })
    await writeEditorStateFile(folder, MODEL_BASE_FILE, content)
  }
  const before: ModelCopy = { nodes: byId(old.nodes), relations: byId(old.relations) }
  const after: ModelCopy = { nodes: byId(current.nodes), relations: byId(current.relations) }
  const report = modelChangeReport(before, after)
  const short = base.commit.slice(0, 7)
  const where = base.commit.startsWith(base.described) ? short : `${base.described} (${short})`
  const count = (group: { added: unknown[]; changed: unknown[]; removed: unknown[] }, noun: string) =>
    `${noun}: ${group.added.length} added, ${group.changed.length} changed, ${group.removed.length} removed`
  const text = countModelChanges(report) === 0
    ? `No model changes since ${where}: the elements and relations are as they were (views and layout are not compared).`
    : [
      `Model changes since ${where}, uncommitted edits included; elements and relations only, views and layout left out.`,
      `${count(report.elements, 'Elements')}. ${count(report.relations, 'Relations')}.${Object.keys(files).length ? '' : ' The folder held no model then.'}`,
      '',
      formatModelChanges(report, before, after),
    ].join('\n')
  return { base, report, text }
}
