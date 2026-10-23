import { describe, it, expect } from 'vitest'
import type { C4Node, C4Relation, DiagramView, ViewPipeline } from '../src/c4'
import { builtInGovernanceMetamodel } from '../src/metamodel/presets/governance'
import {
  applyFilters, chainDrawn, chainRelationFor, filterLabel, levelLabel, runChain, runPipeline, sortNodes, suggestFilters,
  suggestNextWays, suggestStartWays, viewShownNodes, readPipeline,
  typeChoices, propertyChoices, relationChoices, placeChoices, viaChoices, addChoices, newElementFilters, levelTypes, chainTypes, linkCandidates, connectTypes, type ChainRow, type PipelineContext,
} from '../src/viewPipeline'
import { checkAddRelation, setViewPipeline, type ModelState } from '../src/model'
import { serializeToMdFolder, deserializeFromMdFolder } from '../src/formats/mdFolder'
import { runModelQuery } from '../src/ai/queryLanguage'

const node = (id: string, type: string, extra: Partial<C4Node> & Record<string, unknown> = {}): C4Node =>
  ({ id, type, label: id, x: 0, y: 0, width: 100, height: 60, ...extra }) as C4Node
const rel = (id: string, sourceId: string, targetId: string, relationType: string): C4Relation =>
  ({ id, sourceId, targetId, relationType }) as C4Relation

// Two domains; two needs; requirements deriving from needs (r2 from both,
// r4 from none); scenarios verifying requirements (s2 verifies two).
const nodes: Record<string, C4Node> = Object.fromEntries([
  node('Billing', 'domain'), node('Ledger', 'domain'),
  node('n-pay', 'need', { parentId: 'Billing' }), node('n-audit', 'need', { parentId: 'Ledger' }),
  node('r1', 'requirement', { parentId: 'Billing', ears_type: 'ubiquitous' }),
  node('r2', 'requirement', { parentId: 'Billing', ears_type: 'event-driven' }),
  node('r3', 'requirement', { parentId: 'Ledger', ears_type: 'event-driven' }),
  node('r4', 'requirement', { parentId: 'Ledger' }),
  node('s1', 'scenario', { parentId: 'Billing' }), node('s2', 'scenario', { parentId: 'Ledger' }),
].map((n) => [n.id, n]))
const relations = [
  rel('d1', 'r1', 'n-pay', 'derives'), rel('d2', 'r2', 'n-pay', 'derives'), rel('d3', 'r2', 'n-audit', 'derives'),
  rel('d4', 'r3', 'n-audit', 'derives'),
  rel('v1', 's1', 'r1', 'verifies'), rel('v2', 's2', 'r2', 'verifies'), rel('v3', 's2', 'r3', 'verifies'),
]
const ctx: PipelineContext = { nodes, relations, metamodel: builtInGovernanceMetamodel() }
const all = Object.values(nodes)
const requirements = ['r1', 'r2', 'r3', 'r4'].map((id) => nodes[id])

/** Needs, under each the requirements refined from it, under each the scenarios verifying it. */
const traceability: ViewPipeline = {
  levels: [
    { ways: [{ types: ['need'] }] },
    { ways: [{ via: { relationType: 'derives', direction: 'in' }, types: ['requirement'] }] },
    { ways: [{ via: { relationType: 'verifies', direction: 'in' }, types: ['scenario'] }] },
  ],
}

/** The rows as "  id", indented by depth, with "+n" for an element under n other parents. */
const outline = (rows: ChainRow[]) => rows.map((r) => '  '.repeat(r.depth) + r.node.id + (r.alsoIn ? ` +${r.alsoIn}` : ''))

