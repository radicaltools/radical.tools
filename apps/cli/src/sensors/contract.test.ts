// The contract every sensor adapter keeps: run on its fixture (a copy of its
// tool's real output), it writes a valid radical-metrics/1 file, and it
// takes no threshold: values are judged by the conditions in the model.

import { afterEach, describe, expect, it } from 'vitest'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { SENSOR_NAMES, metricsFileProblems, serializeMetricsFile } from '@radical/common/check'
import { SENSOR_ADAPTERS } from './registry'

const dirs: string[] = []
afterEach(async () => { await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true }))) })

const JUDGING = /^(threshold|max|min|limit|fail|budget|target|goal|assert)/i

describe('sensor adapters', () => {
  it('lists each adapter once, with what it reads and how to call it', () => {
    expect(new Set(SENSOR_ADAPTERS.map((a) => a.name)).size).toBe(SENSOR_ADAPTERS.length)
    for (const a of SENSOR_ADAPTERS) {
      expect(a.name).toMatch(/^[a-z][a-z0-9-]*$/)
      expect(a.description.length).toBeGreaterThan(10)
      expect(a.usage).toContain(`radical sense ${a.name}`)
    }
  })

  it('are the sensors a measure line can name, and no others', () => {
    expect(SENSOR_ADAPTERS.map((a) => a.name).sort()).toEqual([...SENSOR_NAMES].sort())
  })

  for (const adapter of SENSOR_ADAPTERS) {
    it(`${adapter.name}: writes radical-metrics/1 from its fixture and judges no value`, async () => {
      expect(Object.keys(adapter.options ?? {}).filter((o) => JUDGING.test(o))).toEqual([])
      const cwd = await mkdtemp(join(tmpdir(), `radical-sensor-${adapter.name}-`))
      dirs.push(cwd)
      for (const [path, content] of Object.entries(adapter.fixture.files ?? {})) {
        await mkdir(dirname(join(cwd, path)), { recursive: true })
        await writeFile(join(cwd, path), content)
      }
      const values = await adapter.measure({ args: adapter.fixture.args, options: adapter.fixture.options ?? {}, cwd })
      expect(values.length).toBeGreaterThan(0)
      const file = JSON.parse(serializeMetricsFile({ source: adapter.name, at: new Date().toISOString(), measurements: values }))
      expect(metricsFileProblems(file)).toEqual([])
    })
  }
})
