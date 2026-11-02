// Where Radical keeps its files in a repository (ADR Radical in one .radical
// folder): one .radical/ at the repository's root holds the model
// (.radical/model), the repository's sensors (.radical/sensors/) and
// Radical Crucible (.radical/crucible/): its plan, findings and rounds.
// The old layout is still read: a model folder at the root (architecture/),
// radical.sensors.json and crucible.json there.

import { readFile, stat } from 'node:fs/promises'
import { basename, dirname, join, resolve } from 'node:path'
import { MD_MANIFEST_FILE } from '@radical/common/formats/mdFolder'
import { REPOSITORY_FILE, elementPaths, parseRepositoryMapping, type MappedElement } from '@radical/common/repositoryMapping'

/** The folder of everything Radical keeps in a repository. */
export const RADICAL_DIR = '.radical'
/** The model folder, from the repository's root. */
export const MODEL_FOLDER = `${RADICAL_DIR}/model`
/** The model folder of the old layout. */
export const OLD_MODEL_FOLDER = 'architecture'
/** The repository's sensors (their scripts beside them), and where the old
 *  layout had them. */
export const SENSORS_FILE = `${RADICAL_DIR}/sensors/sensors.json`
export const OLD_SENSORS_FILE = 'radical.sensors.json'
/** Crucible's plan, and where the old layout had it. */
export const CRUCIBLE_FILE = `${RADICAL_DIR}/crucible/crucible.json`
export const OLD_CRUCIBLE_FILE = 'crucible.json'
/** Crucible's findings (in git) and rounds (out of git), by layout. */
export const CRUCIBLE_FINDINGS = `${RADICAL_DIR}/crucible/findings`
export const CRUCIBLE_ROUNDS = `${RADICAL_DIR}/crucible/rounds`
export const OLD_CRUCIBLE_FINDINGS = 'crucible/findings'
export const OLD_CRUCIBLE_ROUNDS = '.crucible/rounds'
/** The model's state out of git, and where the old layout had it. */
export const MODEL_STATE = `${MODEL_FOLDER}/.state`
export const OLD_MODEL_STATE = `${OLD_MODEL_FOLDER}/.radical`

const isFile = (path: string): Promise<boolean> => stat(path).then((s) => s.isFile(), () => false)
const exists = (path: string): Promise<boolean> => stat(path).then(() => true, () => false)
const isModel = (folder: string): Promise<boolean> => isFile(join(folder, MD_MANIFEST_FILE))

/** The folders from `from` up to the repository's root (the nearest with a
 *  .git), or up to the file system's root outside a repository. */
async function upwards(from: string): Promise<string[]> {
  const dirs: string[] = []
  for (let dir = resolve(from); ; dir = dirname(dir)) {
    dirs.push(dir)
    if (await exists(join(dir, '.git')) || dirname(dir) === dir) return dirs
  }
}

/** The repository's root above `from`, or null outside a repository. */
export async function repositoryRoot(from: string): Promise<string | null> {
  const top = (await upwards(from)).at(-1)!
  return await exists(join(top, '.git')) ? top : null
}

/** The model folder to use when none is named: the working directory when
 *  it is one; else .radical/model, found from it up to the
 *  repository's root; else architecture/ there (the old layout). Null when
 *  there is none. */
export async function findModelFolder(cwd: string): Promise<string | null> {
  if (await isModel(cwd)) return resolve(cwd)
  const dirs = await upwards(cwd)
  for (const dir of dirs) if (await isModel(join(dir, MODEL_FOLDER))) return join(dir, MODEL_FOLDER)
  const old = join(dirs.at(-1)!, OLD_MODEL_FOLDER)
  return await isModel(old) ? old : null
}

/** The model a folder picked to open holds: the folder itself when it is
 *  one, else the .radical/model of a repository picked (an open dialog
 *  hides .radical/), or of the .radical/ folder itself. */
