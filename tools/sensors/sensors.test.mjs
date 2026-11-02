// The sensors of radical.sensors.json and where they find the elements
// (tools/sensors/elements.mjs): every element a fitness function measures
// with one of them has a place, and one without is named.
import { describe, expect, it } from 'vitest'
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { appliedElements, parseMeasure } from '@radical/common/check'
import { deserializeFromMdFolder } from '@radical/common/formats/mdFolder'
import { MdFolderSession } from '@radical/common/formats/mdFolderSync'
import { diskFolderStorage } from '@radical/node-files/diskFolderStorage'
import { ELEMENTS } from './elements.mjs'

const ROOT = join(import.meta.dirname, '../..')
const SENSORS = JSON.parse(readFileSync(join(ROOT, 'radical.sensors.json'), 'utf8')).sensors

describe('repository sensors', () => {
  it('has a place for every element a fitness function measures with a sensor of radical.sensors.json', async () => {
    const { data } = deserializeFromMdFolder(await new MdFolderSession(diskFolderStorage(join(ROOT, 'architecture')), { writeCache: false }).readAll())
    const model = { nodes: Object.fromEntries(data.nodes.map((n) => [n.id, n])), relations: Object.fromEntries(data.relations.map((r) => [r.id, r])) }
    const measured = data.nodes.filter((n) => n.type === 'fitness-fn' && parseMeasure(n.measure).some((line) => SENSORS[line.sensor]))
    expect(measured.map((n) => n.label).sort()).toEqual(['Installable npm packages', 'One mark everywhere', 'One product version', 'Workspace boundaries'])
    const missing = measured.flatMap((ff) => appliedElements(model, ff)).filter((e) => !ELEMENTS[e.id]).map((e) => `${e.label} (${e.id})`)
    expect(missing).toEqual([])
  })

  it('fails for an element it has no place for, naming it', () => {
    const context = JSON.stringify({ element: { id: 'nowhere', label: 'Billing API', type: 'container' } })
    for (const name of Object.keys(SENSORS)) {
      const [command, ...args] = SENSORS[name].command.split(' ')
      const run = spawnSync(command, [...args, '--context', context], { cwd: ROOT, encoding: 'utf8' })
      expect([name, run.status, run.stderr.trim()]).toEqual([name, 2, 'no place for container "Billing API" (nowhere) in tools/sensors/elements.mjs'])
    }
  })
})
