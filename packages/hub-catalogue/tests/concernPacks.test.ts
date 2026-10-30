/**
 * Concern packs — the Hub's packs of one concern each (catalogue/concern),
 * built from their specs (packs/<group>/<id>.ts).
 *
 *   - every pack's trigger runs, it asks questions, and its slice is connected
 *   - every pack meets the standard, and every group has packs
 *   - imported with every combination of answers and bound to an element its
 *     trigger finds, it settles its concern and brings in nothing the check
 *     flags but the tests the team still has to name
 *   - every file is what its spec builds
 */
import { describe, it, expect } from 'vitest'
import { readCatalogue, validateCatalogue, concernPacksOf } from '../src/catalogue'
import { concernPackProblems, CONCERN_GROUPS } from '@radical/common/concerns'
import { buildPackDoc, packFile, packFileText, specProblems, type FitnessSpec, type PackSpec } from '../src/packSpec'
import { boundImportProblems } from '../src/packCheck'

const entries = readCatalogue()
const packs = entries.filter(({ doc }) => doc.hub.category === 'concern')
const specs = Object.values(import.meta.glob<{ default: PackSpec }>('../packs/**/*.ts', { eager: true })).map((m) => m.default)

describe('concern packs', () => {
  it('every pack has a trigger that parses, questions and a connected slice', () => {
    expect(packs.length).toBeGreaterThan(0)
    expect(validateCatalogue(entries)).toEqual([])
    expect(concernPacksOf(entries).map((p) => p.id)).toEqual(packs.map(({ doc }) => doc.hub.id))
  })

  it('every pack meets the standard, and every group has packs', () => {
    for (const { file, doc } of packs) expect(concernPackProblems(doc), file).toEqual([])
    for (const spec of specs) expect(specProblems(spec), spec.id).toEqual([])
    const groups = new Set(packs.map(({ doc }) => doc.hub.concern?.group))
    for (const g of CONCERN_GROUPS) expect(groups.has(g.id), `group ${g.id} has no pack`).toBe(true)
  })

  it('specProblems: every requirement is checked by a fitness function imported with it, or says why not', () => {
    const spec = {
      ...specs[0],
      questions: [{ key: 'Q', title: 'Q', label: 'Q?', hint: '', default: 'a', options: [{ value: 'a', label: 'a', description: 'a' }, { value: 'b', label: 'b', description: 'b' }] }],
      requirements: [
        { ...specs[0].requirements[0], id: 'r1', when: undefined, unchecked: undefined },
        { ...specs[0].requirements[0], id: 'r2', when: { Q: ['a', 'b'] }, unchecked: undefined },
        { ...specs[0].requirements[0], id: 'r3', when: undefined, unchecked: 'A review on the calendar.' },
        { ...specs[0].requirements[0], id: 'r4', when: undefined, unchecked: ' ' },
      ],
      fitness: [{ ...specs[0].fitness[0], id: 'f1', when: { Q: ['a'] }, checks: ['r2', 'r4', 'nope'] }],
    } as PackSpec
    expect(specProblems(spec)).toEqual([
      'fitness function "f1" checks "nope", which is no requirement of the pack',
      'requirement "r1" is checked by no fitness function (name it in a fitness function\'s checks, or say in unchecked why the team keeps it by hand)',
      'requirement "r2" is imported without any fitness function that checks it for {"Q":"b"}',
      'requirement "r4": unchecked must say why no fitness function checks it',
      'requirement "r4" is unchecked yet "f1" checks it',
    ])
  })

  it('specProblems: every fitness function states its characteristic, scope, cadence and invocation', () => {
    for (const spec of specs) {
      expect(specProblems(spec).filter((p) => p.startsWith('fitness function')), spec.id).toEqual([])
      for (const node of buildPackDoc(spec).nodes.filter((n) => n.type === 'fitness-fn')) expect(node, `${spec.id} ${String(node.id)}`).not.toHaveProperty('category')
    }
    // A copy of a pack's first fitness function (triggered on pull requests)
    // with one dimension changed or deleted.
    const [f] = specs[0].fitness
    const problemsWith = (change: Record<string, unknown>, drop: string[] = []): string[] => {
      const g: Record<string, unknown> = { ...f, ...change }
      for (const key of drop) delete g[key]
      return specProblems({ ...specs[0], fitness: [g as unknown as FitnessSpec] }).filter((p) => p.startsWith('fitness function'))
    }
    expect(problemsWith({})).toEqual([])
    for (const key of ['characteristic', 'scope', 'cadence', 'invocation']) {
      expect(problemsWith({}, [key]), key).toEqual([expect.stringContaining(`states no ${key}`)])
    }
    expect(problemsWith({ characteristic: 'usability' })).toEqual([expect.stringContaining('characteristic "usability" is not one of')])
    expect(problemsWith({ scope: 'structural' })).toEqual([expect.stringContaining('scope "structural" is not one of')])
    expect(problemsWith({ invocation: 'sometimes' })).toEqual([expect.stringContaining('invocation "sometimes" is not one of')])
    expect(problemsWith({ cadence: 'triggered' }, ['trigger', 'every'])).toEqual([expect.stringContaining('states no trigger')])
    expect(problemsWith({ cadence: 'triggered', trigger: 'hourly' }, ['every'])).toEqual([expect.stringContaining('trigger "hourly" is not one of')])
    expect(problemsWith({ cadence: 'temporal' }, ['trigger', 'every'])).toEqual([expect.stringContaining('is temporal but states no every')])
    expect(problemsWith({ cadence: 'temporal', every: 'quarterly' }, ['trigger'])).toEqual([expect.stringContaining('every "quarterly" is no period')])
    expect(problemsWith({ cadence: 'temporal', every: '{{REVIEW_DAYS}}d' }, ['trigger'])).toEqual([])
    expect(problemsWith({ cadence: 'continual', trigger: 'nightly' }, ['every'])).toEqual([expect.stringContaining('has a trigger but is not triggered')])
    expect(problemsWith({ cadence: 'continual', every: '90d' }, ['trigger'])).toEqual([expect.stringContaining('has an every but is not temporal')])
    expect(problemsWith({ category: 'structural' })).toEqual([expect.stringContaining('still has a category')])
    expect(problemsWith({ measure: 'test-results' })).toEqual([expect.stringContaining('states a measure')])
  })

  it('every pack imported and bound passes radical check', () => {
    for (const { file, doc } of packs) expect(boundImportProblems(doc), file).toEqual([])
  })

  it('every pack is what its spec builds', () => {
    expect(specs.map((s) => packFile(s)).sort()).toEqual(packs.map((p) => p.file).sort())
    for (const spec of specs) {
      expect(JSON.stringify(packs.find((p) => p.file === packFile(spec))?.doc), `${packFile(spec)}: run npm run build:packs -w @radical/hub-catalogue`)
        .toBe(JSON.stringify(JSON.parse(packFileText(spec))))
      expect(buildPackDoc(spec).hub.concern?.group, spec.id).toBe(spec.group)
    }
  })
})
