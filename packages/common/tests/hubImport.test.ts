import { describe, it, expect } from 'vitest'
import { buildConceptInsert } from '../src/hubImport'
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
})
