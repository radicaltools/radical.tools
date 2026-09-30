// ─── Md-folder storage on the local disk ─────────────────────────────────────
//
// The `MdFolderStorage` behind Electron's md-folder sessions (see
// @radical/common/formats/mdFolderSync). Kept free of Electron imports so it
// can be tested against a real temporary directory.

import type { Stats } from 'fs'
import { readFile, writeFile, mkdir, readdir, rm, stat } from 'fs/promises'
import { join, resolve, dirname, sep } from 'path'
import { isMdFolderModelPath } from '@radical/common/formats/mdFolder'
import type { MdFolderStorage } from '@radical/common/formats/mdFolderSync'

/** Absolute path of `rel` inside `root`; throws if `rel` would escape it. */
function inside(root: string, rel: string): string {
  const abs = resolve(root, rel)
  if (!abs.startsWith(resolve(root) + sep)) throw new Error(`path outside the model folder: ${rel}`)
  return abs
}

/** A model folder on the local disk. Only the manifest, the top-level
 *  sidecars and `nodes/**` are listed — the rest of the folder (a repo's
 *  `node_modules`, say) is never walked. Hidden files are ignored. */
export function diskFolderStorage(root: string): MdFolderStorage {
  const stampOf = (s: Stats): string => `${s.mtimeMs}:${s.size}`
  return {
    async list() {
      const stamps: Record<string, string> = {}
      const add = async (rel: string): Promise<void> => {
        try { stamps[rel] = stampOf(await stat(join(root, rel))) } catch { /* gone meanwhile */ }
      }
      const walk = async (rel: string): Promise<void> => {
        const entries = await readdir(join(root, rel), { withFileTypes: true }).catch(() => [])
        for (const entry of entries) {
          if (entry.name.startsWith('.')) continue
          const child = `${rel}/${entry.name}`
          if (entry.isDirectory()) await walk(child)
          else if (entry.isFile() && isMdFolderModelPath(child)) await add(child)
        }
      }
      const top = await readdir(root, { withFileTypes: true }).catch(() => [])
      for (const entry of top) {
        if (entry.isFile() && isMdFolderModelPath(entry.name)) await add(entry.name)
        else if (entry.isDirectory() && entry.name === 'nodes') await walk('nodes')
      }
      return stamps
    },
    read: (rel) => readFile(inside(root, rel), 'utf-8'),
    async write(rel, content) {
      const abs = inside(root, rel)
      await mkdir(dirname(abs), { recursive: true })
      await writeFile(abs, content, 'utf-8')
      return stampOf(await stat(abs))
    },
    remove: (rel) => rm(inside(root, rel), { force: true }),
  }
}