describe('view pipeline: the chain', () => {
  it('builds needs → requirements → scenarios; an element under two parents shows under both', () => {
    const result = runChain(all, traceability, ctx)
    expect(outline(result.rows!)).toEqual([
      'n-audit', '  r2 +1', '    s2 +2', '  r3', '    s2 +2',
      'n-pay', '  r1', '    s1', '  r2 +1', '    s2 +2',
    ])
    expect(result.levels.map((l) => [l.candidates, l.shown.length])).toEqual([[2, 2], [3, 3], [2, 2]])
    expect(result.nodes.map((n) => n.id)).toEqual(['n-audit', 'r2', 's2', 'r3', 'n-pay', 'r1', 's1'])
    expect(result.rows!.find((r) => r.node.id === 'r1')!.hasChildren).toBe(true)
  })

  it('filters each level on its own, and hangs a level under its parents by containment too', () => {
    const narrowed: ViewPipeline = {
      levels: [
        traceability.levels![0],
        { ...traceability.levels![1], filters: [{ kind: 'property', key: 'ears_type', op: 'is', values: ['event-driven'] }] },
      ],
    }
    const result = runChain(all, narrowed, ctx)
    expect(outline(result.rows!)).toEqual(['n-audit', '  r2 +1', '  r3', 'n-pay', '  r2 +1'])
    expect(result.levels[1]).toMatchObject({ candidates: 3, counts: [2] })

    const byDomain = runChain(all, { levels: [{ ways: [{ types: ['domain'] }] }, { ways: [{ via: { contains: true }, types: ['requirement'] }] }] }, ctx)
    expect(outline(byDomain.rows!)).toEqual(['Billing', '  r1', '  r2', 'Ledger', '  r3', '  r4'])
  })

  it('keeps to the view\'s elements, all of them for a view that lists none, and orders each level', () => {
    const view = { id: 'v', name: 'v', nodeIds: ['n-pay', 'r1', 'r2', 's1'], positions: {}, pipeline: { ...traceability, sort: { by: 'label', desc: true } } } as DiagramView
    expect(outline(runPipeline(view, ctx).rows!)).toEqual(['n-pay', '  r2', '  r1', '    s1'])
    expect(runPipeline({ ...view, nodeIds: [] }, ctx).levels[0].shown.map((n) => n.id)).toEqual(['n-pay', 'n-audit'])
  })

  it('starts from every element when the first level names no type', () => {
    expect(runChain(all, { levels: [{ ways: [{}] }] }, ctx).rows!.length).toBe(all.length)
    expect(levelLabel({ ways: [{}] }, ctx)).toBe('Every element')
  })

  it('takes any of a level\'s ways: needs or domains, then what is refined from one or contained in the other', () => {
    const either: ViewPipeline = {
      levels: [
        { ways: [{ types: ['need'] }, { types: ['domain'] }] },
        { ways: [{ via: { relationType: 'derives', direction: 'in' }, types: ['requirement'] }, { via: { contains: true }, types: ['requirement'] }] },
      ],
    }
    const result = runChain(all, either, ctx)
    expect(outline(result.rows!)).toEqual([
      'Billing', '  r1 +1', '  r2 +2', 'Ledger', '  r3 +1', '  r4',
      'n-audit', '  r2 +2', '  r3 +1', 'n-pay', '  r1 +1', '  r2 +2',
    ])
    expect(levelLabel(either.levels![1], ctx)).toBe('Refined into → Requirement or Contains → Requirement')
  })

  it('suggests the first level\'s ways by type and the next ones along every relation and containment', () => {
    expect(suggestStartWays(all, ctx).slice(0, 3).map((s) => `${s.label} (${s.count})`)).toEqual(['Every element (10)', 'Requirement (4)', 'Domain (2)'])
    expect(suggestStartWays(all, ctx, [{ types: ['requirement'] }])[1].label).toBe('Domain')
    expect(suggestStartWays(all, ctx, [{}])).toEqual([])
    // Containment from the domains reaches several types: also offered as any element.
    const domains = [nodes.Billing, nodes.Ledger]
    expect(suggestNextWays(domains, all, ctx).map((s) => `${s.label} (${s.count})`)).toContain('Contains → Any element (8)')
    const needs = [nodes['n-pay'], nodes['n-audit']]
    expect(suggestNextWays(needs, all, ctx).map((s) => `${s.label} (${s.count})`)).toEqual(['Refined into → Requirement (3)'])
    expect(suggestNextWays(needs, all, ctx, [{ via: { relationType: 'derives', direction: 'in' }, types: ['requirement'] }])).toEqual([])
  })

  it('is kept with the view and in a Markdown folder; an empty one is removed', () => {
    const state = { views: { v: { id: 'v', name: 'v', kind: 'table', nodeIds: [], positions: {} } } } as unknown as ModelState
    setViewPipeline(state, 'v', { ...traceability, sort: { by: 'property', key: 'ears_type', desc: true } })
    expect(state.views.v.pipeline?.levels).toHaveLength(3)
    const files = serializeToMdFolder({ nodes: [], relations: [], views: [state.views.v] }, 'Pipeline')
    expect(deserializeFromMdFolder(files).data.views?.[0].pipeline).toEqual(state.views.v.pipeline)
    setViewPipeline(state, 'v', { levels: [] })
    expect(state.views.v).not.toHaveProperty('pipeline')
  })
})

