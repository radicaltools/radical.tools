// The sensors of .radical/sensors/sensors.json and the paths they measure
// in, from the repository's .radical/radical.json: every element a fitness
// function measures with one of them has paths, and one without is named.
import { describe, expect, it } from 'vitest'
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { appliedElements, parseMeasure } from '@radical/common/check'
import { deserializeFromMdFolder } from '@radical/common/formats/mdFolder'
import { MdFolderSession } from '@radical/common/formats/mdFolderSync'
import { diskFolderStorage } from '@radical/node-files/diskFolderStorage'
import { elementPaths, readRepositoryMapping } from '@radical/node-files/repositoryLayout'
import { workspacesOf } from './context.mjs'

const ROOT = join(import.meta.dirname, '../..')
const SENSORS = JSON.parse(readFileSync(join(ROOT, '.radical', 'sensors', 'sensors.json'), 'utf8')).sensors

describe('repository sensors', () => {
  it('has paths for every element a fitness function measures with a sensor of .radical/sensors/sensors.json', async () => {
    const { data } = deserializeFromMdFolder(await new MdFolderSession(diskFolderStorage(join(ROOT, '.radical', 'model')), { writeCache: false }).readAll())
    const nodes = Object.fromEntries(data.nodes.map((n) => [n.id, n]))
    const model = { nodes, relations: Object.fromEntries(data.relations.map((r) => [r.id, r])) }
    const measured = data.nodes.filter((n) => n.type === 'fitness-fn' && parseMeasure(n.measure).some((line) => SENSORS[line.sensor]))
    expect(measured.map((n) => n.label).sort()).toEqual(['Installable npm packages', 'Large model stays responsive', 'One mark everywhere', 'One product version', 'Workspace boundaries'])
    const mapped = (await readRepositoryMapping(ROOT)).implements
    const paths = (e) => elementPaths(mapped, e.id, (id) => nodes[id]?.parentId)
    const missing = measured.flatMap((ff) => appliedElements(model, ff)).filter((e) => !paths(e).length).map((e) => `${e.label} (${e.id})`)
    expect(missing).toEqual([])
    // The Desktop app and Studio are one workspace, built from different folders.
    const workspaces = (label) => workspacesOf({ paths: paths(data.nodes.find((n) => n.label === label && n.type !== 'domain')) })
    expect([workspaces('Desktop app'), workspaces('Studio'), workspaces('radical.tools')]).toEqual([['apps/studio'], ['apps/studio'], '*'])
  })

  it('fails for an element the repository gives no paths, naming it', () => {
    const context = JSON.stringify({ element: { id: 'nowhere', label: 'Billing API', type: 'container', paths: [] } })
    // The sensors that are this repository's scripts (an adapter's own
    // arguments say where it looks).
    for (const name of Object.keys(SENSORS).filter((n) => SENSORS[n].command)) {
      const [command, ...args] = SENSORS[name].command.split(' ')
      const run = spawnSync(command, [...args, '--context', context], { cwd: ROOT, encoding: 'utf8' })
      expect([name, run.status, run.stderr.trim()]).toEqual([name, 2, 'no paths for container "Billing API" (nowhere) in .radical/radical.json'])
    }
  })
})
