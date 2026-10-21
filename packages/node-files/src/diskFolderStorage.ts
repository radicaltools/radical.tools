import type { Stats } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { lstat, mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises'
import { dirname, join, resolve, sep } from 'node:path'
import { isMdFolderModelPath, stripBom } from '@radical/common/formats/mdFolder'
import type { MdFolderStorage } from '@radical/common/formats/mdFolderSync'
import { SELECTION_DIR } from '@radical/common/formats/canvasSelection'
import { editorStateDir } from './selectionFile'

/** The folder's write turn, under `.radical/`: the id of the process that
 *  holds it, when it took it, and a token of its own. */
const WRITE_LOCK = 'write.lock'
/** How long a writer waits for its turn before it gives up. */
const LOCK_WAIT_MS = 15_000
/** A turn held this long was left by a writer that hung or died. */
const LOCK_STALE_MS = 15_000
/** A lock file whose text names no turn is being written for no longer
 *  than this: one line, written at once. Older, it is no writer's. */
const LOCK_UNREAD_MS = 1_000

/** True when the lock file's text names a process that is gone, or a turn
 *  taken too long ago. A text that does not read as one (being written, or
 *  cut short by a crash, or garbage) is stale once the file is older (`age`)
 *  than a writer takes to write it: waiting out a whole turn for it made a
 *  read wait 15 s. */
function staleLock(text: string, age: number): boolean {
  const [pid, since] = text.trim().split(' ').map(Number)
  if (!Number.isFinite(pid) || !Number.isFinite(since)) return age > LOCK_UNREAD_MS
  if (Date.now() - since > LOCK_STALE_MS) return true
  if (pid === process.pid) return false
  try {
    process.kill(pid, 0)
    return false
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === 'ESRCH'
  }
}

const sleep = (ms: number) => new Promise((done) => setTimeout(done, ms))

/** Takes the write turn of the model folder at `base`: a lock file made
 *  only when there is none (O_EXCL), so of two processes one waits. To
 *  read, a folder without `.radical/` has no writer to wait for (one makes
 *  it first), and is left without one. */
async function takeWriteTurn(base: string, forRead = false): Promise<() => Promise<void>> {
  if (forRead && !(await lstat(join(base, SELECTION_DIR)).then(() => true, () => false))) return async () => {}
  const file = join(await editorStateDir(base), WRITE_LOCK)
  if (await lstat(file).then((s) => s.isSymbolicLink(), () => false)) throw new Error(`symlink in model path: .radical/${WRITE_LOCK}`)
  const mine = `${process.pid} ${Date.now()} ${randomUUID()}\n`
  const deadline = Date.now() + LOCK_WAIT_MS
  for (;;) {
    try {
      await writeFile(file, mine, { encoding: 'utf-8', flag: 'wx' })
      // Given back only while it is still this writer's.
      return async () => {
        if (await readFile(file, 'utf-8').catch(() => null) === mine) await rm(file, { force: true })
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error
    }
    const held = await readFile(file, 'utf-8').catch(() => null)
    const age = await stat(file).then((s) => Date.now() - s.mtimeMs, () => 0)
    if (held !== null && staleLock(held, age)) {
      // Taken out only as it was read: another writer may have taken it over.
      if (await readFile(file, 'utf-8').catch(() => null) === held) await rm(file, { force: true })
      continue
    }
    if (Date.now() > deadline) {
      throw new Error(`Another program has been writing this model folder for ${LOCK_WAIT_MS / 1000} s (.radical/${WRITE_LOCK}); ${forRead ? 'the folder was not read' : 'nothing was written'}. Try again.`)
    }
    await sleep(10 + Math.random() * 30)
  }
}

/** Node-only folder adapter shared by Electron and the local MCP server.
 *  Its lock gives processes writing one folder (two MCP servers, the
 *  desktop app) a turn each. */
export function diskFolderStorage(root: string): MdFolderStorage {
  const base = resolve(root)
  const stampOf = (s: Stats): string => `${s.mtimeMs}:${s.size}`

  async function inside(rel: string): Promise<string> {
    const abs = resolve(base, rel)
    if (!abs.startsWith(base + sep)) throw new Error(`path outside the model folder: ${rel}`)
    if (!isMdFolderModelPath(rel) || rel.includes('\\') || rel.split('/').some((part) => !part || part === '.' || part === '..')) {
      throw new Error(`not a model file: ${rel}`)
    }
    // Refuse symbolic links at every existing component. In particular, a
    // symlinked nodes/ directory must never redirect writes outside the model.
    let current = base
    for (const part of rel.split('/')) {
      current = resolve(current, part)
      try {
        if ((await lstat(current)).isSymbolicLink()) throw new Error(`symlink in model path: ${rel}`)
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
      }
    }
    return abs
  }

  return {
    async list() {
      const stamps: Record<string, string> = {}
      const add = async (rel: string): Promise<void> => {
        try { stamps[rel] = stampOf(await stat(await inside(rel))) }
        catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error }
      }
      const walk = async (rel: string): Promise<void> => {
        const entries = await readdir(await inside(`${rel}/_index.md`).then(dirname), { withFileTypes: true })
        for (const entry of entries) {
          if (entry.name.startsWith('.')) continue
          const child = `${rel}/${entry.name}`
          if (entry.isDirectory()) await walk(child)
          else if (entry.isFile() && isMdFolderModelPath(child)) await add(child)
          else if (entry.isSymbolicLink()) throw new Error(`symlink in model path: ${child}`)
        }
      }
      const top = await readdir(base, { withFileTypes: true })
      for (const entry of top) {
        if (entry.isFile() && isMdFolderModelPath(entry.name)) await add(entry.name)
        else if (entry.isDirectory() && entry.name === 'nodes') await walk('nodes')
        else if (entry.isSymbolicLink() && (entry.name === 'nodes' || isMdFolderModelPath(entry.name))) {
          throw new Error(`symlink in model path: ${entry.name}`)
        }
      }
      return stamps
    },
    // Decoded as the browser decodes a file: without a byte-order mark.
    read: async (rel) => stripBom(await readFile(await inside(rel), 'utf-8')),
    async write(rel, content) {
      const abs = await inside(rel)
      await mkdir(dirname(abs), { recursive: true })
      // Re-check after mkdir, since a newly created parent is part of the path.
      await inside(rel)
      await writeFile(abs, content, 'utf-8')
      return stampOf(await stat(abs))
    },
    remove: async (rel) => rm(await inside(rel), { force: true }),
    lock: (forRead) => takeWriteTurn(base, forRead),
  }
}
