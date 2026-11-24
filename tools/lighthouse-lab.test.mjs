// The sensor lighthouse-lab: which front end an element is, what it serves
// and measures, and how Lighthouse CI is asked to measure it.
import { describe, expect, it } from 'vitest'
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DEVICES, FRONT_ENDS, RUNS, collectArgs, frontEndsFor, readArgs, summary } from './lighthouse-lab.mjs'

const ROOT = join(import.meta.dirname, '..')

describe('lighthouse-lab', () => {
  it('reads the device the measure line names, and the context radical sense run gives', () => {
    expect(readArgs(['mobile'])).toEqual({ device: 'mobile', context: null, fronts: [], runs: RUNS, out: null })
    expect(readArgs(['desktop', '--context', '{"metricsOut":"m.json"}', '--runs', '1']))
      .toEqual({ device: 'desktop', context: { metricsOut: 'm.json' }, fronts: [], runs: 1, out: null })
    expect(readArgs(['mobile', '--front', 'apps/hub', '--front', 'apps/web', '--out', 'x']).fronts).toEqual(['apps/hub', 'apps/web'])
    expect(() => readArgs([])).toThrow('name the device: mobile or desktop (got none)')
    expect(() => readArgs(['tablet'])).toThrow('name the device')
    expect(() => readArgs(['mobile', 'desktop'])).toThrow('one device, not mobile and desktop')
    expect(() => readArgs(['mobile', '--runs', '0'])).toThrow('--runs')
    expect(() => readArgs(['mobile', '--fast'])).toThrow('unknown option --fast')
    expect(DEVICES).toEqual(['mobile', 'desktop'])
  })

  it('measures the front end of the element\'s workspace, and refuses a workspace that is none', () => {
    expect(frontEndsFor(['apps/hub']).map((f) => f.dir)).toEqual(['apps/hub/out'])
    expect(frontEndsFor(['apps/studio']).map((f) => f.dir)).toEqual(['apps/studio/out/renderer'])
    expect(frontEndsFor('*').map((f) => f.workspace)).toEqual(['apps/web', 'apps/hub', 'apps/studio'])
    expect(frontEndsFor([]).length).toBe(3)
    expect(() => frontEndsFor(['apps/cli'])).toThrow('apps/cli is no web front end')
  })

  it('serves each front end from where its build is, and measures pages that are there', () => {
    // The site is served as it is in git; the others where their build writes.
    for (const page of FRONT_ENDS['apps/web'].pages) expect(existsSync(join(ROOT, 'apps/web', page === '/' ? 'index.html' : page)), page).toBe(true)
    expect(FRONT_ENDS['apps/hub'].build).toBe('npm run build:hub')
    expect(FRONT_ENDS['apps/studio'].build).toBe('npm run build:web')
  })

  it('asks Lighthouse CI for three runs a page, on its own static server, with the desktop preset only for desktops', () => {
    const web = frontEndsFor(['apps/web'])[0]
    const mobile = collectArgs(web, 'mobile')
    expect(mobile).toEqual([
      'collect',
      `--staticDistDir=${join(ROOT, 'apps/web')}`,
      '--url=http://localhost/',
      '--url=http://localhost/manual.html',
      '--numberOfRuns=3',
      '--settings.chromeFlags=--no-sandbox --disable-dev-shm-usage',
    ])
    expect(collectArgs(web, 'desktop')).toEqual([...mobile, '--settings.preset=desktop'])
    expect(collectArgs(web, 'mobile', 1)).toContain('--numberOfRuns=1')
  })

  it('prints the worst page\'s values of what it measured', () => {
    const dir = mkdtempSync(join(tmpdir(), 'lighthouse-lab-test-'))
    try {
      const file = join(dir, 'm.json')
      writeFileSync(file, JSON.stringify({ format: 'radical-metrics', version: 1, source: 'lighthouse', at: '2026-11-24T00:00:00Z', measurements: [
        { metric: 'web.lab.lcp', value: 2000, unit: 'ms', labels: { page: '/', device: 'mobile' } },
        { metric: 'web.lab.lcp.max', value: 2000, unit: 'ms', labels: { device: 'mobile' } },
        { metric: 'web.lab.score.min', value: 61, labels: { device: 'mobile', category: 'performance' } },
      ] }))
      expect(summary(file)).toBe('  web.lab.lcp.max{device=mobile} = 2000 ms\n  web.lab.score.min{device=mobile,category=performance} = 61')
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
