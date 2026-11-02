import { afterEach, describe, expect, it } from 'vitest'
import { mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import type { C4Node, C4Relation } from '@radical/common/c4'
import { MD_MANIFEST_FILE, serializeToMdFolder } from '@radical/common/formats/mdFolder'
import { builtInGovernanceMetamodel } from '@radical/common/metamodel'
import { main } from './cli'

const dirs: string[] = []
afterEach(async () => { await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true }))) })

/** A working directory with a model folder `model/` (only its manifest:
 *  radical sense reads no model) and a k6-like summary. */
async function workspace(): Promise<string> {
  const cwd = await mkdtemp(join(tmpdir(), 'radical-sense-'))
  dirs.push(cwd)
  await mkdir(join(cwd, 'model'))
  await writeFile(join(cwd, 'model', MD_MANIFEST_FILE), '---\nradicalFormat: md-folder\nversion: 1\n---\n')
  await writeFile(join(cwd, 'summary.json'), JSON.stringify({ metrics: { http_req_duration: { 'p(95)': 912.5 } } }))
  return cwd
}

async function run(cwd: string, ...args: string[]): Promise<{ code: number; out: string; err: string }> {
  let out = ''
  let err = ''
  const code = await main(args, { cwd, out: (t) => { out += t + '\n' }, err: (t) => { err += t + '\n' } })
  return { code, out, err }
}

const fitness = (id: string, label: string, props: Record<string, unknown>): C4Node =>
  ({ id, type: 'fitness-fn', label, x: 0, y: 0, width: 180, height: 52, collapsed: false, ...props }) as unknown as C4Node

/** A working directory with a model folder `model/` holding `nodes`. */
async function modelWith(nodes: C4Node[], relations: C4Relation[] = []): Promise<string> {
  const cwd = await mkdtemp(join(tmpdir(), 'radical-sense-run-'))
  dirs.push(cwd)
  const files = serializeToMdFolder({ metamodel: builtInGovernanceMetamodel(), nodes, relations }, 'Test')
  for (const [path, content] of Object.entries(files)) {
    await mkdir(dirname(join(cwd, 'model', path)), { recursive: true })
    await writeFile(join(cwd, 'model', path), content)
  }
  return cwd
}

