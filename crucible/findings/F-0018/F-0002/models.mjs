// Small models for run 168.
export function entitiesModel() {
  return JSON.stringify({
    metamodel: { id: 'c4-ddd-governance-builtin', name: 'Radical', nodeTypes: {}, relationTypes: {} },
    nodes: [
      { id: 'ent-a', type: 'entity', label: 'Order', x: 100, y: 100, width: 200, height: 100 },
      { id: 'ent-b', type: 'entity', label: 'Customer', x: 500, y: 100, width: 200, height: 100 },
      { id: 'req', type: 'requirement', label: 'Orders are kept', x: 300, y: 400, width: 220, height: 120, ears_type: 'ubiquitous', action: 'The system shall keep orders' },
    ],
    relations: [
      { id: 'r-sat', sourceId: 'ent-a', targetId: 'req', relationType: 'satisfies', label: 'satisfies' },
    ],
    views: [
      { id: 'v-dom', name: 'Domain', kind: 'static', nodeIds: [], positions: {} },
    ],
  })
}
