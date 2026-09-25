/**
 * Hub catalogue — one Radical Studio document per concept.
 *
 *   - every top-level hub/<category>/<id>.radical is valid (hub block, ids, refs)
 *   - index.json summaries carry what the cards / drop-target check need
 *   - doc ↔ concept mapping round-trips
 *   - blueprint mockups form per-actor screen flows (flow groups linked by
 *     navigates-to), use metamodel-valid relations and carry wireframes that
 *     are already sanitised
 *   - blueprints ship named views (context, containers, governance, one per
 *     screen flow) over sequences whose steps all exist
 */
import { describe, it, expect } from 'vitest'
import { resolve } from 'node:path'
import { readCatalogue, validateCatalogue, buildIndex } from '../tools/hubCatalogue'
import { conceptToDoc, docToConcept, summarize, type HubRadicalDoc } from '../src/renderer/src/hub/hubFormat'
import { useDiagramStore } from '../src/renderer/src/store/diagramStore'
import { builtInGovernanceMetamodel, isParentAllowed } from '../src/renderer/src/types/metamodel'
import { sanitizeWireframeSvg } from '../src/renderer/src/ai/mockupWireframe'

const HUB_DIR = resolve(__dirname, '../hub')

const doc: HubRadicalDoc = {
  hub: {
    id: 'req-x', category: 'requirement', name: 'X', description: 'd', tags: ['a'],
    templateParams: [{ key: 'K', label: 'k' }],
  },
  nodes: [
    { id: 'n1', type: 'requirement', label: 'L', ears_type: 'ubiquitous', priority: 'must', status: '' },
    { id: 'n2', type: 'container', label: 'C', parentId: 'n1' },
  ],
  relations: [{ id: 'r1', sourceId: 'n2', targetId: 'n1' }],
}

describe('hubFormat', () => {
  it('maps doc → concept → doc losslessly', () => {
    const concept = docToConcept(doc)
    expect(concept.id).toBe('req-x')
    expect(concept.nodes).toHaveLength(2)
    expect(conceptToDoc(concept)).toEqual(doc)
  })

  it('summarize picks preview fields, counts and root types', () => {
    const s = summarize(doc)
    expect(s.file).toBe('requirement/req-x.radical')
    expect(s.nodeCount).toBe(2)
    expect(s.relationCount).toBe(1)
    expect(s.rootTypes).toEqual(['requirement'])
    expect(s.preview).toEqual({ ears_type: 'ubiquitous', priority: 'must' })
    expect(s.templateParams).toEqual([{ key: 'K', label: 'k' }])
    expect((s as Record<string, unknown>).nodes).toBeUndefined()
  })
})

describe('hub catalogue', () => {
  const entries = readCatalogue(HUB_DIR)

  it('contains concepts and passes validation', () => {
    expect(entries.length).toBeGreaterThan(50)
    expect(validateCatalogue(entries)).toEqual([])
  })

  it('builds an index with unique ids and one entry per file', () => {
    const index = buildIndex(entries)
    expect(index).toHaveLength(entries.length)
    expect(new Set(index.map((e) => e.id)).size).toBe(entries.length)
    for (const e of index) expect(e.file).toBe(`${e.category}/${e.id}.radical`)
  })

  it('flags path / id mismatches and dangling hubRefs', () => {
    const bad = [
      { file: 'adr/wrong.radical', doc },
      { file: 'blueprint/bp.radical', doc: { hub: { ...doc.hub, id: 'bp', category: 'blueprint' as const, hubRefs: ['nope'] }, nodes: doc.nodes } },
    ]
    const errors = validateCatalogue(bad)
    expect(errors.some((e) => e.includes('expected path requirement/req-x.radical'))).toBe(true)
    expect(errors.some((e) => e.includes('unknown concept "nope"'))).toBe(true)
  })
})

describe('studio round-trip', () => {
  it('loadDiagram → saveDiagram keeps the hub block (opening a concept in Studio must not strip it)', () => {
    const store = useDiagramStore.getState()
    store.loadDiagram({ nodes: [], relations: [], hub: doc.hub })
    expect(useDiagramStore.getState().saveDiagram().hub).toEqual(doc.hub)
    store.newDiagram()
    expect(useDiagramStore.getState().saveDiagram().hub).toBeUndefined()
  })
})

