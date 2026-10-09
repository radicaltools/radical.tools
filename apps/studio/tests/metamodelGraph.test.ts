/**
 * The metamodel diagram's graph rules: how allowed parents and relation
 * pairs become boxes, edges and chips, and that ELK lays every one of them out.
 */
import { describe, it, expect } from 'vitest'
import { builtInGovernanceMetamodel, type Metamodel } from '@radical/common/metamodel'
import type { SmartLayoutResult } from '@radical/layout/smartLayout'
import {
  buildMetamodelGraph,
  layoutMetamodelGraph,
  smartLayoutInput,
  typeNeighbourhood,
  CONTAINS_EDGE,
  type Rect,
} from '../src/renderer/src/components/metamodel/metamodelGraph'

function tiny(): Metamodel {
  const base = builtInGovernanceMetamodel()
  const t = (id: string, allowedParents?: string[]) => ({ ...base.nodeTypes.system, id, label: id, allowedParents, properties: [] })
  return {
    id: 'tiny',
    name: 'Tiny',
    nodeTypes: { a: t('a', ['a']), b: t('b', ['a', 'ghost']), c: t('c') },
    relationTypes: {
      uses: { id: 'uses', label: 'Uses', allowedPairs: [{ from: 'b', to: 'c' }, { from: 'c', to: 'b' }, { from: 'b', to: 'c' }] },
      replaces: { id: 'replaces', label: 'Replaces', allowedPairs: [{ from: 'c', to: 'c' }] },
      dangling: { id: 'dangling', label: 'Dangling', allowedPairs: [{ from: 'a', to: 'ghost' }] },
      anything: { id: 'anything', label: 'Anything', allowedPairs: [] },
    },
  }
}

describe('buildMetamodelGraph', () => {
  it('draws containment parent → child and turns self-nesting into a flag', () => {
    const g = buildMetamodelGraph(tiny())
    const contains = g.edges.filter((e) => e.type === CONTAINS_EDGE)
    expect(contains.map((e) => [e.source, e.target])).toEqual([['a', 'b']])
    expect(g.nodes.find((n) => n.id === 'a')!.nestsInSelf).toBe(true)
  })

  it('merges a pair allowed both ways into one two-headed edge', () => {
    const uses = buildMetamodelGraph(tiny()).edges.filter((e) => e.type === 'uses')
    expect(uses).toHaveLength(1)
    expect(uses[0]).toMatchObject({ source: 'b', target: 'c', bidirectional: true })
  })

  it('turns self pairs into chips and skips pairs naming unknown types', () => {
    const g = buildMetamodelGraph(tiny())
    expect(g.nodes.find((n) => n.id === 'c')!.selfRelations.map((r) => r.id)).toEqual(['replaces'])
    expect(g.edges.some((e) => e.type === 'dangling' || e.type === 'replaces')).toBe(false)
  })

  it('lists any-pair relations separately', () => {
    expect(buildMetamodelGraph(tiny()).anyPairRelations.map((r) => r.id)).toEqual(['anything'])
  })

  it('honours the filter', () => {
    const g = buildMetamodelGraph(tiny(), { showContainment: false, showProperties: true, hiddenRelations: new Set(['uses']) })
    expect(g.edges).toEqual([])
  })

  it('draws every relation between the two types it connects', () => {
    const g = buildMetamodelGraph(builtInGovernanceMetamodel())
    const constrains = g.edges.filter((e) => e.type === 'constrains')
    expect(constrains).toHaveLength(24)
    const ids = new Set(g.nodes.map((n) => n.id))
    for (const e of g.edges) expect(ids.has(e.source) && ids.has(e.target)).toBe(true)
  })

  it('groups types by the palette categories, custom types last', () => {
    const mm = builtInGovernanceMetamodel()
    mm.nodeTypes.custom1 = { ...mm.nodeTypes.system, id: 'custom1', label: 'Custom 1', builtin: false }
    const g = buildMetamodelGraph(mm)
    expect(g.categories.map((c) => c.label)).toEqual(['C4', 'Domain', 'Governance', 'Requirements', 'States', 'UX', 'Other', 'Custom'])
    expect(g.categories.find((c) => c.label === 'Requirements')!.members).toEqual(['need', 'requirement', 'scenario'])
    expect(g.nodes.find((n) => n.id === 'adr')!.category).toBe('category:governance')
  })

  it('with containment hidden, still links a type no relation type reaches to its allowed parents', () => {
    const g = buildMetamodelGraph(builtInGovernanceMetamodel(), { showContainment: false, showProperties: false, hiddenRelations: new Set() })
    expect(g.edges.filter((e) => e.type === CONTAINS_EDGE).map((e) => e.id).sort()).toEqual([
      'contains:domain>blueprint',
      'contains:group>blueprint',
      'contains:system>group',
    ])
    const linked = new Set(g.edges.flatMap((e) => [e.source, e.target]))
    expect(g.nodes.filter((n) => !linked.has(n.id)).map((n) => n.id)).toEqual([])
  })

  it('with a narrowed filter, keeps only the types the shown edges connect', () => {
    const mm = builtInGovernanceMetamodel()
    const only = (id: string) => ({
      showContainment: false,
      showProperties: false,
      hiddenRelations: new Set(Object.keys(mm.relationTypes).filter((r) => r !== id)),
    })
    // Satisfies: the eight C4 element types and State Machine → Requirement. No containment rescue.
    const satisfies = buildMetamodelGraph(mm, only('satisfies'))
    expect(satisfies.nodes.map((n) => n.id).sort()).toEqual(
      ['component', 'container', 'database', 'domain', 'person', 'queue', 'requirement', 'state-machine', 'system', 'webapp'],
    )
    expect(satisfies.edges.every((e) => e.type === 'satisfies')).toBe(true)
    expect(satisfies.categories.map((c) => c.label)).toEqual(['C4', 'Domain', 'Requirements', 'States'])
    // A relation drawn only as a chip (ADR supersedes ADR) still keeps its type.
    expect(buildMetamodelGraph(mm, only('supersedes')).nodes.map((n) => n.id)).toEqual(['adr'])
    // Nothing shown at all: every type stays, without edges.
    const none = buildMetamodelGraph(mm, { showContainment: false, showProperties: false, hiddenRelations: new Set(Object.keys(mm.relationTypes)) })
    expect(none.edges).toEqual([])
    expect(none.nodes).toHaveLength(21)
  })

  it('draws containment to every allowed child, Group included', () => {
    const g = buildMetamodelGraph(builtInGovernanceMetamodel())
    const fromGroup = g.edges.filter((e) => e.type === CONTAINS_EDGE && e.source === 'group')
    expect(fromGroup).toHaveLength(18)
  })

  it('grows a box for self-relation chips', () => {
    const g = buildMetamodelGraph(tiny())
    const [b, c] = ['b', 'c'].map((id) => g.nodes.find((n) => n.id === id)!)
    expect(c.height).toBeGreaterThan(b.height)
  })
})

