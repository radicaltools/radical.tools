import { afterEach, describe, expect, it } from 'vitest'
import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { readCheckFiles } from '../src/selectionFile'

let dir: string | undefined

afterEach(async () => {
  if (dir) await rm(dir, { recursive: true, force: true })
  dir = undefined
})

describe('readCheckFiles', () => {
  it('reads the model\'s reviews.json beside check.json and the files under .radical', async () => {
    dir = await mkdtemp(join(tmpdir(), 'radical-check-files-'))
    await mkdir(join(dir, '.radical'))
    await writeFile(join(dir, '.radical', 'test-results.json'), 'results')
    await writeFile(join(dir, '.radical', 'measurements.json'), 'measurements')
    await writeFile(join(dir, 'check.json'), '{}')
    await writeFile(join(dir, 'reviews.json'), 'reviews')
    expect(await readCheckFiles(dir)).toEqual({ results: 'results', measurements: 'measurements', config: '{}', reviews: 'reviews' })
  })

  it('gives null for a reviews.json that is not there, and refuses a symlinked one', async () => {
    dir = await mkdtemp(join(tmpdir(), 'radical-check-files-'))
    expect((await readCheckFiles(dir)).reviews).toBeNull()
    await writeFile(join(dir, 'elsewhere.json'), 'secret')
    await symlink(join(dir, 'elsewhere.json'), join(dir, 'reviews.json'))
    await symlink(join(dir, 'elsewhere.json'), join(dir, 'check.json'))
    expect(await readCheckFiles(dir)).toMatchObject({ config: null, reviews: null })
  })
})
