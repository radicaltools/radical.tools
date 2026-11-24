import { afterEach, describe, expect, it } from 'vitest'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { builtInGovernanceMetamodel } from '@radical/common/metamodel'
import { serializeToMdFolder } from '@radical/common/formats/mdFolder'
import type { C4Node, DiagramData } from '@radical/common/c4'
import { main } from './cli'

// Scenario Regression refused (requirement No lab regression, Mobile and
// perceived performance pack): Lighthouse's reports of a front end, read by
// radical sense lighthouse as the night's sensor lighthouse-lab reads them,
// judged by radical check against the median of the earlier nights, with
// the conditions of the fitness function No lab regression on phones.

const dirs: string[] = []
afterEach(async () => { await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true }))) })

const node = (id: string, type: string, label: string, props: Record<string, unknown> = {}): C4Node =>
  ({ id, type, label, x: 0, y: 0, width: 200, height: 100, collapsed: false, ...props }) as C4Node

const PHONES = `web.lab.lcp.max{device=mobile} <= baseline + 10%
web.lab.cls.max{device=mobile} <= baseline + 10%
web.lab.tbt.max{device=mobile} <= baseline + 10%`

/** A model whose ADR constrains the Hub, and its fitness function (measured
 *  in radical.tools by the repository's sensor lighthouse-lab-mobile, which
 *  ends in radical sense lighthouse; here by that adapter). */
async function workspace(): Promise<string> {
  const cwd = await mkdtemp(join(tmpdir(), 'radical-lab-'))
  dirs.push(cwd)
  const data: DiagramData = {
    metamodel: builtInGovernanceMetamodel(),
    nodes: [
      node('sys', 'system', 'radical.tools'),
      node('hub', 'container', 'Architecture Hub', { parentId: 'sys' }),
      node('adr', 'adr', 'Pages held to the Core Web Vitals', { status: 'accepted', date: '2026-11-24', context: 'c', decision: 'd', consequences: 'q' }),
      node('ff', 'fitness-fn', 'No lab regression on phones', { characteristic: 'performance-efficiency', scope: 'atomic', cadence: 'triggered', trigger: 'nightly', invocation: 'automated', measure: 'lighthouse', metrics: PHONES }),
    ],
    relations: [
      { id: 'i', relationType: 'implements', sourceId: 'ff', targetId: 'adr' },
      { id: 'c', relationType: 'constrains', sourceId: 'adr', targetId: 'hub' },
    ],
  } as unknown as DiagramData
  for (const [path, content] of Object.entries(serializeToMdFolder(data, 'Test'))) {
    await mkdir(dirname(join(cwd, 'model', path)), { recursive: true })
    await writeFile(join(cwd, 'model', path), content)
  }
  return cwd
}

async function run(cwd: string, ...args: string[]): Promise<{ code: number; out: string; err: string }> {
  let out = ''
  let err = ''
  const code = await main(args, { cwd, out: (t) => { out += t + '\n' }, err: (t) => { err += t + '\n' } })
  return { code, out, err }
}

/** One night's Lighthouse CI output: three mobile runs of the Hub's page. */
async function night(cwd: string, name: string, lcp: number[]): Promise<string> {
  const dir = join(cwd, name)
  await mkdir(dir, { recursive: true })
  for (const [i, value] of lcp.entries()) {
    await writeFile(join(dir, `lhr-${i}.json`), JSON.stringify({
      lighthouseVersion: '12.6.1',
      requestedUrl: 'http://localhost:4173/',
      finalDisplayedUrl: 'http://localhost:4173/',
      configSettings: { formFactor: 'mobile' },
      audits: {
        'largest-contentful-paint': { numericValue: value },
        'cumulative-layout-shift': { numericValue: 0.02 },
        'total-blocking-time': { numericValue: 120 },
      },
    }))
  }
  return dir
}

/** The night's measurements of `lcp` runs, as lighthouse-lab hands them on. */
async function measure(cwd: string, name: string, lcp: number[], out: string): Promise<void> {
  const reports = await night(cwd, name, lcp)
  const sensed = await run(cwd, 'sense', 'lighthouse', reports, '--out', out, '--label', 'element=hub')
  expect(sensed.err).toBe('')
  expect(sensed.code).toBe(0)
}

describe('Regression refused', () => {
  it('fails the LCP condition when a main page is 25% slower than the steady 3800 ms of the earlier nights', async () => {
    const cwd = await workspace()
    await mkdir(join(cwd, 'history'))
    for (const n of [1, 2, 3]) await measure(cwd, `night-${n}`, [3790, 3800, 3810], `history/night-${n}.json`)
    // 25% slower: 4750 ms, beyond 3800 + 10% = 4180 ms.
    await measure(cwd, 'tonight', [4740, 4750, 4760], 'tonight.json')
    const checked = await run(cwd, 'check', 'model', '--metrics', 'tonight.json', '--baseline', 'history')
    expect(checked.code).toBe(1)
    expect(checked.out).toContain('web.lab.lcp.max{device=mobile} <= baseline + 10% does not hold (4750 ms from lighthouse')
    expect(checked.out).toContain('baseline 3800 ms, the median of 3; limit 4180 ms for container "Architecture Hub"')
    // CLS and TBT stayed where they were: only LCP is refused.
    expect(checked.out).not.toMatch(/web\.lab\.(cls|tbt)\.max\{device=mobile\} <= baseline \+ 10% does not hold/)
  })

  it('lets a page within 10% of the earlier nights pass', async () => {
    const cwd = await workspace()
    await mkdir(join(cwd, 'history'))
    for (const n of [1, 2, 3]) await measure(cwd, `night-${n}`, [3790, 3800, 3810], `history/night-${n}.json`)
    await measure(cwd, 'tonight', [4100, 4150, 4170], 'tonight.json')
    const checked = await run(cwd, 'check', 'model', '--metrics', 'tonight.json', '--baseline', 'history')
    expect(checked.out).not.toContain('does not hold')
    expect(checked.out).toContain('Fitness functions: 1 passed')
    expect(checked.code).toBe(0)
  })
})
