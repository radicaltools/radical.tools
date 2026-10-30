import { afterEach, describe, expect, it } from 'vitest'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { MD_MANIFEST_FILE } from '@radical/common/formats/mdFolder'
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

describe('radical sense', () => {
  it('appends what an adapter measured to .radical/measurements.json, judging nothing', async () => {
    const cwd = await workspace()
    // 912 ms is far over any sane threshold: the sensor still exits 0.
    const json = await run(cwd, 'sense', 'json', 'summary.json', '--metric', 'api.latency.p95=/metrics/http_req_duration/p(95)@ms', '--folder', 'model', '--label', 'env=staging', '--context', 'commit=abc123')
    expect(json).toMatchObject({ code: 0, out: 'api.latency.p95 912.5 ms\n' })
    const command = await run(cwd, 'sense', 'command', '--folder', 'model', '--name', 'workspaces', '--', process.execPath, '-e', 'process.exit(1)')
    expect(command.code).toBe(0)
    expect(command.out).toMatch(/^workspaces\.exit_code 1\nworkspaces\.duration [\d.]+ s\n$/)
    const store = JSON.parse(await readFile(join(cwd, 'model/.radical/measurements.json'), 'utf8'))
    expect(store.version).toBe(1)
    expect(store.measurements.map((m: { metric: string }) => m.metric)).toEqual(['api.latency.p95', 'workspaces.duration', 'workspaces.exit_code'])
    expect(store.measurements[0]).toMatchObject({ value: 912.5, unit: 'ms', labels: { env: 'staging' }, source: 'json', context: { commit: 'abc123' } })
    expect(Date.parse(store.measurements[0].at)).not.toBeNaN()
    expect(await readFile(join(cwd, 'model/.radical/.gitignore'), 'utf8')).toBe('*\n')
    // Measured again: the latest replaces it.
    await writeFile(join(cwd, 'summary.json'), JSON.stringify({ metrics: { http_req_duration: { 'p(95)': 240 } } }))
    await run(cwd, 'sense', 'json', 'summary.json', '--metric', 'api.latency.p95=/metrics/http_req_duration/p(95)@ms', '--folder', 'model', '--label', 'env=staging')
    const again = JSON.parse(await readFile(join(cwd, 'model/.radical/measurements.json'), 'utf8'))
    expect(again.measurements.filter((m: { metric: string }) => m.metric === 'api.latency.p95').map((m: { value: number }) => m.value)).toEqual([240])
    // --out writes a radical-metrics/1 file for another job instead.
    expect((await run(cwd, 'sense', 'json', 'summary.json', '--metric', 'a.b=metrics.http_req_duration.p(95)', '--out', 'out/m.json')).code).toBe(0)
    expect(JSON.parse(await readFile(join(cwd, 'out/m.json'), 'utf8'))).toMatchObject({ format: 'radical-metrics', version: 1, source: 'json', measurements: [{ metric: 'a.b', value: 240 }] })
  })

  it('exits 2 when it cannot measure', async () => {
    const cwd = await workspace()
    const unknown = await run(cwd, 'sense', 'lighthouse', 'report.json', '--folder', 'model')
    expect(unknown.code).toBe(2)
    expect(unknown.err).toContain('No sensor adapter lighthouse. The adapters: command, json.')
    const missing = await run(cwd, 'sense', 'json', 'gone.json', '--metric', 'a=b', '--folder', 'model')
    expect(missing.code).toBe(2)
    expect(missing.err).toContain('radical sense json: cannot read gone.json: no such file')
    const noNumber = await run(cwd, 'sense', 'json', 'summary.json', '--metric', 'a=metrics.nothing', '--folder', 'model')
    expect(noNumber.err).toContain('summary.json has no number at metrics.nothing')
    const noModel = await run(cwd, 'sense', 'json', 'summary.json', '--metric', 'a=metrics.http_req_duration.p(95)')
    expect(noModel.code).toBe(2)
    expect(noModel.err).toContain('is no model folder')
    expect((await run(cwd, 'sense', 'command', '--folder', 'model')).code).toBe(2)
    await expect(readFile(join(cwd, 'model/.radical/measurements.json'), 'utf8')).rejects.toThrow()
    const list = await run(cwd, 'sense', '--list')
    expect(list.out).toContain('command           runs a command')
  })
})