describe('view pipeline: filters and order', () => {
  it('filters by type, property value, relation, place and text, counting each step', () => {
    const { nodes: kept, counts } = applyFilters(all, [
      { kind: 'type', types: ['requirement'] },
      { kind: 'within', nodeId: 'Billing' },
      { kind: 'relation', relationType: 'derives', direction: 'out', has: true },
      { kind: 'property', key: 'ears_type', op: 'is-not', values: ['ubiquitous'] },
    ], ctx)
    expect(counts).toEqual([4, 2, 2, 1])
    expect(kept.map((n) => n.id)).toEqual(['r2'])
    expect(applyFilters(all, [{ kind: 'property', key: 'ears_type', op: 'unset' }, { kind: 'type', types: ['requirement'] }], ctx).nodes.map((n) => n.id)).toEqual(['r4'])
    expect(applyFilters(all, [{ kind: 'text', text: 'N-PA' }], ctx).nodes.map((n) => n.id)).toEqual(['n-pay'])
    expect(applyFilters(all, [{ kind: 'type', types: ['need'], off: true }], ctx).counts).toEqual([all.length])
  })

  it('joins filters with and, or a run of them with or', () => {
    // (Type is Need or Type is Scenario) and Inside Billing
    const { nodes: kept, counts } = applyFilters(all, [
      { kind: 'type', types: ['need'] },
      { kind: 'type', types: ['scenario'], join: 'or' },
      { kind: 'within', nodeId: 'Billing' },
    ], ctx)
    expect(counts).toEqual([4, 4, 2])
    expect(kept.map((n) => n.id).sort()).toEqual(['n-pay', 's1'])
    expect(applyFilters(all, [{ kind: 'type', types: ['need'] }, { kind: 'type', types: ['scenario'], join: 'or', off: true }], ctx).counts).toEqual([2, 2])
    // A level's first filter is never joined to anything.
    const state = { views: { v: { id: 'v', name: 'v', nodeIds: [], positions: {} } } } as unknown as ModelState
    setViewPipeline(state, 'v', { levels: [{ ways: [{ types: ['need'] }], filters: [{ kind: 'text', text: 'x', join: 'or' }] }] })
    expect(state.views.v.pipeline?.levels?.[0].filters?.[0]).not.toHaveProperty('join')
  })

  it('says each filter in words', () => {
    expect(filterLabel({ kind: 'type', types: ['requirement', 'need'] }, ctx)).toBe('Type is Requirement or Need')
    expect(filterLabel({ kind: 'property', key: 'ears_type', op: 'is-not', values: ['ubiquitous'] }, ctx)).toBe('EARS type is not ubiquitous')
    expect(filterLabel({ kind: 'relation', relationType: 'verifies', direction: 'in', has: false }, ctx)).toBe('Has no Verified by')
    expect(filterLabel({ kind: 'within', nodeId: 'Ledger' }, ctx)).toBe('Inside Ledger')
  })

  it('orders by name, type or a property, those without the value last', () => {
    expect(sortNodes(requirements, { by: 'property', key: 'ears_type' }, ctx).map((n) => n.id)).toEqual(['r2', 'r3', 'r1', 'r4'])
    expect(sortNodes(requirements, { by: 'property', key: 'ears_type', desc: true }, ctx).map((n) => n.id)).toEqual(['r1', 'r2', 'r3', 'r4'])
  })

  it('suggests filters that narrow the rows, with how many each keeps', () => {
    const labels = suggestFilters(requirements, ctx).map((s) => `${s.label} (${s.count})`)
    expect(labels).toContain('EARS type is event-driven (2)')
    expect(labels).toContain('Has Derives from (3)')
    expect(labels).toContain('Inside Billing (2)')
  })
})

