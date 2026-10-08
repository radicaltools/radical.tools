import { lstat, mkdir, readFile, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import {
  SELECTION_DIR, SELECTION_FILE, SELECTION_GITIGNORE, SELECTION_GITIGNORE_CONTENT,
  parseSelection, type CanvasSelection,
} from '@radical/common/formats/canvasSelection'

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

/** Writes Studio's canvas selection (see canvasSelection) into a model folder,
 *  with the `.gitignore` that keeps it out of version control. */
export async function writeSelectionFile(root: string, content: string): Promise<void> {
  await selectionDir(root, true)
  const ignore = join(resolve(root), SELECTION_GITIGNORE)
  try { await lstat(ignore) }
  catch { await writeFile(ignore, SELECTION_GITIGNORE_CONTENT, 'utf-8') }
  const file = join(resolve(root), SELECTION_FILE)
  if (await lstat(file).then((s) => s.isSymbolicLink(), () => false)) throw new Error(`symlink in model path: ${SELECTION_FILE}`)
  await writeFile(file, content, 'utf-8')
}

/** The selection Studio last wrote into a model folder, or null when there is
 *  none (no Studio has had the folder open) or it is unreadable. */
export async function readSelectionFile(root: string): Promise<CanvasSelection | null> {
  if (!(await selectionDir(root, false))) return null
  try { return parseSelection(await readFile(join(resolve(root), SELECTION_FILE), 'utf-8')) }
  catch { return null }
}