describe('radical sense', () => {
  it('runs the measure of every automated fitness function triggered on the event, and says what it could not measure', async () => {
    const node = JSON.stringify(process.execPath)
    const cwd = await modelWith([
      fitness('night', 'Night check', {
        cadence: 'triggered', trigger: 'nightly', invocation: 'automated',
        measure: `command --name ok -- ${node} -e "process.exit(0)"\ncommand --name fails -- ${node} -e "process.exit(3)"\nlighthouse report.json`,
      }),
      fitness('gate', 'Gate check', { cadence: 'triggered', trigger: 'pull-request', invocation: 'automated', measure: 'command --name gate -- node -v' }),
      fitness('person', 'Person check', { cadence: 'triggered', trigger: 'nightly', invocation: 'manual', measure: 'command --name manual -- node -v' }),
    ])
    const result = await run(cwd, 'sense', 'run', '--trigger', 'nightly', '--folder', 'model', '--out', 'metrics', '--context', 'commit=abc')
    // The lighthouse line names no sensor: the run says so and exits 2.
    expect(result.code).toBe(2)
    expect(result.err).toContain('Night check: cannot measure "lighthouse report.json": no sensor lighthouse,')
    expect(result.out).toContain('Night check: measured "command --name ok')
    const ok = JSON.parse(await readFile(join(cwd, 'metrics/night-check-1.json'), 'utf8'))
    expect(ok).toMatchObject({ source: 'command', context: { commit: 'abc' } })
    expect(ok.measurements.find((m: { metric: string }) => m.metric === 'ok.exit_code').value).toBe(0)
    // A command that fails is measured: its exit code is the value.
    const fails = JSON.parse(await readFile(join(cwd, 'metrics/night-check-2.json'), 'utf8'))
    expect(fails.measurements.find((m: { metric: string }) => m.metric === 'fails.exit_code').value).toBe(3)
    // Neither the pull-request one nor the manual one ran.
    await expect(readFile(join(cwd, 'metrics/gate-check.json'), 'utf8')).rejects.toThrow()
    await expect(readFile(join(cwd, 'metrics/person-check.json'), 'utf8')).rejects.toThrow()
    expect((await run(cwd, 'sense', 'run', '--trigger', 'weekly', '--folder', 'model', '--out', 'metrics')).out).toContain('No automated fitness function triggered on weekly has a measure.')
  })

  it('records a review in the repository\'s .radical/reviews.json, kept in git', async () => {
    const cwd = await workspace()
    const at = new Date('2026-10-30T10:00:00Z')
    const main1 = await main(['sense', 'review', 'Security review', '--passed', '--by', 'tzajac', '--note', 'threat model of the release', '--folder', 'model'], { cwd, out: () => {}, err: () => {} })
    expect(main1).toBe(0)
    const { senseCommand } = await import('./sense')
    expect(await senseCommand(['review', 'Security review', '--failed', '--by', 'auditor', '--folder', 'model'], { cwd, out: () => {}, err: () => {} }, () => at)).toBe(0)
    // The workspace holds no repository: the folder that holds the model is its root.
    const file = JSON.parse(await readFile(join(cwd, '.radical/reviews.json'), 'utf8'))
    expect(file).toMatchObject({ format: 'radical-reviews', version: 1 })
    expect(file.reviews.map((r: { result: string; by: string }) => [r.result, r.by])).toEqual([['passed', 'tzajac'], ['failed', 'auditor']])
    expect(file.reviews[0].note).toBe('threat model of the release')
    expect(file.reviews[1].at).toBe(at.toISOString())
    // Not in .state/, which git ignores.
    await expect(readFile(join(cwd, 'model/.state/measurements.json'), 'utf8')).rejects.toThrow()
    const wrong = await run(cwd, 'sense', 'review', 'Security review', '--passed', '--folder', 'model')
    expect(wrong.code).toBe(2)
    expect(wrong.err).toContain('needs the name of what was reviewed, one of --passed and --failed, and --by')
  })

  it('appends what an adapter measured to .state/measurements.json, judging nothing', async () => {
    const cwd = await workspace()
    // 912 ms is far over any sane threshold: the sensor still exits 0.
    const json = await run(cwd, 'sense', 'json', 'summary.json', '--metric', 'api.latency.p95=/metrics/http_req_duration/p(95)@ms', '--folder', 'model', '--label', 'env=staging', '--context', 'commit=abc123')
    expect(json).toMatchObject({ code: 0, out: 'api.latency.p95 912.5 ms\n' })
    const command = await run(cwd, 'sense', 'command', '--folder', 'model', '--name', 'workspaces', '--', process.execPath, '-e', 'process.exit(1)')
    expect(command.code).toBe(0)
    expect(command.out).toMatch(/^workspaces\.exit_code 1\nworkspaces\.duration [\d.]+ s\n$/)
    const store = JSON.parse(await readFile(join(cwd, 'model/.state/measurements.json'), 'utf8'))
    expect(store.version).toBe(1)
    expect(store.measurements.map((m: { metric: string }) => m.metric)).toEqual(['api.latency.p95', 'workspaces.duration', 'workspaces.exit_code'])
    expect(store.measurements[0]).toMatchObject({ value: 912.5, unit: 'ms', labels: { env: 'staging' }, source: 'json', context: { commit: 'abc123' } })
    expect(Date.parse(store.measurements[0].at)).not.toBeNaN()
    expect(await readFile(join(cwd, 'model/.state/.gitignore'), 'utf8')).toBe('*\n')
    // Measured again: the latest replaces it.
    await writeFile(join(cwd, 'summary.json'), JSON.stringify({ metrics: { http_req_duration: { 'p(95)': 240 } } }))
    await run(cwd, 'sense', 'json', 'summary.json', '--metric', 'api.latency.p95=/metrics/http_req_duration/p(95)@ms', '--folder', 'model', '--label', 'env=staging')
    const again = JSON.parse(await readFile(join(cwd, 'model/.state/measurements.json'), 'utf8'))
    expect(again.measurements.filter((m: { metric: string }) => m.metric === 'api.latency.p95').map((m: { value: number }) => m.value)).toEqual([240])
    // --out writes a radical-metrics/1 file for another job instead.
    expect((await run(cwd, 'sense', 'json', 'summary.json', '--metric', 'a.b=metrics.http_req_duration.p(95)', '--out', 'out/m.json')).code).toBe(0)
    expect(JSON.parse(await readFile(join(cwd, 'out/m.json'), 'utf8'))).toMatchObject({ format: 'radical-metrics', version: 1, source: 'json', measurements: [{ metric: 'a.b', value: 240 }] })
  })

  it('exits 2 when it cannot measure', async () => {
    const cwd = await workspace()
    const unknown = await run(cwd, 'sense', 'lighthouse', 'report.json', '--folder', 'model')
    expect(unknown.code).toBe(2)
    expect(unknown.err).toContain('No sensor adapter lighthouse. The adapters: command, json, playwright.')
    const missing = await run(cwd, 'sense', 'json', 'gone.json', '--metric', 'a=b', '--folder', 'model')
    expect(missing.code).toBe(2)
    expect(missing.err).toContain('radical sense json: cannot read gone.json: no such file')
    const noNumber = await run(cwd, 'sense', 'json', 'summary.json', '--metric', 'a=metrics.nothing', '--folder', 'model')
    expect(noNumber.err).toContain('summary.json has no number at metrics.nothing')
    const noModel = await run(cwd, 'sense', 'json', 'summary.json', '--metric', 'a=metrics.http_req_duration.p(95)')
    expect(noModel.code).toBe(2)
    expect(noModel.err).toContain('is no model folder')
    expect((await run(cwd, 'sense', 'command', '--folder', 'model')).code).toBe(2)
    await expect(readFile(join(cwd, 'model/.state/measurements.json'), 'utf8')).rejects.toThrow()
    const list = await run(cwd, 'sense', '--list')
    expect(list.out).toContain('command           runs a command')
  })
})