describe('view pipeline: every view kind follows the chain', () => {
  const rels = Object.fromEntries(relations.map((r) => [r.id, r]))
  const twoLevels: ViewPipeline = { levels: traceability.levels!.slice(0, 2) }
  const view = (kind: DiagramView['kind'], pipeline: ViewPipeline | null = twoLevels): DiagramView =>
    ({ id: 'v', name: 'V', kind, nodeIds: [], positions: {}, ...(pipeline ? { pipeline } : {}) }) as DiagramView
  const sorted = (set: Set<string> | undefined) => (set ? [...set].sort() : set)

  it('every kind shows the chain\'s elements, not the containers they sit in', () => {
    for (const kind of ['static', 'matrix', 'treemap', 'table', 'wiki'] as const) {
      expect(sorted(viewShownNodes(view(kind), nodes, rels))).toEqual(['n-audit', 'n-pay', 'r1', 'r2', 'r3'])
    }
    // The matrix's rows and columns, and the relations in its cells: the derives the chain follows.
    const drawn = chainDrawn(view('matrix'), { nodes, relations: rels, metamodel: ctx.metamodel })!
    expect([...drawn.nodeIds].sort()).toEqual(['n-audit', 'n-pay', 'r1', 'r2', 'r3'])
    expect([...drawn.relationIds!].sort()).toEqual(['d1', 'd2', 'd3', 'd4'])
    // A flow view plays its sequence; without a chain a view shows what it lists, or everything.
    expect(viewShownNodes(view('dynamic'), nodes, rels)).toBeUndefined()
    expect(viewShownNodes(view('static', null), nodes, rels)).toBeUndefined()
    expect(sorted(viewShownNodes({ ...view('static', null), nodeIds: ['r4'] }, nodes, rels))).toEqual(['r4'])
  })

  it('a relation added between two of the chain\'s elements gets a type the chain follows, or none is added', () => {
    const c = { nodes, relations: rels, metamodel: ctx.metamodel }
    // A requirement refined from another need: the derives the chain follows.
    expect(chainRelationFor(view('matrix'), 'r1', 'n-audit', c)).toEqual({ relationType: 'derives' })
    // Between two requirements the chain follows nothing: it would not be drawn.
    expect(chainRelationFor(view('matrix'), 'r1', 'r3', c)).toBeNull()
    // A chain that draws every relation between its elements draws that one too.
    expect(chainRelationFor(view('matrix', { ...twoLevels, edges: 'all' }), 'r1', 'r3', c)).not.toBeNull()
  })

  it('follows a change to the model: a requirement refined from a need joins the chain', () => {
    expect(viewShownNodes(view('table'), nodes, rels)!.has('r4')).toBe(false)
    const more = { ...rels, d5: rel('d5', 'r4', 'n-audit', 'derives') }
    expect(viewShownNodes(view('table'), nodes, more)!.has('r4')).toBe(true)
  })

  it('answers queries on a view with what its chain gives', () => {
    const views = { v: view('table') }
    const query = { nodes, relations: rels, views, sequences: {} }
    const result = runModelQuery('GET VIEW v', query as never).result as { nodes: { id: string }[] }
    expect(result.nodes.map((n) => n.id).sort()).toEqual(['n-audit', 'n-pay', 'r1', 'r2', 'r3'])
    const r4 = runModelQuery('GET NODE r4', query as never).result as { views: unknown[] }
    expect(r4.views).toEqual([])
  })
})

describe('view pipeline: chains in older files', () => {
  it('reads a level written before levels had ways, and leaves out what it cannot read', () => {
    const old = { levels: [{ types: ['need'] }, { types: ['requirement'], via: { direction: 'in', relationType: 'derives' } }, 'x'] }
    expect(readPipeline(old)).toEqual(traceability.levels && { levels: traceability.levels.slice(0, 2) })
    expect(readPipeline({ groupBy: [{ by: 'relation', direction: 'out', relationType: 'derives' }] })).toBeUndefined()
    const view = { id: 'v', name: 'V', kind: 'table', nodeIds: [], positions: {}, pipeline: old } as unknown as DiagramView
    expect(runPipeline(view, ctx).rows!.map((r) => r.node.id)).toEqual(['n-audit', 'r2', 'r3', 'n-pay', 'r1', 'r2'])
  })
})