describe('layoutMetamodelGraph (Smart Layout)', () => {
  const overlap = (a: Rect, b: Rect): boolean =>
    a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height

  it('keeps types apart, inside their category frame, frames apart, and routes every edge', async () => {
    const g = buildMetamodelGraph(builtInGovernanceMetamodel(), { showContainment: true, showProperties: false, hiddenRelations: new Set() })
    const layout = await layoutMetamodelGraph(g)
    const box = (id: string): Rect => {
      const n = g.nodes.find((x) => x.id === id)!
      return { ...layout.positions[id], width: n.width, height: n.height }
    }
    for (let i = 0; i < g.nodes.length; i++)
      for (let j = i + 1; j < g.nodes.length; j++)
        expect(overlap(box(g.nodes[i].id), box(g.nodes[j].id)), `${g.nodes[i].id} overlaps ${g.nodes[j].id}`).toBe(false)
    for (const n of g.nodes) {
      const f = layout.frames[n.category]
      const b = box(n.id)
      expect(b.x >= f.x && b.y >= f.y && b.x + b.width <= f.x + f.width && b.y + b.height <= f.y + f.height, `${n.id} outside its frame`).toBe(true)
    }
    const frames = Object.entries(layout.frames)
    for (let i = 0; i < frames.length; i++)
      for (let j = i + 1; j < frames.length; j++)
        expect(overlap(frames[i][1], frames[j][1]), `${frames[i][0]} overlaps ${frames[j][0]}`).toBe(false)
    for (const e of g.edges) expect(layout.routes[e.id]?.path).toMatch(/^M/)
  }, 30_000)

  it('shows Smart Layout\'s positions unchanged (child offsets added to their group)', async () => {
    const g = buildMetamodelGraph(builtInGovernanceMetamodel())
    const positions: Record<string, { x: number; y: number }> = {}
    g.categories.forEach((c, i) => {
      positions[c.id] = { x: i * 1000, y: 50 }
      c.members.forEach((id, j) => (positions[id] = { x: 30, y: 120 + j * 100 }))
    })
    const run = async () => ({ winner: { positions } }) as unknown as SmartLayoutResult
    const layout = await layoutMetamodelGraph(g, run)
    expect(layout.positions.adr).toEqual({ x: 2000 + 30, y: 50 + 120 })
    expect(layout.positions.blueprint).toEqual({ x: 2000 + 30, y: 50 + 320 })
  })

  it('hands Smart Layout a group per category with the types as leaves inside', () => {
    const g = buildMetamodelGraph(builtInGovernanceMetamodel())
    const { nodes, relations } = smartLayoutInput(g)
    expect(nodes['category:governance']).toMatchObject({ type: 'group' })
    expect(nodes.requirement).toMatchObject({ type: 'component', parentId: 'category:requirements', collapsed: false })
    expect(Object.keys(relations)).toHaveLength(g.edges.length)
  })
})

describe('typeNeighbourhood', () => {
  it('collects parents, children and relations both ways', () => {
    const n = typeNeighbourhood(tiny(), 'b')
    expect(n.parents).toEqual(['a'])
    expect(n.children).toEqual([])
    expect(n.outgoing.get('uses')).toEqual(['c'])
    expect(n.incoming.get('uses')).toEqual(['c'])
  })
})
