import { describe, it, expect } from 'vitest'
import { buildConceptInsert, conceptFileAsModel, defaultParamValues, retemplateText, templateKeysUsed } from '../src/hubImport'
import type { DiagramData } from '../src/c4'
import type { HubConcept } from '../src/hubFormat'

const concept: HubConcept = {
  id: 'pattern-x',
  category: 'pattern',
  name: 'Pattern X',
  description: 'd',
  tags: [],
  templateParams: [{ key: 'NAME', label: 'Name', defaultValue: 'Orders' }],
  nodes: [
    { id: 'sys', type: 'system', label: '{{NAME}} system', x: 100, y: 50, width: 400, height: 300 },
    { id: 'api', type: 'container', label: 'API', parentId: 'sys', x: 20, y: 40, width: 200, height: 100 },
    { id: 'db', type: 'database', label: 'DB', x: 600, y: 50, width: 200, height: 100 },
  ],
  relations: [{ id: 'r1', sourceId: 'api', targetId: 'db', relationType: 'interacts' }],
  sequences: [{ id: 's1', name: 'Flow', relationIds: ['r1'] }],
  views: [{ id: 'v1', name: 'Overview', nodeIds: ['sys', 'api', 'db'] }],
}

describe('buildConceptInsert', () => {
  it('re-ids everything, fills template params and puts the root cluster where asked', () => {
    let n = 0
    const sizes: Array<{ width: number; height: number }> = []
    const insert = buildConceptInsert(concept, {
      newId: () => `id-${++n}`,
      place: (size) => { sizes.push(size); return { x: 1000, y: -20 } },
    })
    expect(sizes).toEqual([{ width: 700, height: 300 }])
    const nodes = Object.values(insert.nodes)
    const byLabel = Object.fromEntries(nodes.map((node) => [node.label, node]))
    expect(Object.keys(byLabel).sort()).toEqual(['API', 'DB', 'Orders system'])
    expect(byLabel['Orders system']).toMatchObject({ x: 1000, y: -20 })
    expect(byLabel.DB).toMatchObject({ x: 1500, y: -20 })
    // Children keep their position inside the parent.
    expect(byLabel.API).toMatchObject({ x: 20, y: 40, parentId: byLabel['Orders system'].id })

    const [relation] = Object.values(insert.relations)
    expect(relation).toMatchObject({ sourceId: byLabel.API.id, targetId: byLabel.DB.id, relationType: 'interacts' })
    expect(Object.values(insert.sequences)[0].relationIds).toEqual([relation.id])
    expect(insert.views).toHaveLength(1)
    expect(insert.views[0].nodeIds.sort()).toEqual(nodes.map((node) => node.id).sort())
    expect(insert.template?.record).toMatchObject({ conceptId: 'pattern-x', paramValues: { NAME: 'Orders' } })
    expect(insert.template?.record.nodeIds.sort()).toEqual(nodes.map((node) => node.id).sort())
  })

  it('brings its views with the places the Hub drew them at', () => {
    // A blueprint's Containers view, opened after a reload, had none and
    // drew the Ledger Platform over the model's root elements.
    let n = 0
    const at = (x: number, y: number, width: number, height: number) => ({ x, y, width, height })
    const drawn = { ...concept, views: [{ ...concept.views![0], positions: { sys: at(0, 0, 400, 300), api: at(30, 120, 200, 100), db: at(500, 0, 200, 100) } }] }
    const insert = buildConceptInsert(drawn, { newId: () => `id-${++n}`, place: () => ({ x: 1000, y: -20 }) })
    const byLabel = Object.fromEntries(Object.values(insert.nodes).map((node) => [node.label, node]))
    expect(insert.views[0].positions).toEqual({
      [byLabel['Orders system'].id]: at(0, 0, 400, 300),
      [byLabel.API.id]: at(30, 120, 200, 100),
      [byLabel.DB.id]: at(500, 0, 200, 100),
    })
  })
})