describe('view pipeline: any relation, and choices for editing', () => {
  it('follows any relation either way to any element, and offers it where more than one relation leads on', () => {
    // Under the requirements: what any relation reaches — needs and scenarios.
    const chain: ViewPipeline = { levels: [{ ways: [{ types: ['requirement'] }] }, { ways: [{ via: { anyRelation: true } }] }] }
    const result = runChain(all, chain, ctx)
    expect(outline(result.rows!).slice(0, 4)).toEqual(['r1', '  n-pay +1', '  s1', 'r2'])
    expect(levelLabel(chain.levels![1], ctx)).toBe('Any relation → Any element')
    expect([...result.relationIds].sort()).toEqual(['d1', 'd2', 'd3', 'd4', 'v1', 'v2', 'v3'])
    // Kept through a Markdown folder's reading.
    expect(readPipeline(JSON.parse(JSON.stringify(chain)))).toEqual(chain)
    const offered = suggestNextWays(requirements, all, ctx).map((o) => o.label)
    // Two relations lead on from requirements: any relation is offered too;
    // to each type only one leads, so not per type.
    expect(offered.slice(-1)).toEqual(['Any relation → Any element'])
    expect(offered.filter((l) => l.startsWith('Any relation'))).toHaveLength(1)
  })

  it('lists what a step can be changed to', () => {
    expect(typeChoices(all, ctx).map((c) => [c.value, c.count])).toEqual([['requirement', 4], ['domain', 2], ['need', 2], ['scenario', 2]])
    const ears = propertyChoices(requirements, ctx).find((p) => p.key === 'ears_type')!
    expect(ears.values.find((v) => v.value === 'event-driven')!.count).toBe(2)
    expect(ears.values.some((v) => v.value === 'state-driven' && v.count === 0)).toBe(true)
    expect(relationChoices(requirements, ctx).filter((c) => c.count).map((c) => `${c.value.direction}:${c.value.relationType}`).sort()).toEqual(['in:verifies', 'out:derives'])
    expect(placeChoices(requirements, ctx).map((c) => c.value)).toEqual(['Billing', 'Ledger'])
    const vias = viaChoices([nodes['n-pay']], all, ctx)
    expect(vias.map((v) => v.label)).toEqual([expect.any(String), 'Any relation', 'Contains'])
    expect(vias[0].types.map((t) => t.value)).toEqual(['requirement'])
  })
})