export async function repositoryModel(picked: string): Promise<string> {
  if (await isModel(picked)) return picked
  if (basename(resolve(picked)) === RADICAL_DIR && await isModel(join(picked, 'model'))) return join(picked, 'model')
  return await isModel(join(picked, MODEL_FOLDER)) ? join(picked, MODEL_FOLDER) : picked
}

/** A file of the repository in .radical/ (`file`) or where the old layout
 *  had it (`oldFile`), found from `from` up to the repository's root; null
 *  when neither is there. */
export async function findRepositoryFile(from: string, file: string, oldFile: string): Promise<{ path: string; root: string; old: boolean } | null> {
  for (const dir of await upwards(from)) {
    if (await isFile(join(dir, file))) return { path: join(dir, file), root: dir, old: false }
    if (await isFile(join(dir, oldFile))) return { path: join(dir, oldFile), root: dir, old: true }
  }
  return null
}

/** The folder a repository file's paths are relative to: the repository's
 *  root (the folder .radical/ is in) for one under .radical/, else the
 *  file's own folder. */
export function repositoryFileRoot(file: string): string {
  for (let dir = dirname(resolve(file)); dirname(dir) !== dir; dir = dirname(dir)) {
    if (basename(dir) === RADICAL_DIR) return dirname(dir)
  }
  return dirname(resolve(file))
}

/** The parts of the old layout a repository still has, from its root: what
 *  radical setup moves into .radical/. */
export async function oldLayout(root: string): Promise<string[]> {
  const found: string[] = []
  if (!(await isModel(join(root, MODEL_FOLDER))) && await isModel(join(root, OLD_MODEL_FOLDER))) found.push(OLD_MODEL_FOLDER)
  for (const [file, newer] of [[OLD_SENSORS_FILE, SENSORS_FILE], [OLD_CRUCIBLE_FILE, CRUCIBLE_FILE]]) {
    if (await isFile(join(root, file)) && !(await exists(join(root, newer)))) found.push(file)
  }
  if (await exists(join(root, OLD_CRUCIBLE_FINDINGS)) && !(await exists(join(root, CRUCIBLE_FINDINGS)))) found.push(OLD_CRUCIBLE_FINDINGS)
  // Out of git, so left behind when a pull moved the rest: Crucible's rounds
  // (their numbers go on) and the model's state.
  if (await exists(join(root, OLD_CRUCIBLE_ROUNDS)) && !(await exists(join(root, CRUCIBLE_ROUNDS)))) found.push(OLD_CRUCIBLE_ROUNDS)
  if (!found.includes(OLD_MODEL_FOLDER) && await exists(join(root, OLD_MODEL_STATE)) && !(await isModel(join(root, OLD_MODEL_FOLDER)))
    && await isModel(join(root, MODEL_FOLDER)) && !(await exists(join(root, MODEL_STATE)))) found.push(OLD_MODEL_STATE)
  return found
}

/** The repository's mapping of the model's elements to its code (ADR The
 *  repository maps the model to its code). */
export { REPOSITORY_FILE, elementPaths, type MappedElement }

/** The root whose .radical/radical.json maps the model in `folder`: the
 *  repository's, else the folder .radical/ is in (for .radical/model),
 *  else the model folder's parent. */
export async function mappingRoot(folder: string): Promise<string> {
  const at = resolve(folder)
  return await repositoryRoot(at) ?? (basename(dirname(at)) === RADICAL_DIR ? dirname(dirname(at)) : dirname(at))
}

/** The repository's .radical/radical.json, found from `from` up to the
 *  repository's root: the file, the root its paths are from and what it
 *  maps; null without one. Throws, naming the file, when it does not read. */
export async function readRepositoryMapping(from: string): Promise<{ file: string; root: string; implements: MappedElement[] } | null> {
  const found = await findRepositoryFile(from, REPOSITORY_FILE, REPOSITORY_FILE)
  if (!found) return null
  return { file: found.path, root: repositoryFileRoot(found.path), implements: parseRepositoryMapping(await readFile(found.path, 'utf8'), found.path) }
}