describe('blueprint mockups', () => {
  const blueprints = readCatalogue(HUB_DIR).filter((e) => e.doc.hub.category === 'blueprint')
  const mm = builtInGovernanceMetamodel()

  it.each(blueprints.map((e) => [e.file, e.doc] as const))('%s has screen flows with sanitised wireframes', (_file, doc) => {
    const byId = new Map(doc.nodes.map((n) => [String(n.id), n]))
    const mockups = doc.nodes.filter((n) => n.type === 'mockup')
    expect(mockups.length).toBeGreaterThanOrEqual(8)
    const inFlow = new Set((doc.relations ?? []).filter((r) => r.relationType === 'navigates-to').flatMap((r) => [r.sourceId, r.targetId]))

    for (const m of mockups) {
      const flow = byId.get(String(m.parentId))
      expect(flow?.type, `${m.id}: not inside a flow group`).toBe('group')
      expect(isParentAllowed(mm, 'mockup', 'group')).toBe(true)
      expect(inFlow.has(String(m.id)), `${m.id}: not linked into its flow`).toBe(true)
      const wireframe = m.wireframe as string
      expect(typeof m.screen).toBe('string')
      expect(sanitizeWireframeSvg(wireframe)).toBe(wireframe)
      const out = (doc.relations ?? []).filter((r) => r.sourceId === m.id)
      expect(out.filter((r) => r.relationType === 'presented-by')).toHaveLength(1)
    }

    for (const r of doc.relations ?? []) {
      const src = byId.get(r.sourceId)
      const tgt = byId.get(r.targetId)
      expect(src, `${r.id}: missing source`).toBeDefined()
      expect(tgt, `${r.id}: missing target`).toBeDefined()
      if (src!.type !== 'mockup') continue
      const pairs = mm.relationTypes[r.relationType ?? '']?.allowedPairs ?? []
      expect(pairs.some((p) => p.from === src!.type && p.to === tgt!.type), `${r.id}: ${r.relationType} ${src!.type} → ${tgt!.type}`).toBe(true)
    }
  })
})

describe('blueprint views and sequences', () => {
  const blueprints = readCatalogue(HUB_DIR).filter((e) => e.doc.hub.category === 'blueprint')

  it.each(blueprints.map((e) => [e.file, e.doc] as const))('%s has consistent views and sequences', (_file, doc) => {
    const nodeIds = new Set(doc.nodes.map((n) => String(n.id)))
    const relIds = new Set((doc.relations ?? []).map((r) => String(r.id)))
    const sequences = (doc.sequences ?? []) as Array<{ id: string; relationIds: string[]; stepDescriptions?: string[] }>
    const seqIds = new Set(sequences.map((s) => s.id))
    const views = (doc.views ?? []) as Array<{ id: string; kind: string; sequenceId?: string; nodeIds: string[]; positions: Record<string, Record<string, unknown>> }>

    for (const s of sequences) {
      expect(s.relationIds.length).toBeGreaterThan(0)
      for (const id of s.relationIds) expect(relIds.has(id), `${s.id}: unknown relation ${id}`).toBe(true)
      expect(s.stepDescriptions ?? []).toHaveLength(s.relationIds.length)
    }
    for (const v of views) {
      expect(['static', 'dynamic']).toContain(v.kind)
      for (const id of v.nodeIds) expect(nodeIds.has(id), `${v.id}: unknown node ${id}`).toBe(true)
      if (v.kind === 'dynamic') expect(seqIds.has(v.sequenceId!), `${v.id}: unknown sequence`).toBe(true)
      for (const [id, p] of Object.entries(v.positions)) {
        expect(nodeIds.has(id)).toBe(true)
        for (const k of ['x', 'y', 'width', 'height']) expect(typeof p[k], `${v.id}.${id}.${k}`).toBe('number')
      }
    }

    const ids = views.map((v) => v.id)
    expect(ids).toEqual(expect.arrayContaining(['view-context', 'view-containers', 'view-governance']))
    expect(views.some((v) => v.kind === 'dynamic' && !v.id.startsWith('view-flow-')), 'technical flow').toBe(true)
    for (const g of doc.nodes.filter((n) => n.type === 'group' && String(n.id).startsWith('flow-'))) {
      expect(ids, `view for ${g.id}`).toContain(`view-${g.id}`)
    }
  })
})