describe('template values in a flow', () => {
  // Only nodes were substituted: the step notes of a blueprint's flows kept
  // "{{DISPUTE_INVESTIGATION_DAYS}}" in the model.
  it('reach the step notes of its sequences', () => {
    const concept = {
      id: 'c', name: 'C', category: 'blueprint', tags: [], description: '',
      templateParams: [{ key: 'DAYS', label: 'Days', defaultValue: '10' }],
      nodes: [{ id: 'a', type: 'system', label: 'A', x: 0, y: 0 }, { id: 'b', type: 'system', label: 'B', x: 300, y: 0 }],
      relations: [{ id: 'r', sourceId: 'a', targetId: 'b', label: 'within {{DAYS}} days' }],
      sequences: [{ id: 's', name: 'Flow', relationIds: ['r'], stepDescriptions: ['answers within {{DAYS}} days'] }],
    } as never
    let n = 0
    const insert = buildConceptInsert(concept, { newId: () => `id${++n}`, place: () => ({ x: 0, y: 0 }), paramValues: { DAYS: '5' } })
    // (The record keeps the Hub's texts, tokens and all, for Apply.)
    expect(JSON.stringify({ ...insert, template: undefined })).not.toMatch(/\{\{[A-Z0-9_]+\}\}/)
    expect(Object.values(insert.sequences)[0].stepDescriptions).toEqual(['answers within 5 days'])
    expect(Object.values(insert.relations)[0].label).toBe('within 5 days')
  })

  it('templateKeysUsed finds tokens in nodes, relations and step notes', () => {
    expect([...templateKeysUsed({ nodes: [{ threshold: 'below {{A}}%' }], relations: [], sequences: [{ stepDescriptions: ['{{B}}'] }] } as never)].sort()).toEqual(['A', 'B'])
  })
})

describe('the record Apply works from', () => {
  // Item 194: it kept the Hub's texts of the elements only, so Apply left a
  // flow's step notes (and a relation's label) at the old value.
  it('keeps the Hub texts of relations and of flows (names, step notes) under their new ids', () => {
    const flow = {
      id: 'c', name: 'C', category: 'blueprint', tags: [], description: '',
      templateParams: [{ key: 'MS', label: 'p95', defaultValue: '800' }],
      nodes: [{ id: 'a', type: 'system', label: 'A', x: 0, y: 0 }, { id: 'b', type: 'system', label: 'B', x: 300, y: 0 }],
      relations: [{ id: 'r', sourceId: 'a', targetId: 'b', label: 'answers in {{MS}} ms' }, { id: 'q', sourceId: 'b', targetId: 'a', label: 'plain' }],
      sequences: [{ id: 's', name: 'Journey', relationIds: ['r', 'q'], stepDescriptions: ['search', 'results within {{MS}} ms'] }],
    } as never
    let n = 0
    const insert = buildConceptInsert(flow, { newId: () => `id${++n}`, place: () => ({ x: 0, y: 0 }) })
    const rel = Object.values(insert.relations).find((r) => r.label === 'answers in 800 ms')!
    const seq = Object.values(insert.sequences)[0]
    expect(insert.template?.record.originalRelations).toEqual({ [rel.id]: { label: 'answers in {{MS}} ms' } })
    expect(insert.template?.record.originalSequences).toEqual({ [seq.id]: { stepDescriptions: ['search', 'results within {{MS}} ms'] } })
  })
})

describe('a concept imported twice', () => {
  // Runs 45 to 64: the second import's views and flows had the names of
  // the first's.
  it('gives the second import\'s views and flows names of their own', () => {
    let n = 0
    const first = buildConceptInsert(concept, { newId: () => `a${++n}`, place: () => ({ x: 0, y: 0 }) })
    const second = buildConceptInsert(concept, {
      newId: () => `b${++n}`, place: () => ({ x: 0, y: 0 }),
      takenNames: { views: first.views.map((v) => v.name), sequences: Object.values(first.sequences).map((q) => q.name) },
    })
    expect(first.views[0].name).toBe('Pattern X — Overview')
    expect(second.views[0].name).toBe('Pattern X — Overview 2')
    expect(Object.values(second.sequences)[0].name).toBe('Flow 2')
  })
})

