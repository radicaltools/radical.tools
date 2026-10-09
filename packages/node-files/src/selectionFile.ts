import { lstat, mkdir, readFile, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import {
  SELECTION_DIR, SELECTION_FILE, SELECTION_GITIGNORE, SELECTION_GITIGNORE_CONTENT,
  parseSelection, type CanvasSelection,
} from '@radical/common/formats/canvasSelection'
import { FORGE_RUN_FILE, parseForgeRun, type ForgeRunStatus } from '@radical/common/formats/forgeRunStatus'

/** Refuses a symlinked `.radical`, which could redirect the write elsewhere. */
async function selectionDir(root: string, create: boolean): Promise<string | null> {
  const dir = join(resolve(root), SELECTION_DIR)
  try {
    if ((await lstat(dir)).isSymbolicLink()) throw new Error(`symlink in model path: ${SELECTION_DIR}`)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
    if (!create) return null
    await mkdir(dir)
  }
  return dir
}

/** Writes an editor-state file under `.radical/` in a model folder (`path`
 *  relative to the folder), with the `.gitignore` that keeps the directory
 *  out of version control. */
export async function writeEditorStateFile(root: string, path: string, content: string): Promise<void> {
  await selectionDir(root, true)
  const ignore = join(resolve(root), SELECTION_GITIGNORE)
  try { await lstat(ignore) }
  catch { await writeFile(ignore, SELECTION_GITIGNORE_CONTENT, 'utf-8') }
  const file = join(resolve(root), path)
  if (await lstat(file).then((s) => s.isSymbolicLink(), () => false)) throw new Error(`symlink in model path: ${path}`)
  await writeFile(file, content, 'utf-8')
}

/** An editor-state file under `.radical/`, or null when there is none. */
export async function readEditorStateFile(root: string, path: string): Promise<string | null> {
  if (!(await selectionDir(root, false))) return null
  try { return await readFile(join(resolve(root), path), 'utf-8') }
  catch { return null }
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