describe('view pipeline: adding where the rows are', () => {
  const view = (pipeline?: ViewPipeline): DiagramView => ({ id: 'v', name: 'v', kind: 'table', nodeIds: [], positions: {}, pipeline }) as DiagramView
  const brief = (choices: ReturnType<typeof addChoices>) =>
    choices.map((c) => [c.type, c.parentId ?? '', c.link ? `${c.link.relationType} ${c.link.direction} ${c.link.otherId}` : ''].join(' | '))

  it('under a need, a requirement refined from it, beside it in its domain', () => {
    expect(brief(addChoices(view(traceability), ctx, { node: nodes['n-pay'], depth: 0 })))
      .toEqual(['requirement | Billing | derives out n-pay'])
    expect(brief(addChoices(view(traceability), ctx, { node: nodes['r3'], depth: 1 })))
      .toEqual(['scenario | Ledger | verifies out r3'])
  })

  it('nothing under the last level', () => {
    expect(addChoices(view(traceability), ctx, { node: nodes['s1'], depth: 2 })).toEqual([])
  })

  it('at the top, the first level\'s types, where most of them are', () => {
    // The two needs are in two domains: the first of them wins the tie.
    expect(addChoices(view(traceability), ctx).map((c) => c.type)).toEqual(['need'])
    const onlyBilling = { ...ctx, nodes: { ...nodes, 'n-audit': { ...nodes['n-audit'], parentId: 'Billing' } } }
    expect(brief(addChoices(view(traceability), onlyBilling))).toEqual(['need | Billing | '])
  })

  it('without a chain, the types a row may hold, or the top of the model may', () => {
    const inside = addChoices(view(), ctx, { node: nodes['Billing'], depth: 0 })
    expect(inside.map((c) => c.type)).toContain('requirement')
    expect(inside.map((c) => c.type)).not.toContain('container')
    expect(inside.every((c) => c.parentId === 'Billing' && !c.link)).toBe(true)
    const top = addChoices(view(), ctx).map((c) => c.type)
    expect(top).toContain('system')
    expect(top).not.toContain('component')
  })

  it('meets the level\'s filters: the value named, the place named; a type they leave out is not offered', () => {
    const filtered: ViewPipeline = { levels: [
      { ways: [{ types: ['need'] }] },
      { ways: [{ via: { relationType: 'derives', direction: 'in' }, types: ['requirement', 'need'] }], filters: [
        { kind: 'type', types: ['requirement'] },
        { kind: 'property', key: 'ears_type', op: 'is', values: ['event-driven', 'complex'] },
        { kind: 'within', nodeId: 'Ledger' },
      ] },
    ] }
    const [choice, ...rest] = addChoices(view(filtered), ctx, { node: nodes['n-pay'], depth: 0 })
    expect(rest).toEqual([])
    expect(choice).toMatchObject({ type: 'requirement', parentId: 'Ledger', properties: { ears_type: 'event-driven' }, link: { relationType: 'derives', direction: 'out', otherId: 'n-pay' } })
    expect(choice.hidden).toBeUndefined()
  })

  it('says what a new element needs for the level it goes on, for views that add their own way', () => {
    const filtered: ViewPipeline = { levels: [
      { ways: [{ types: ['need'] }] },
      { ways: [{ via: { relationType: 'derives', direction: 'in' }, types: ['requirement'] }], filters: [
        { kind: 'property', key: 'ears_type', op: 'is', values: ['event-driven'] },
      ] },
    ] }
    const derives = { relationType: 'derives', direction: 'out' as const }
    // Under a need: the requirements' level.
    expect(newElementFilters(view(filtered), ctx, 'requirement', { node: nodes['n-pay'], link: derives }))
      .toEqual({ properties: { ears_type: 'event-driven' } })
    // At the top a requirement has no level; under a requirement, no level is left.
    expect(newElementFilters(view(filtered), ctx, 'requirement')).toMatchObject({ hidden: true })
    expect(newElementFilters(view(filtered), ctx, 'scenario', { node: nodes['r2'] })).toMatchObject({ hidden: true })
    // One level holds what is inside its elements too; a text it cannot meet hides it.
    const processes: ViewPipeline = { levels: [{ ways: [{}], filters: [{ kind: 'text', text: 'Payment' }] }] }
    expect(newElementFilters(view(processes), ctx, 'need', { node: nodes['n-pay'] })).toEqual({ properties: {}, hidden: true })
    // Without a chain there is nothing to meet.
    expect(newElementFilters(view(), ctx, 'need')).toBeNull()
  })

  it('a filter it cannot meet still offers the type, hidden', () => {
    const texted: ViewPipeline = { levels: [{ ways: [{ types: ['need'] }], filters: [{ kind: 'text', text: 'audit' }] }] }
    expect(addChoices(view(texted), ctx)[0]).toMatchObject({ type: 'need', hidden: true })
    // Switched off, it asks nothing.
    const off: ViewPipeline = { levels: [{ ways: [{ types: ['need'] }], filters: [{ kind: 'text', text: 'audit', off: true }] }] }
    expect(addChoices(view(off), ctx)[0].hidden).toBeUndefined()
  })

  it('a level along containment adds a child', () => {
    const domains: ViewPipeline = { levels: [{ ways: [{ types: ['domain'] }] }, { ways: [{ via: { contains: true }, types: ['need'] }] }] }
    expect(brief(addChoices(view(domains), ctx, { node: nodes['Ledger'], depth: 0 }))).toEqual(['need | Ledger | '])
  })
})

