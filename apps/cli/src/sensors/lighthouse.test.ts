import { afterEach, describe, expect, it } from 'vitest'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { lighthouseAdapter } from './lighthouse'
import type { SensorValue } from './types'

const dirs: string[] = []
afterEach(async () => { await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true }))) })

async function folder(files: Record<string, string>): Promise<string> {
  const cwd = await mkdtemp(join(tmpdir(), 'radical-lighthouse-'))
  dirs.push(cwd)
  for (const [path, content] of Object.entries(files)) {
    await mkdir(dirname(join(cwd, path)), { recursive: true })
    await writeFile(join(cwd, path), content)
  }
  return cwd
}

const measure = (cwd: string, args: string[] = []) => lighthouseAdapter.measure({ args, options: {}, cwd })

function value(values: SensorValue[], metric: string, labels: Record<string, string>): SensorValue | undefined {
  return values.find((v) => v.metric === metric && JSON.stringify(v.labels) === JSON.stringify(labels))
}

/** A timespan report of a user flow's interactions: TBT, CLS and INP only. */
const timespan = (inp: number) => JSON.stringify({
  lighthouseVersion: '12.2.1',
  gatherMode: 'timespan',
  requestedUrl: 'https://example.com/pricing',
  finalDisplayedUrl: 'https://example.com/pricing',
  configSettings: { formFactor: 'mobile' },
  audits: {
    'total-blocking-time': { id: 'total-blocking-time', score: 1, scoreDisplayMode: 'numeric', numericValue: 70, numericUnit: 'millisecond' },
    'cumulative-layout-shift': { id: 'cumulative-layout-shift', score: 1, scoreDisplayMode: 'numeric', numericValue: 0, numericUnit: 'unitless' },
    'interaction-to-next-paint': { id: 'interaction-to-next-paint', score: 0.9, scoreDisplayMode: 'numeric', numericValue: inp, numericUnit: 'millisecond' },
  },
  categories: { performance: { id: 'performance', score: 0.9 } },
})

describe('Lighthouse reports measured', () => {
  it('measures the median of three mobile runs of one page, and the desktop run apart', async () => {
    const values = await measure(await folder(lighthouseAdapter.fixture.files!))
    const home = { page: '/', device: 'mobile' }
    expect(value(values, 'web.lab.lcp', home)).toEqual({ metric: 'web.lab.lcp', value: 2800, unit: 'ms', labels: home })
    expect(value(values, 'web.lab.fcp', home)?.value).toBe(1600)
    expect(value(values, 'web.lab.tbt', home)?.value).toBe(220)
    expect(value(values, 'web.lab.speed_index', home)?.value).toBe(3300)
    expect(value(values, 'web.lab.cls', home)).toEqual({ metric: 'web.lab.cls', value: 0.03, labels: home })
    expect(value(values, 'web.lab.bytes', home)).toEqual({ metric: 'web.lab.bytes', value: 825_000, unit: 'B', labels: home })
    expect(value(values, 'web.lab.script_bytes', home)?.value).toBe(311_000)
    expect(value(values, 'web.lab.score', { ...home, category: 'performance' })?.value).toBe(82)
    expect(value(values, 'web.lab.score', { ...home, category: 'best-practices' })?.value).toBe(100)
    expect(value(values, 'web.lab.lcp', { page: '/', device: 'desktop' })?.value).toBe(900)
    // A navigation report has no INP.
    expect(values.some((v) => v.metric.startsWith('web.lab.inp'))).toBe(false)
  })

  it('labels a page by the path and query of its final URL', async () => {
    const values = await measure(await folder(lighthouseAdapter.fixture.files!))
    expect([...new Set(values.map((v) => v.labels?.page).filter(Boolean))].sort()).toEqual(['/', '/pricing?plan=team'])
  })

  it('states the worst page of each device: .max of each metric, .min of each score', async () => {
    const values = await measure(await folder(lighthouseAdapter.fixture.files!))
    expect(value(values, 'web.lab.lcp.max', { device: 'mobile' })).toEqual({ metric: 'web.lab.lcp.max', value: 3500, unit: 'ms', labels: { device: 'mobile' } })
    expect(value(values, 'web.lab.tbt.max', { device: 'mobile' })?.value).toBe(220)
    expect(value(values, 'web.lab.cls.max', { device: 'mobile' })?.value).toBe(0.12)
    expect(value(values, 'web.lab.bytes.max', { device: 'mobile' })?.value).toBe(1_240_000)
    expect(value(values, 'web.lab.lcp.max', { device: 'desktop' })?.value).toBe(900)
    expect(value(values, 'web.lab.score.min', { device: 'mobile', category: 'performance' })?.value).toBe(74)
    expect(value(values, 'web.lab.score.min', { device: 'mobile', category: 'seo' })?.value).toBe(92)
    expect(value(values, 'web.lab.score.min', { device: 'desktop', category: 'performance' })?.value).toBe(99)
  })

  it('measures INP from a timespan report, the median of its runs', async () => {
    const cwd = await folder({ 'flow/a.json': timespan(180), 'flow/b.json': timespan(240), 'flow/c.json': timespan(320) })
    const values = await measure(cwd, ['flow'])
    expect(value(values, 'web.lab.inp', { page: '/pricing', device: 'mobile' })).toEqual({ metric: 'web.lab.inp', value: 240, unit: 'ms', labels: { page: '/pricing', device: 'mobile' } })
    expect(value(values, 'web.lab.inp.max', { device: 'mobile' })?.value).toBe(240)
    expect(values.some((v) => v.metric === 'web.lab.lcp')).toBe(false)
  })

  it('reads the steps of a user flow result and a report named as a file', async () => {
    const cwd = await folder({ 'flow.json': JSON.stringify({ name: 'Checkout', steps: [{ name: 'Choose a plan', lhr: JSON.parse(timespan(200)) }] }) })
    expect(value(await measure(cwd, ['flow.json']), 'web.lab.inp', { page: '/pricing', device: 'mobile' })?.value).toBe(200)
  })

  it('leaves out Lighthouse CI\'s manifest and other JSON of a directory', async () => {
    const files = { ...lighthouseAdapter.fixture.files!, '.lighthouseci/links.json': JSON.stringify({ 'https://example.com/': 'https://storage.googleapis.com/x' }) }
    const values = await measure(await folder(files))
    expect(values.length).toBeGreaterThan(0)
  })

  it('fails with a clear message when no report is found or a file is no JSON', async () => {
    await expect(measure(await folder({}))).rejects.toThrow(/cannot read \.lighthouseci: no such file or directory/)
    await expect(measure(await folder({ 'out/manifest.json': '[]' }), ['out'])).rejects.toThrow('no Lighthouse report in out')
    await expect(measure(await folder({ 'report.json': '{"lighthouseVersion": ' }), ['report.json'])).rejects.toThrow(/report\.json is no JSON/)
    await expect(measure(await folder({ 'other.json': '{"a": 1}' }), ['other.json'])).rejects.toThrow('other.json is no Lighthouse report')
  })
})
