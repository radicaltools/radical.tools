// Fitness function "Tracked violations fixed in time" and scenario "Overdue
// violation fails the night" (Accessibility pack): tools/a11y-deadlines.mjs
// over apps/e2e/a11y-known.json.
import { describe, expect, it } from 'vitest'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { deadlines, inPaths, main } from './a11y-deadlines.mjs'

const ROOT = join(import.meta.dirname, '..')
const entry = (over) => ({ front: 'apps/hub', state: 'Hub: landing', rule: 'color-contrast', issue: 'https://github.com/radicaltools/radical.tools/issues/1', found: '2026-11-24', due: '2026-12-24', ...over })

/** Runs main() on a list, collecting what it prints. */
function run(list, args = []) {
  const dir = mkdtempSync(join(tmpdir(), 'a11y-deadlines-'))
  const known = join(dir, 'known.json')
  writeFileSync(known, JSON.stringify(list))
  const out = { log: [], error: [] }
  const status = main(['--known', known, ...args], { log: (m) => out.log.push(m), error: (m) => out.error.push(m) })
  return { status, ...out, dir }
}

describe('tracked accessibility violations fixed in time', () => {
  it('passes the list in the repository today: every entry has an issue and is due within 30 days of being found', () => {
    const list = JSON.parse(readFileSync(join(ROOT, 'apps/e2e/a11y-known.json'), 'utf8'))
    const found = deadlines(list, { today: '2026-11-24', days: 30 })
    expect(found.counts).toMatchObject({ too_late: 0, no_issue: 0, invalid: 0 })
    for (const e of list) expect(Object.keys(e), JSON.stringify(e)).toEqual(expect.arrayContaining(['front', 'state', 'rule', 'issue', 'found', 'due']))
  })

  it('fails the night once a due date has passed, naming the violation and its issue', () => {
    const list = [entry({ state: 'Hub: catalogue', due: '2026-12-01', found: '2026-11-20' }), entry({ state: 'Hub: search' })]
    expect(run(list, ['--today', '2026-12-01']).status).toBe(0)
    const night = run(list, ['--today', '2026-12-02'])
    expect(night.status).toBe(1)
    expect(night.error.join('\n')).toContain('1 tracked accessibility violation past their due date')
    expect(night.error.join('\n')).toContain('Hub: catalogue: color-contrast (issue https://github.com/radicaltools/radical.tools/issues/1, found 2026-11-20, due 2026-12-01)')
    expect(night.error.join('\n')).not.toContain('Hub: search')
  })

  it('fails an entry due more than FIX_DAYS after it was found, one without an issue, and one without dates', () => {
    const found = deadlines([
      entry({ due: '2026-12-25' }),
      entry({ issue: '' }),
      entry({ issue: undefined }),
      entry({ due: 'soon' }),
      entry({ issue: 'to be filed' }),
      entry({ issue: '#12' }),
    ], { today: '2026-11-24', days: 30 })
    expect(found.counts).toEqual({ open: 6, overdue: 0, too_late: 1, no_issue: 2, invalid: 1, unfiled: 1 })
    expect(run([entry({ issue: ' ' })], ['--today', '2026-11-24']).status).toBe(1)
  })

  it('as the sensor a11y-deadlines, reads the element\'s front end only and writes radical-metrics/1', () => {
    const list = [entry({ due: '2026-11-01', found: '2026-10-20' }), entry({ front: 'apps/web', state: 'Site: /' })]
    const dir = mkdtempSync(join(tmpdir(), 'a11y-deadlines-'))
    const metricsOut = join(dir, 'out.json')
    const context = (paths) => JSON.stringify({ element: { id: 'web', label: 'Website and manual', type: 'webapp', paths }, metricsOut })
    const site = run(list, ['--today', '2026-11-24', '--context', context(['apps/web'])])
    expect(site.status).toBe(0)
    const metrics = JSON.parse(readFileSync(metricsOut, 'utf8'))
    expect(metrics).toMatchObject({ format: 'radical-metrics', version: 1 })
    expect(Object.fromEntries(metrics.measurements.map((m) => [m.metric, m.value]))).toEqual({
      'a11y.known.open': 1, 'a11y.known.overdue': 0, 'a11y.known.too_late': 0, 'a11y.known.no_issue': 0, 'a11y.known.invalid': 0, 'a11y.known.unfiled': 0,
    })
    expect(run(list, ['--today', '2026-11-24', '--context', context(['apps/hub'])]).status).toBe(1)
    // Studio is built from a folder inside apps/studio.
    expect(inPaths('apps/studio', ['apps/studio/src/renderer'])).toBe(true)
    expect(inPaths('apps/studio', ['apps/studio-old'])).toBe(false)
  })

  it('runs from the command line as radical sense run starts it', () => {
    const ok = spawnSync(process.execPath, ['tools/a11y-deadlines.mjs', '--today', '2026-11-24'], { cwd: ROOT, encoding: 'utf8' })
    expect([ok.status, ok.stderr]).toEqual([0, ''])
    expect(ok.stdout).toMatch(/tracked accessibility violations?, none overdue/)
  })
})