const element = (id: string, type: string, label: string, props: Record<string, unknown> = {}): C4Node =>
  ({ id, type, label, x: 0, y: 0, width: 180, height: 52, collapsed: false, ...props }) as unknown as C4Node
const relation = (id: string, relationType: string, sourceId: string, targetId: string): C4Relation => ({ id, relationType, sourceId, targetId })

/** A model whose ADR constrains two of the three containers of a system,
 *  with a fitness function measured by the repository's sensor `openapi`,
 *  in a repository (a .git) whose .radical/sensors/sensors.json has `sensors`. */
async function repository(sensors: Record<string, unknown>, measure = 'openapi --strict'): Promise<string> {
  const cwd = await modelWith([
    element('pay', 'system', 'Payments'),
    element('pay-api', 'container', 'Payments API', { parentId: 'pay', technology: 'Node' }),
    element('refund-api', 'container', 'Refunds API', { parentId: 'pay' }),
    element('worker', 'container', 'Ledger worker', { parentId: 'pay' }),
    element('adr', 'adr', 'APIs are described in OpenAPI', { status: 'accepted', date: '2026-11-02', context: 'c', decision: 'd', consequences: 'q' }),
    fitness('ff', 'APIs described in OpenAPI', { cadence: 'triggered', trigger: 'pull-request', invocation: 'automated', measure, metrics: 'openapi.exit_code == 0' }),
  ], [relation('i', 'implements', 'ff', 'adr'), relation('c1', 'constrains', 'adr', 'pay-api'), relation('c2', 'constrains', 'adr', 'refund-api')])
  await mkdir(join(cwd, '.git'))
  await mkdir(join(cwd, '.radical', 'sensors'), { recursive: true })
  await writeFile(join(cwd, '.radical', 'sensors', 'sensors.json'), JSON.stringify({ sensors }))
  return cwd
}

