import type { Stats } from 'node:fs'
import { lstat, mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises'
import { dirname, resolve, sep } from 'node:path'
import { isMdFolderModelPath } from '@radical/common/formats/mdFolder'
import type { MdFolderStorage } from '@radical/common/formats/mdFolderSync'

/** Node-only folder adapter shared by Electron and the local MCP server. */
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
    read: async (rel) => readFile(await inside(rel), 'utf-8'),
    async write(rel, content) {
      const abs = await inside(rel)
      await mkdir(dirname(abs), { recursive: true })
      // Re-check after mkdir, since a newly created parent is part of the path.
      await inside(rel)
      await writeFile(abs, content, 'utf-8')
      return stampOf(await stat(abs))
    },
    remove: async (rel) => rm(await inside(rel), { force: true }),
  }
}