describe('view pipeline: a chain built before its elements', () => {
  // Only the two domains: no need, requirement or scenario yet.
  const bare: PipelineContext = { ...ctx, nodes: { Billing: nodes['Billing'], Ledger: nodes['Ledger'] }, relations: [] }
  const source = Object.values(bare.nodes)

  it('starts with a type of the metamodel that has no element, after those that have', () => {
    const ways = suggestStartWays(source, bare)
    expect(ways.slice(0, 2).map((w) => [w.label, w.count])).toEqual([['Every element', 2], ['Domain', 2]])
    expect(ways.find((w) => w.label === 'Need')?.count).toBe(0)
  })

  it('offers the relations the metamodel allows from the level above', () => {
    const labels = suggestNextWays([], source, bare, [], ['need']).map((w) => `${w.label} ${w.count}`)
    expect(labels).toContain('Refined into → Requirement 0')
    expect(suggestNextWays([], source, bare, [], ['requirement']).map((w) => w.label)).toContain('Verified by → Scenario')
    // What a level already takes is not offered again.
    const taken = [{ via: { relationType: 'derives', direction: 'in' as const }, types: ['requirement'] }]
    expect(suggestNextWays([], source, bare, taken, ['need']).map((w) => w.label)).not.toContain('Refined into → Requirement')
    const via = viaChoices([], source, bare, ['need']).find((c) => c.label === 'Refined into')
    expect(via?.types.map((t) => t.value)).toContain('requirement')
  })

  it('filters a level by the values its types can have', () => {
    const level = { ways: [{ via: { relationType: 'derives', direction: 'in' as const }, types: ['requirement'] }] }
    expect(levelTypes(level, bare)).toEqual(['requirement'])
    expect(suggestFilters([], bare, levelTypes(level, bare)).map((f) => f.label)).toContain('EARS type is event-driven')
    expect(propertyChoices([], bare, ['requirement']).map((p) => p.key)).toContain('ears_type')
  })
})

describe('chainTypes', () => {
  const viewOf = (pipeline?: ViewPipeline): DiagramView => ({ id: 'v', name: 'V', nodeIds: [], positions: {}, ...(pipeline ? { pipeline } : {}) })

  it('gives the types some level of a chain shows, without those its filters leave out, and null without a chain', () => {
    expect([...chainTypes(viewOf(traceability), ctx)!]).toEqual(['need', 'requirement', 'scenario'])
    // A way that takes any element, kept to two types by a filter.
    const filtered: ViewPipeline = { levels: [{ ways: [{}], filters: [{ kind: 'type', types: ['domain', 'entity'] }] }] }
    expect([...chainTypes(viewOf(filtered), ctx)!].sort()).toEqual(['domain', 'entity'])
    // A filter switched off leaves every type in.
    const off: ViewPipeline = { levels: [{ ways: [{}], filters: [{ kind: 'type', types: ['domain'], off: true }] }] }
    expect(chainTypes(viewOf(off), ctx)!.size).toBe(Object.keys(ctx.metamodel!.nodeTypes).length)
    expect(chainTypes(viewOf(), ctx)).toBeNull()
    expect(chainTypes(undefined, ctx)).toBeNull()
  })
})

describe('linkCandidates', () => {
  it("lists the elements of a choice's type not yet linked to the element that way, and none for one that goes inside", () => {
    // Under n-pay a requirement derives from it (the child is the source).
    const under = (id: string) => ({ relationType: 'derives', direction: 'out' as const, otherId: id })
    expect(linkCandidates('requirement', under('n-pay'), ctx).map((n) => n.id)).toEqual(['r3', 'r4'])
    expect(linkCandidates('requirement', under('n-audit'), ctx).map((n) => n.id)).toEqual(['r1', 'r4'])
    // Scenarios verify a requirement: s1 verifies r1 already.
    expect(linkCandidates('scenario', { relationType: 'verifies', direction: 'out', otherId: 'r1' }, ctx).map((n) => n.id)).toEqual(['s2'])
    // A pair the relation type does not allow: no domain derives from a need.
    expect(linkCandidates('domain', under('n-pay'), ctx)).toEqual([])
    expect(linkCandidates('requirement', undefined, ctx)).toEqual([])
    // Only those the level's filters let through, so that the view shows them.
    expect(linkCandidates('requirement', under('n-pay'), ctx, [{ kind: 'property', key: 'ears_type', op: 'is', values: ['event-driven'] }]).map((n) => n.id)).toEqual(['r3'])
  })
})