describe('a template parameter left blank', () => {
  // D18: the MCP server filled in the hint, Studio nothing.
  const params = [{ key: 'DB', label: 'Database', hint: 'e.g. MySQL', defaultValue: 'PostgreSQL' }, { key: 'X', label: 'X', hint: 'an example' }]
  it('takes the template\'s default, never the hint', () => {
    expect(defaultParamValues(params)).toEqual({ DB: 'PostgreSQL', X: '' })
    let n = 0
    const one = { ...concept, templateParams: [{ key: 'NAME', label: 'Name', hint: 'Billing', defaultValue: 'Orders' }] }
    const insert = buildConceptInsert(one, { newId: () => `id${++n}`, place: () => ({ x: 0, y: 0 }), paramValues: { NAME: '  ' } })
    expect(Object.values(insert.nodes).map((x) => x.label)).toContain('Orders system')
    expect(insert.template?.record.paramValues).toEqual({ NAME: 'Orders' })
  })
})

describe('retemplateText', () => {
  // D7: Apply replaces the old value with the new one in the text as it is
  // now; the user's other edits stay (item 196: a rename was undone).
  const original = 'ADR: {{DATABASE}} as primary data store'
  const was = { DATABASE: 'PostgreSQL' }, now = { DATABASE: 'MySQL' }
  it('gives an untouched text the new value', () => {
    expect(retemplateText('ADR: PostgreSQL as primary data store', original, was, now)).toBe('ADR: MySQL as primary data store')
  })
  it('keeps an edit and replaces the old value in it', () => {
    expect(retemplateText('ADR-007 Orders on PostgreSQL', original, was, now)).toBe('ADR-007 Orders on MySQL')
  })
  it('leaves a text without the old value alone, and a value inside another word', () => {
    expect(retemplateText('ADR-007 Orders on Oracle', original, was, now)).toBe('ADR-007 Orders on Oracle')
    expect(retemplateText('p95 within 8000 ms', 'within {{MS}} ms', { MS: '800' }, { MS: '500' })).toBe('p95 within 8000 ms')
    expect(retemplateText('p95 within 800 ms, fast', 'within {{MS}} ms', { MS: '800' }, { MS: '500' })).toBe('p95 within 500 ms, fast')
  })
})

describe('a Hub concept file opened as a model', () => {
  // Item 195: Download, then Open → File… kept the {{KEY}} tokens and no
  // record; Add to Studio fills the defaults and keeps one.
  const file = (): DiagramData => ({
    hub: { id: 'req-x', category: 'requirement', name: 'API Response Time', description: '', tags: [], templateParams: [{ key: 'P95_MS', label: 'p95', defaultValue: '300' }] },
    nodes: [{ id: 'r1', type: 'requirement', label: 'API Response Time', action: 'respond within {{P95_MS}} ms', collapsed: false, x: 0, y: 0, width: 200, height: 80 } as never],
    relations: [],
  })
  it('fills the defaults and keeps a record under the same ids', () => {
    const model = conceptFileAsModel(file())
    expect((model.nodes[0] as unknown as Record<string, unknown>).action).toBe('respond within 300 ms')
    const record = Object.values(model.hubTemplates ?? {})[0]
    expect(record).toMatchObject({ conceptId: 'req-x', paramValues: { P95_MS: '300' }, nodeIds: ['r1'] })
    expect(record.originalNodes.r1.action).toBe('respond within {{P95_MS}} ms')
  })
  it('leaves a model, and a concept already filled, as they are', () => {
    const filled = conceptFileAsModel(file())
    expect(conceptFileAsModel(filled)).toBe(filled)
    const plain: DiagramData = { nodes: [], relations: [] }
    expect(conceptFileAsModel(plain)).toBe(plain)
  })
})
