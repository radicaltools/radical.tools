import { afterEach, describe, expect, it } from 'vitest'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { MD_MANIFEST_FILE } from '@radical/common/formats/mdFolder'
import { parseMeasurementStore } from '@radical/common/check'
import { main } from '../cli'

const dirs: string[] = []
afterEach(async () => { await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true }))) })

/** A repository (a .git folder) with a model folder and, when given, a
 *  .radical/radical.json. */
async function repository(radicalJson?: unknown): Promise<string> {
  const cwd = await mkdtemp(join(tmpdir(), 'radical-machine-'))
  dirs.push(cwd)
  await mkdir(join(cwd, '.git'))
  await mkdir(join(cwd, '.radical', 'model'), { recursive: true })
  await writeFile(join(cwd, '.radical', 'model', MD_MANIFEST_FILE), '---\nradicalFormat: md-folder\nversion: 1\n---\n')
  if (radicalJson !== undefined) await writeFile(join(cwd, '.radical', 'radical.json'), JSON.stringify(radicalJson))
  return cwd
}

async function run(cwd: string, ...args: string[]): Promise<{ code: number; out: string; err: string }> {
  let out = ''
  let err = ''
  const code = await main(args, { cwd, out: (t) => { out += t + '\n' }, err: (t) => { err += t + '\n' } })
  return { code, out, err }
}

const store = async (cwd: string) => parseMeasurementStore(await readFile(join(cwd, '.radical', 'model', '.state', 'measurements.json'), 'utf8'))

describe('radical sense machine', () => {
  it('measures nothing without a reference time, and says to take one', async () => {
    const cwd = await repository()
    const result = await run(cwd, 'sense', 'machine', '--runs', '1')
    expect(result.code).toBe(2)
    expect(result.err).toContain('radical sense machine --reference')
  })

  it('keeps the reference in .radical/radical.json with --reference, beside what the file holds', async () => {
    const cwd = await repository({ implements: [{ element: 'web', paths: ['apps/web'] }], verifies: [] })
    expect((await run(cwd, 'sense', 'machine', '--reference', '--runs', '1')).code).toBe(0)
    const file = JSON.parse(await readFile(join(cwd, '.radical', 'radical.json'), 'utf8'))
    expect(file.machine).toMatchObject({ work: 'builtin' })
    expect(file.machine.ms).toBeGreaterThan(0)
    expect(file.implements).toEqual([{ element: 'web', paths: ['apps/web'] }])
    const measured = await store(cwd)
    expect(measured.find((m) => m.metric === 'machine.speed')?.value).toBe(1)
  })

  it('measures machine.work and machine.speed against the reference', async () => {
    // A reference no machine reaches: the speed is far above 1.
    const cwd = await repository({ machine: { ms: 0.01, work: 'builtin', at: '2026-11-24T00:00:00Z' }, implements: [], verifies: [] })
    expect((await run(cwd, 'sense', 'machine', '--runs', '1')).code).toBe(0)
    const measured = await store(cwd)
    const work = measured.find((m) => m.metric === 'machine.work')!
    expect(work).toMatchObject({ unit: 'ms', labels: { work: 'builtin' }, source: 'machine' })
    expect(measured.find((m) => m.metric === 'machine.speed')!.value).toBeCloseTo(work.value / 0.01, 0)
  })

  it('keeps the slower of the runs before and after the tests with --again', async () => {
    const cwd = await repository({ machine: { ms: 1, work: 'builtin', at: '2026-11-24T00:00:00Z' }, implements: [], verifies: [] })
    // Before the tests: a slow machine (a minute of work), measured just now.
    await mkdir(join(cwd, '.radical', 'model', '.state'), { recursive: true })
    await writeFile(join(cwd, '.radical', 'model', '.state', 'measurements.json'), JSON.stringify({
      version: 1,
      measurements: [{ metric: 'machine.work', value: 60000, unit: 'ms', labels: { work: 'builtin' }, source: 'machine', at: new Date().toISOString() }],
    }))
    expect((await run(cwd, 'sense', 'machine', '--again', '--runs', '1')).code).toBe(0)
    const measured = await store(cwd)
    expect(measured.find((m) => m.metric === 'machine.work')!.value).toBe(60000)
    expect(measured.find((m) => m.metric === 'machine.speed')!.value).toBe(60000)
    // Without --again the run stands alone.
    expect((await run(cwd, 'sense', 'machine', '--runs', '1')).code).toBe(0)
    expect((await store(cwd)).find((m) => m.metric === 'machine.work')!.value).toBeLessThan(60000)
  })

  it('refuses to compare work other than the reference was taken with', async () => {
    const cwd = await repository({ machine: { ms: 5, work: 'builtin', at: '2026-11-24T00:00:00Z' }, implements: [], verifies: [] })
    const result = await run(cwd, 'sense', 'machine', '--work', `"${process.execPath}" -e 0`, '--runs', '1')
    expect(result.code).toBe(2)
    expect(result.err).toContain('the built-in work')
  })
})