// F-0033, F-0044: Add or link offered what the model then refused (a system
// to the container it holds) or flagged (an aggregate root part of another):
// it offers what checkAddRelation accepts, by the same check.
describe('linkCandidates and what the model accepts', () => {
  const store = (extra: C4Node[], rels: C4Relation[] = []): PipelineContext => ({
    nodes: Object.fromEntries(extra.map((n) => [n.id, n])), relations: rels, metamodel: builtInGovernanceMetamodel(),
  })
  it('offers no structural link to what holds the element, but a governance one', () => {
    const c = store([node('shop', 'system'), node('api', 'container', { parentId: 'shop' }), node('pay', 'system'), node('req', 'requirement', { parentId: 'shop' })])
    // Under API, "uses" a system: not the Shop that holds it.
    expect(linkCandidates('system', { relationType: 'interacts', direction: 'in', otherId: 'api' }, c).map((n) => n.id)).toEqual(['pay'])
    expect(linkCandidates('container', { relationType: 'interacts', direction: 'out', otherId: 'shop' }, c)).toEqual([])
    // A requirement inside the Shop may be satisfied by it.
    expect(linkCandidates('system', { relationType: 'satisfies', direction: 'out', otherId: 'req' }, c).map((n) => n.id)).toEqual(['pay', 'shop'])
  })
  it('offers as part of an aggregate root only the parts of no other aggregate', () => {
    const entity = (id: string, kind: string) => node(id, 'entity', { kind })
    const c = store(
      [entity('payment', 'aggregate-root'), entity('account', 'aggregate-root'), entity('line', 'entity'), entity('owner', 'entity'), entity('customer', 'aggregate-root')],
      [rel('p1', 'owner', 'customer', 'part-of')],
    )
    expect(linkCandidates('entity', { relationType: 'part-of', direction: 'out', otherId: 'payment' }, c).map((n) => n.id)).toEqual(['line'])
    for (const n of linkCandidates('entity', { relationType: 'part-of', direction: 'out', otherId: 'payment' }, c)) {
      expect(checkAddRelation({ c4Nodes: c.nodes, c4Relations: Object.fromEntries((c.relations as C4Relation[]).map((r) => [r.id, r])), views: {}, activeViewId: null, metamodel: c.metamodel }, { sourceId: n.id, targetId: 'payment', relationType: 'part-of' })).toBeNull()
    }
  })
  it('the connect key offers a governance type between an element and what holds it, and no structural one', () => {
    const c = store([node('shop', 'system'), node('api', 'container', { parentId: 'shop' }), node('req', 'requirement', { parentId: 'shop' })])
    const view: DiagramView = { id: 'v', name: 'V', nodeIds: [], positions: {} }
    expect([...connectTypes(view, 'shop', ['api', 'req'], c)]).toEqual([['req', ['satisfies']]])
  })
})

describe('connectTypes', () => {
  it("gives each target the types a relation from the element may take, as the view's chain draws them", () => {
    const viewOf = (pipeline?: ViewPipeline): DiagramView => ({ id: 'v', name: 'V', nodeIds: [], positions: {}, ...(pipeline ? { pipeline } : {}) })
    const ids = Object.keys(nodes)
    // Without a chain: every pair the metamodel allows, with the types that fit.
    const free = connectTypes(viewOf(), 'r4', ids, ctx)
    expect(free.get('n-pay')).toEqual(['derives'])
    expect(free.get('r1')).toEqual(['derives'])
    expect(free.has('s1')).toBe(false)
    expect(free.has('r4')).toBe(false)
    // Traceability draws needs, the requirements derived from them and their
    // scenarios: a requirement links only to a need, and only by derives.
    expect([...connectTypes(viewOf(traceability), 'r4', ids, ctx)]).toEqual([['n-pay', ['derives']], ['n-audit', ['derives']]])
    // Domains among themselves: the types that fit, to choose from.
    const domains: ViewPipeline = { edges: 'all', levels: [{ ways: [{ types: ['domain'] }] }] }
    expect(connectTypes(viewOf(domains), 'Billing', ids, ctx).get('Ledger')!.length).toBeGreaterThan(1)
    expect(connectTypes(viewOf(), 'gone', ids, ctx).size).toBe(0)
  })
})
