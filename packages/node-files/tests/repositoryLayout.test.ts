import { afterEach, describe, expect, it } from 'vitest'
import { mkdir, mkdtemp, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { elementPaths, findModelFolder, missingCodePaths, repositoryModel, findRepositoryFile, oldLayout, readRepositoryMapping, repositoryFileRoot as crucibleRoot, repositoryRoot } from '../src/repositoryLayout'

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
    const root = await repository(['.radical/model/radical.md', '.radical/sensors/sensors.json', '.radical/crucible/crucible.json', 'apps/web/src/', 'other/radical.md'])
    expect(await repositoryRoot(join(root, 'apps/web/src'))).toBe(root)
    expect(await findModelFolder(join(root, 'apps/web/src'))).toBe(join(root, '.radical/model'))
    expect(await findModelFolder(root)).toBe(join(root, '.radical/model'))
    // A working directory that is a model folder is that one.
    expect(await findModelFolder(join(root, 'other'))).toBe(join(root, 'other'))
    expect(await findRepositoryFile(join(root, '.radical/model'), '.radical/sensors/sensors.json', 'radical.sensors.json'))
      .toEqual({ path: join(root, '.radical/sensors/sensors.json'), root, old: false })
    // Crucible's paths are from the repository's root, not from .radical/.
    expect(crucibleRoot(join(root, '.radical/crucible/crucible.json'))).toBe(root)
    expect(await oldLayout(root)).toEqual([])
    // A folder picked to open: the repository, or its .radical/ itself.
    expect(await repositoryModel(root)).toBe(join(root, '.radical/model'))
    expect(await repositoryModel(join(root, '.radical'))).toBe(join(root, '.radical/model'))
    expect(await repositoryModel(join(root, 'other'))).toBe(join(root, 'other'))
  })

  it('falls back to the old layout', async () => {
    const root = await repository(['architecture/radical.md', 'radical.sensors.json', 'crucible.json', 'crucible/findings/', 'apps/'])
    expect(await findModelFolder(join(root, 'apps'))).toBe(join(root, 'architecture'))
    expect(await findRepositoryFile(join(root, 'architecture'), '.radical/sensors/sensors.json', 'radical.sensors.json'))
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

describe('repository mapping', () => {
  it('gives an element its own paths, else its nearest mapped ancestor\'s', async () => {
    const root = await repository(['.radical/model/radical.md', 'apps/api/', 'src/'])
    await writeFile(join(root, '.radical/radical.json'), JSON.stringify({ implements: [
      { element: 'shop', name: 'Shop', paths: ['.'] },
      { element: 'api', name: 'Orders API', paths: ['apps/api'] },
    ] }))
    const mapping = (await readRepositoryMapping(join(root, 'src')))!
    expect(mapping.file).toBe(join(root, '.radical/radical.json'))
    expect(mapping.root).toBe(root)
    const parent: Record<string, string> = { api: 'shop', checkout: 'api', web: 'shop' }
    const paths = (id: string) => elementPaths(mapping.implements, id, (at) => parent[at])
    expect([paths('api'), paths('checkout'), paths('web'), paths('elsewhere')]).toEqual([['apps/api'], ['apps/api'], ['.'], []])
    // None in a repository without one; one that does not read is named.
    expect(await readRepositoryMapping(await repository(['src/']))).toBeNull()
    await writeFile(join(root, '.radical/radical.json'), '{ "implements": [{ "paths": [] }] }')
    await expect(readRepositoryMapping(root)).rejects.toThrow('implements[0] needs "element" (an id) and "paths" (a list of folders)')
  })
})

describe('code paths in descriptions', () => {
  it('finds the paths from the repository\'s root a description names that the repository lacks', async () => {
    const root = await repository(['apps/api/src/main.ts', 'docs/', '.radical/model/radical.md'])
    const nodes = [
      { id: 'api', type: 'container', description: 'Starts in apps/api/src/main.ts. Its old entry apps/api/src/server.ts went; see docs/API.md.' },
      { id: 'ok', type: 'component', description: 'Reads .state/base.json, https://example.com/apps/x.ts, ~/.radical/node, dist/index.js and apps/api/out/x.js.' },
      { id: 'note', type: 'need', description: 'Something in apps/gone/x.ts once.' },
      { id: 'finding', type: 'component', description: 'Writes .radical/crucible/findings/F-NNNN.md.' },
    ]
    expect(await missingCodePaths(root, nodes)).toEqual({ api: ['apps/api/src/server.ts', 'docs/API.md'] })
  })
})
