import { lstat, mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import {
  OLD_STATE_DIR, STATE_DIR, SELECTION_FILE, SELECTION_GITIGNORE, SELECTION_GITIGNORE_CONTENT,
  oldStatePath, parseSelection, type CanvasSelection,
} from '@radical/common/formats/canvasSelection'
import { FORGE_RUN_FILE, parseForgeRun, type ForgeRunStatus } from '@radical/common/formats/forgeRunStatus'
import { CHECK_CONFIG_FILE, MEASUREMENTS_FILE, REVIEWS_FILE, TEST_RESULTS_FILE } from '@radical/common/check'
import { DEPS_FILE, FEDERATION_FILE } from '@radical/common/federation'
import { REPOSITORY_FILE } from '@radical/common/repositoryMapping'
import { REVIEWS_FILE as REPOSITORY_REVIEWS, findRepositoryFile, mappingRoot } from './repositoryLayout'

/** Refuses a symlinked `.state` (or old `.radical`), which could redirect
 *  the write elsewhere. */
async function selectionDir(root: string, create: boolean, name = STATE_DIR): Promise<string | null> {
  const dir = join(resolve(root), name)
  try {
    if ((await lstat(dir)).isSymbolicLink()) throw new Error(`symlink in model path: ${name}`)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
    if (!create) return null
    // Another writer (the folder's cache, written in the background) may
    // make it first.
    await mkdir(dir).catch((e: NodeJS.ErrnoException) => { if (e.code !== 'EEXIST') throw e })
  }
  return dir
}

/** The model folder's `.state/` directory, made when missing, with the
 *  `.gitignore` that keeps it out of version control. */
export async function editorStateDir(root: string): Promise<string> {
  const dir = (await selectionDir(root, true))!
  const ignore = join(resolve(root), SELECTION_GITIGNORE)
  try { await lstat(ignore) }
  catch { await writeFile(ignore, SELECTION_GITIGNORE_CONTENT, 'utf-8') }
  return dir
}

/** Writes an editor-state file under `.state/` in a model folder (`path`
 *  relative to the folder), with the `.gitignore` that keeps the directory
 *  out of version control. */
export async function writeEditorStateFile(root: string, path: string, content: string): Promise<void> {
  await editorStateDir(root)
  const file = join(resolve(root), path)
  if (await lstat(file).then((s) => s.isSymbolicLink(), () => false)) throw new Error(`symlink in model path: ${path}`)
  await writeFile(file, content, 'utf-8')
}

/** An editor-state file under `.state/`, or under the folder's old
 *  `.radical/` while `.state/` lacks it; null when there is none. */
export async function readEditorStateFile(root: string, path: string): Promise<string | null> {
  if (await selectionDir(root, false)) {
    const text = await readFile(join(resolve(root), path), 'utf-8').catch(() => null)
    if (text !== null) return text
  }
  const old = oldStatePath(path)
  if (old === path || !(await selectionDir(root, false, OLD_STATE_DIR))) return null
  return readFile(join(resolve(root), old), 'utf-8').catch(() => null)
}

/** Writes Studio's canvas selection (see canvasSelection) into a model folder,
 *  with the `.gitignore` that keeps it out of version control. */
export async function writeSelectionFile(root: string, content: string): Promise<void> {
  await writeEditorStateFile(root, SELECTION_FILE, content)
}

/** The selection Studio last wrote into a model folder, or null when there is
 *  none (no Studio has had the folder open) or it is unreadable. */
export async function readSelectionFile(root: string): Promise<CanvasSelection | null> {
  const text = await readEditorStateFile(root, SELECTION_FILE)
  return text === null ? null : parseSelection(text)
}

/** Writes the status of an agent's Forge run (see forgeRunStatus). */
export async function writeForgeRunFile(root: string, content: string): Promise<void> {
  await writeEditorStateFile(root, FORGE_RUN_FILE, content)
}

/** The Forge run status in a model folder, or null when there is none. */
export async function readForgeRunFile(root: string): Promise<ForgeRunStatus | null> {
  const text = await readEditorStateFile(root, FORGE_RUN_FILE)
  return text === null ? null : parseForgeRun(text)
}

/** A file of the model folder itself (not under `.state/`); null when it
 *  is not there or is a symlink, which could point anywhere. */
async function readModelFile(root: string, name: string): Promise<string | null> {
  const path = join(resolve(root), name)
  try {
    return (await lstat(path)).isSymbolicLink() ? null : await readFile(path, 'utf-8')
  } catch { return null }
}

/** What `radical check` and `radical sense` keep beside a model for Studio:
 *  the test results and the measurements under `.state/`, and the model's
 *  own check.json and reviews.json (the reviews of its manual fitness
 *  functions, kept in git), and the repository's .radical/radical.json;
 *  null for one that is not there. */
export async function readCheckFiles(root: string): Promise<{ results: string | null; measurements: string | null; config: string | null; reviews: string | null; repository: string | null }> {
  const results = await readEditorStateFile(root, TEST_RESULTS_FILE)
  const measurements = await readEditorStateFile(root, MEASUREMENTS_FILE)
  const config = await readModelFile(root, CHECK_CONFIG_FILE)
  // The repository's .radical/reviews.json, else the model folder's.
  const reviews = await readFile(join(await mappingRoot(root), REPOSITORY_REVIEWS), 'utf-8').catch(() => null) ?? await readModelFile(root, REVIEWS_FILE)
  // Where the repository builds the model's elements, for the card.
  const found = await findRepositoryFile(root, REPOSITORY_FILE, REPOSITORY_FILE)
  const repository = found ? await readFile(found.path, 'utf-8').catch(() => null) : null
  return { results, measurements, config, reviews, repository }
}

/** What a federation keeps beside a model for Studio: its own deps.json
 *  (kept in git) and the other models `radical federation fetch` wrote into
 *  `.state/federation.json`; null for one that is not there. */
export async function readFederationFiles(root: string): Promise<{ deps: string | null; federation: string | null }> {
  const deps = await readModelFile(root, DEPS_FILE)
  const federation = await readEditorStateFile(root, FEDERATION_FILE)
  return { deps, federation }
}

/** Writes the repository's .radical/radical.json for the model in `root`:
 *  the one readCheckFiles reads, else a new one in the repository's
 *  .radical/. Refuses a symlink, which could redirect the write. */
export async function writeRepositoryFile(root: string, content: string): Promise<void> {
  const found = await findRepositoryFile(root, REPOSITORY_FILE, REPOSITORY_FILE)
  const path = found?.path ?? join(await mappingRoot(root), REPOSITORY_FILE)
  if (await lstat(path).then((s) => s.isSymbolicLink(), () => false)) throw new Error(`symlink: ${path}`)
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, content, 'utf-8')
}

/** Writes the model's check.json (the Inspector's settings). Refuses a
 *  symlinked one, which could redirect the write elsewhere. */
export async function writeCheckConfig(root: string, content: string): Promise<void> {
  const configPath = join(resolve(root), CHECK_CONFIG_FILE)
  if (await lstat(configPath).then((s) => s.isSymbolicLink(), () => false)) throw new Error(`symlink in model path: ${CHECK_CONFIG_FILE}`)
  await writeFile(configPath, content, 'utf-8')
}