describe('radical sense run', () => {
  it('runs a sensor of radical.sensors.json once per element its decision constrains, with the context', async () => {
    // The sensor keeps its arguments, fails for the Refunds API and writes a
    // measurement of its own to metricsOut for the Payments API.
    const script = `const fs = require('fs'); const i = process.argv.indexOf('--context'); const c = JSON.parse(process.argv[i + 1]);
      fs.writeFileSync('seen-' + c.element.id + '.json', JSON.stringify({ args: process.argv.slice(1, i), context: c }));
      if (c.element.id === 'pay-api') fs.writeFileSync(c.metricsOut, JSON.stringify({ format: 'radical-metrics', version: 1, source: 'x', at: new Date().toISOString(), measurements: [{ metric: 'openapi.operations', value: 12 }] }));
      process.exit(c.element.id === 'refund-api' ? 1 : 0)`
    const cwd = await repository({ openapi: { command: [process.execPath, '-e', script, '--'] } })
    const result = await run(cwd, 'sense', 'run', '--trigger', 'pull-request', '--folder', 'model', '--out', 'metrics')
    expect(result.err).toBe('')
    expect(result.code).toBe(0)
    expect(result.out).toContain('APIs described in OpenAPI: measured "openapi --strict" for Payments API into')

    const seen = JSON.parse(await readFile(join(cwd, 'seen-pay-api.json'), 'utf8'))
    expect(seen.args).toEqual(['--strict'])
    expect(seen.context).toMatchObject({
      fitnessFunction: { id: 'ff', label: 'APIs described in OpenAPI', model: 'model', properties: { measure: 'openapi --strict', trigger: 'pull-request' } },
      adr: { id: 'adr', label: 'APIs are described in OpenAPI', model: 'model' },
      element: { id: 'pay-api', label: 'Payments API', type: 'container', technology: 'Node', parent: { id: 'pay', label: 'Payments', type: 'system' } },
    })
    // Only the elements the ADR constrains.
    await expect(readFile(join(cwd, 'seen-worker.json'), 'utf8')).rejects.toThrow()

    const measured = async (file: string) => JSON.parse(await readFile(join(cwd, 'metrics', file), 'utf8')).measurements
      .map((m: { metric: string; value: number; labels?: Record<string, string> }) => [m.metric, m.value, m.labels])
    expect((await measured('apis-described-in-openapi-refunds-api.json'))[0]).toEqual(['openapi.exit_code', 1, { element: 'refund-api' }])
    expect((await measured('apis-described-in-openapi-payments-api.json'))[0]).toEqual(['openapi.exit_code', 0, { element: 'pay-api' }])
    expect(await measured('apis-described-in-openapi-payments-api.sensor.json')).toEqual([['openapi.operations', 12, { element: 'pay-api' }]])

    // radical check judges the fitness function on each element.
    await run(cwd, 'check', 'model', '--metrics', 'metrics', '--evidence', 'evidence.json')
    const ev = JSON.parse(await readFile(join(cwd, 'evidence.json'), 'utf8')).nodes
    expect(ev.ff.elements.map((e: { id: string; status: string }) => [e.id, e.status])).toEqual([['pay-api', 'passed'], ['refund-api', 'failed']])
    expect(ev.adr.status).toBe('broken')
  })

  it('names a sensor neither built in nor in radical.sensors.json', async () => {
    const cwd = await repository({ other: { command: 'node -v' } }, 'openapi')
    const result = await run(cwd, 'sense', 'run', '--trigger', 'pull-request', '--folder', 'model', '--out', 'metrics')
    expect(result.code).toBe(2)
    expect(result.err).toContain(`APIs described in OpenAPI: cannot measure "openapi": no sensor openapi, neither an adapter (radical sense --list) nor in ${join(cwd, '.radical', 'sensors', 'sensors.json')}.`)
  })

  it('gives a repository\'s sensor the element\'s paths from .radical/radical.json', async () => {
    const script = `const fs = require('fs'); const c = JSON.parse(process.argv[process.argv.indexOf('--context') + 1]);
      fs.writeFileSync('paths-' + c.element.id + '.json', JSON.stringify(c.element.paths))`
    const cwd = await repository({ openapi: { command: [process.execPath, '-e', script, '--'] } })
    // The system is built from the root, the Payments API in apps/api; the
    // Refunds API has no entry, so it is built where its system is.
    await writeFile(join(cwd, '.radical', 'radical.json'), JSON.stringify({ implements: [
      { element: 'pay', name: 'Payments', paths: ['.'] },
      { element: 'pay-api', name: 'Payments API', paths: ['apps/api'] },
    ] }))
    const result = await run(cwd, 'sense', 'run', '--trigger', 'pull-request', '--folder', 'model', '--out', 'metrics')
    expect(result.err).toBe('')
    expect(JSON.parse(await readFile(join(cwd, 'paths-pay-api.json'), 'utf8'))).toEqual(['apps/api'])
    expect(JSON.parse(await readFile(join(cwd, 'paths-refund-api.json'), 'utf8'))).toEqual(['.'])
  })

  it('runs a repository\'s sensor that names an adapter with its arguments, for each element', async () => {
    const cwd = await repository({ figures: { adapter: 'json', args: ['figures.json', '--metric', 'openapi.operations=ops'] } }, 'figures')
    await writeFile(join(cwd, 'figures.json'), JSON.stringify({ ops: 12 }))
    const result = await run(cwd, 'sense', 'run', '--trigger', 'pull-request', '--folder', 'model', '--out', 'metrics')
    expect(result.err).toBe('')
    expect(result.code).toBe(0)
    const measured = JSON.parse(await readFile(join(cwd, 'metrics', 'apis-described-in-openapi-refunds-api.json'), 'utf8'))
    expect(measured).toMatchObject({ source: 'json', measurements: [{ metric: 'openapi.operations', value: 12, labels: { element: 'refund-api' } }] })
  })

  it('runs a repository\'s sensor from the repository\'s root, its file in .radical/sensors/', async () => {
    // A script beside sensors.json, named from the root, that says where it ran.
    const cwd = await repository({ openapi: { command: 'node .radical/sensors/where.mjs' } })
    await writeFile(join(cwd, '.radical', 'sensors', 'where.mjs'), "import { writeFileSync } from 'node:fs'\nwriteFileSync('ran-in.txt', process.cwd())\n")
    await mkdir(join(cwd, 'apps', 'web'), { recursive: true })
    const result = await run(join(cwd, 'apps', 'web'), 'sense', 'run', '--trigger', 'pull-request', '--folder', '../../model', '--out', 'metrics')
    expect(result.err).toBe('')
    expect(result.code).toBe(0)
    expect(await realpath(await readFile(join(cwd, 'ran-in.txt'), 'utf8'))).toBe(await realpath(cwd))
  })
})
