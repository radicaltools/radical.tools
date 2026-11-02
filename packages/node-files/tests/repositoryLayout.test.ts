import { afterEach, describe, expect, it } from 'vitest'
import { mkdir, mkdtemp, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { findModelFolder, findRepositoryFile, oldLayout, repositoryFileRoot as crucibleRoot, repositoryRoot } from '../src/repositoryLayout'

const dirs: string[] = []
afterEach(async () => { await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true }))) })

/** A repository (a .git folder) with `files`, each path to its content; a
 *  path ending in / is a folder. */
async function repository(files: string[]): Promise<string> {
  const dir = await realpath(await mkdtemp(join(tmpdir(), 'radical-layout-')))
  dirs.push(dir)
  await mkdir(join(dir, '.git'))
  for (const path of files) {
    if (path.endsWith('/')) { await mkdir(join(dir, path), { recursive: true }); continue }
    await mkdir(join(dir, path, '..'), { recursive: true })
    await writeFile(join(dir, path), path.endsWith('radical.md') ? '---\nradicalFormat: md-folder\nversion: 1\n---\n' : '{}')
  }
  return dir
}

describe('repository layout', () => {
  it('finds the model in .radical/model from any folder of the repository', async () => {
    const root = await repository(['.radical/model/radical.md', '.radical/sensors.json', '.radical/crucible/crucible.json', 'apps/web/src/', 'other/radical.md'])
    expect(await repositoryRoot(join(root, 'apps/web/src'))).toBe(root)
    expect(await findModelFolder(join(root, 'apps/web/src'))).toBe(join(root, '.radical/model'))
    expect(await findModelFolder(root)).toBe(join(root, '.radical/model'))
    // A working directory that is a model folder is that one.
    expect(await findModelFolder(join(root, 'other'))).toBe(join(root, 'other'))
    expect(await findRepositoryFile(join(root, '.radical/model'), '.radical/sensors.json', 'radical.sensors.json'))
      .toEqual({ path: join(root, '.radical/sensors.json'), root, old: false })
    // Crucible's paths are from the repository's root, not from .radical/.
    expect(crucibleRoot(join(root, '.radical/crucible/crucible.json'))).toBe(root)
    expect(await oldLayout(root)).toEqual([])
  })

  it('falls back to the old layout', async () => {
    const root = await repository(['architecture/radical.md', 'radical.sensors.json', 'crucible.json', 'crucible/findings/', 'apps/'])
    expect(await findModelFolder(join(root, 'apps'))).toBe(join(root, 'architecture'))
    expect(await findRepositoryFile(join(root, 'architecture'), '.radical/sensors.json', 'radical.sensors.json'))
      .toEqual({ path: join(root, 'radical.sensors.json'), root, old: true })
    expect(crucibleRoot(join(root, 'crucible.json'))).toBe(root)
    expect(await oldLayout(root)).toEqual(['architecture', 'radical.sensors.json', 'crucible.json', 'crucible/findings'])
    // What a pull left behind, out of git: the rounds and the model's state.
    const pulled = await repository(['.radical/model/radical.md', '.crucible/rounds/round-1-2/', 'architecture/.radical/base.json'])
    expect(await oldLayout(pulled)).toEqual(['.crucible/rounds', 'architecture/.radical'])
    // Without a model anywhere, none.
    const empty = await repository(['src/'])
    expect(await findModelFolder(join(empty, 'src'))).toBeNull()
  })
})
