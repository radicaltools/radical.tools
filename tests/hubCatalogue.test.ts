/**
 * Hub catalogue — one Radical Studio document per concept.
 *
 *   - every public/hub/<category>/<id>.radical is valid (hub block, ids, refs)
 *   - index.json summaries carry what the cards / drop-target check need
 *   - doc ↔ concept mapping round-trips
 */
import { describe, it, expect } from 'vitest'
import { resolve } from 'node:path'
import { readCatalogue, validateCatalogue, buildIndex } from '../tools/hubCatalogue'
import { conceptToDoc, docToConcept, summarize, type HubRadicalDoc } from '../src/renderer/src/hub/hubFormat'
import { useDiagramStore } from '../src/renderer/src/store/diagramStore'

const HUB_DIR = resolve(__dirname, '../src/renderer/public/hub')

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

describe('public/hub catalogue', () => {
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
