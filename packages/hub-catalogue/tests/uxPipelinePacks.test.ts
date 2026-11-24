/**
 * The packs added after IsoStride (2026-11-24): the UX & Accessibility group,
 * the CI/CD pipeline pack and the version the running element shows. Each is
 * imported with its default answers as Studio's wizard and Forge import it.
 */
import { describe, it, expect } from 'vitest'
import type { C4Node } from '@radical/common/c4'
import { buildConcernInsert, concernPackProblems } from '@radical/common/concerns'
import { docToConcept, type HubRadicalDoc } from '@radical/common/hubFormat'
import { builtInGovernanceMetamodel } from '@radical/common/metamodel'
import { readCatalogue } from '../src/catalogue'
import { answerCombinations } from '../src/packCheck'

const docs = new Map(readCatalogue().map(({ doc }) => [doc.hub.id, doc as HubRadicalDoc]))
const doc = (id: string): HubRadicalDoc => {
  const d = docs.get(id)
  if (!d) throw new Error(`no pack ${id} in the catalogue`)
  return d
}
const defaults = (d: HubRadicalDoc): Record<string, string> =>
  Object.fromEntries((d.hub.templateParams ?? []).filter((p) => p.defaultValue !== undefined).map((p) => [p.key, String(p.defaultValue)]))

/** What the pack brings into a model for `answers` (its defaults by default). */
function imported(id: string, answers: Record<string, string> = defaults(doc(id))): C4Node[] {
  let n = 0
  const insert = buildConcernInsert(docToConcept(doc(id)), {
    answers, elements: [], metamodel: builtInGovernanceMetamodel(), today: '2026-11-24',
    newId: () => `n-${++n}`, place: () => ({ x: 0, y: 0 }),
  })
  return Object.values(insert.nodes)
}
const text = (nodes: C4Node[]): string => JSON.stringify(nodes)
const fitness = (nodes: C4Node[]) => nodes.filter((x) => x.type === 'fitness-fn') as Array<C4Node & { measure?: string; metrics?: string }>

describe('UX & Accessibility group', () => {
  it('holds Usability, Accessibility and Mobile and perceived performance, each meeting the pack standard', () => {
    const ux = [...docs.values()].filter((d) => d.hub.concern?.group === 'ux').map((d) => d.hub.id).sort()
    expect(ux).toEqual(['concern-accessibility', 'concern-mobile-performance', 'concern-usability'])
    for (const id of ux) expect(concernPackProblems(doc(id)), id).toEqual([])
  })

  it('decides the same link repeated on a page, WCAG 2.2 AA and Reflow at 320 px', () => {
    expect(text(imported('concern-usability'))).toMatch(/same (link|place|target)/i)
    expect(text(imported('concern-accessibility'))).toContain('WCAG 2.2')
    expect(text(imported('concern-mobile-performance'))).toMatch(/320/)
  })

  it('measures the lab Web Vitals with the lighthouse sensor, the total blocking time scaled to the machine', () => {
    const lab = fitness(imported('concern-mobile-performance')).filter((f) => f.measure?.includes('lighthouse'))
    expect(lab.length).toBeGreaterThan(0)
    const metrics = lab.map((f) => f.metrics ?? '').join('\n')
    expect(metrics).toMatch(/^web\.lab\.lcp\.max\{device=mobile\} <= \d+ ms$/m)
    expect(metrics).toMatch(/^web\.lab\.tbt\.max\{device=mobile\} <= \d+ ms scaled$/m)
  })
})

describe('Web Vitals and accessibility have one owner', () => {
  it('the Frontend stack pack, with any answers, measures no Web Vital and runs no axe-core or keyboard check', () => {
    const d = doc('concern-frontend-stack')
    for (const answers of answerCombinations(d.hub.templateParams ?? [])) {
      const nodes = imported('concern-frontend-stack', { ...defaults(d), ...answers })
      for (const f of fitness(nodes)) {
        expect(`${f.label} ${f.metrics ?? ''}`, JSON.stringify(answers)).not.toMatch(/\b(LCP|INP|CLS|axe|keyboard)\b|web\.lab\.(lcp|cls|inp|tbt)/i)
      }
    }
    expect(text(imported('concern-accessibility'))).toMatch(/axe/i)
  })
})

describe('CI/CD pipeline pack', () => {
  it('brings the pipeline as code, required checks, building once and OIDC, measured by the github-actions sensor', () => {
    const nodes = imported('concern-ci-cd-pipeline')
    const labels = nodes.filter((x) => x.type === 'requirement').map((x) => x.label)
    expect(labels).toEqual(expect.arrayContaining(['Pipeline defined as code', 'Built once, promoted by digest', 'Cloud reached without stored keys']))
    const measured = fitness(nodes).filter((f) => f.measure === 'github-actions')
    expect(measured.map((f) => f.metrics).join('\n')).toMatch(/^ci\.required-checks >= 1$/m)
    expect(measured.map((f) => f.metrics).join('\n')).toMatch(/^ci\.pr\.duration\.p90 <= \d+ min$/m)
  })
})

describe('Release and versioning: the version the running element shows', () => {
  it('checks after each deployment that the interface shows the version and commit deployed', () => {
    const nodes = imported('concern-release-versioning', { ...defaults(doc('concern-release-versioning')), SHOWN: 'ui' })
    const shown = fitness(nodes).filter((f) => (f as unknown as { trigger?: string }).trigger === 'deploy')
    expect(text(shown)).toMatch(/commit/i)
    expect(text(shown)).toMatch(/version/i)
  })
})
