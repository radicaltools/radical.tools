import { afterEach, describe, expect, it } from 'vitest'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { MODEL_BASE_FILE } from '@radical/common/formats/modelBase'
import { TEST_RESULTS_FILE } from '@radical/common/check'
import { readCheckFiles, readEditorStateFile, writeEditorStateFile } from '../src/selectionFile'

let dir: string | undefined
afterEach(async () => {
  if (dir) await rm(dir, { recursive: true, force: true })
  dir = undefined
})

describe('model state', () => {
  it('writes state into .state and reads a file the old .radical/ still has', async () => {
    dir = await mkdtemp(join(tmpdir(), 'radical-state-'))
    // An earlier version kept the base and the test results in .radical/.
    await mkdir(join(dir, '.radical'))
    await writeFile(join(dir, '.radical', 'base.json'), 'old base')
    await writeFile(join(dir, '.radical', 'test-results.json'), 'old results')
    expect(MODEL_BASE_FILE).toBe('.state/base.json')
    expect(await readEditorStateFile(dir, MODEL_BASE_FILE)).toBe('old base')
    expect((await readCheckFiles(dir)).results).toBe('old results')

    // What is written goes into .state/, with its .gitignore, and is read
    // from there on; the old file is left as it was.
    await writeEditorStateFile(dir, MODEL_BASE_FILE, 'new base')
    expect(await readFile(join(dir, '.state', 'base.json'), 'utf8')).toBe('new base')
    expect(await readFile(join(dir, '.state', '.gitignore'), 'utf8')).toBe('*\n')
    expect(await readEditorStateFile(dir, MODEL_BASE_FILE)).toBe('new base')
    expect(await readFile(join(dir, '.radical', 'base.json'), 'utf8')).toBe('old base')
    // A file .state/ lacks still comes from .radical/.
    expect(await readEditorStateFile(dir, TEST_RESULTS_FILE)).toBe('old results')
  })
})
