/**
 * The headless facade (@radical/common/ai/modelFacade, used outside Studio)
 * must edit a model exactly like Studio's store does. Both start from the same
 * document, run the same AI tool calls, including ones the metamodel refuses,
 * and must end with the same tool results and the same model.
 *
 * Geometry is left out of the comparison: only Studio resizes a parent around
 * a new child, and it keeps per-view positions.
 */
import { describe, it, expect } from 'vitest'
import { readCatalogue } from '@radical/hub-catalogue'
import { createModelFacade } from '@radical/common/ai/modelFacade'
import { buildToolHandlers } from '@radical/common/ai/tools'
import type { DiagramFacade } from '@radical/common/ai/diagramFacade'
import type { ToolRunContext, ToolResult } from '@radical/common/ai/tools'
import type { DiagramData } from '@radical/common/c4'
import { useDiagramStore } from '@radical/ui/store/diagramStore'
import { createStoreFacade } from '../src/renderer/src/ai/useDiagramFacade'

type Call = [tool: string, input: Record<string, unknown>]

function run(diagram: DiagramFacade, calls: Call[]) {
  const tempToReal = new Map<string, string>()
  let placed = 0
  const ctx: ToolRunContext = {
    diagram,
    resolveId: (id) => tempToReal.get(id) ?? id,
    registerTempId: (t, r) => { tempToReal.set(t, r) },
    resetTempIds: () => { tempToReal.clear() },
    placeNext: () => { placed++; return { x: placed * 300, y: 0 } },
  }
  const handlers = buildToolHandlers()
  const results: ToolResult[] = calls.map(([tool, input]) => handlers.get(tool)!(input, ctx))
  return { results, tempToReal }
}

/** Replaces generated ids with the tempId they were created under, and drops
 *  geometry, so two runs with different id generators can be compared. */
function normalize(data: DiagramData, tempToReal: Map<string, string>) {
  const alias = new Map([...tempToReal].map(([temp, real]) => [real, `@${temp}`]))
  const id = (x: unknown) => (typeof x === 'string' ? alias.get(x) ?? x : x)
  const text = (s: string) => s.replace(/[0-9a-f]{8}-[0-9a-f-]{27}|id\d+/g, (m) => alias.get(m) ?? m)
  const nodes = data.nodes
    .map(({ x: _x, y: _y, width: _w, height: _h, ...n }) => ({ ...n, id: id(n.id), parentId: id(n.parentId) }))
    .sort((a, b) => String(a.id).localeCompare(String(b.id)))
  const relations = data.relations
    .map(({ id: _id, ...r }) => ({ ...r, sourceId: id(r.sourceId), targetId: id(r.targetId) }))
    .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)))
  const views = (data.views ?? [])
    .map(({ positions: _p, viewport: _v, ...v }) => ({ ...v, id: id(v.id), nodeIds: v.nodeIds.map(id) }))
    .sort((a, b) => String(a.id).localeCompare(String(b.id)))
  return { nodes, relations, views, text }
}

const blueprint = readCatalogue().find((e) => e.doc.hub.category === 'blueprint')!.doc
const { hub: _hub, ...blueprintDoc } = blueprint

describe('headless facade matches the Studio store', () => {
  it('produces the same tool results and the same model', () => {
    const store = useDiagramStore.getState()
    store.loadDiagram(blueprintDoc as unknown as DiagramData)
    const start = useDiagramStore.getState().saveDiagram()
    const someNode = start.nodes.find((n) => !n.parentId)!
    const someRelation = start.relations[0]

    let seq = 0
    const headless = createModelFacade(start, { newId: () => `id${++seq}` })

    const calls: Call[] = [
      ['add_node', { tempId: 'sys', type: 'system', label: 'Billing', description: 'Invoices' }],
      ['add_node', { tempId: 'api', type: 'container', label: 'Billing API', parentId: 'sys', technology: 'Go' }],
      ['add_node', { tempId: 'orphan', type: 'component', label: 'Orphan' }],            // refused: containment
      ['add_node', { tempId: 'req', type: 'requirement', label: 'Invoices are immutable' }],
      ['add_relation', { sourceId: 'api', targetId: someNode.id, label: 'reads' }],
      ['add_relation', { sourceId: 'req', targetId: 'sys' }],
      ['update_node', { id: 'sys', label: 'Billing Platform', properties: {} }],
      ['update_node', { id: 'api', type: 'system' }],                                  // retype
      ['update_relation', { id: someRelation.id, label: 'renamed' }],
      ['create_view', { tempId: 'v', name: 'Billing', nodeIds: ['sys', 'api', 'sys', 'ghost'], kind: 'table', active: true }],
      ['add_node', { tempId: 'db', type: 'container', label: 'Ledger', parentId: 'sys' }], // lands in the active view
      ['set_view_nodes', { id: 'v', nodeIds: ['db', 'sys'] }],
      ['delete_relation', { id: someRelation.id }],
      ['delete_node', { id: 'sys' }],                                                  // cascades
      ['set_active_view', { id: null }],
      ['delete_view', { id: 'v' }],
    ]

    const a = run(createStoreFacade(), calls)
    const b = run(headless, calls)

    const na = normalize(useDiagramStore.getState().saveDiagram(), a.tempToReal)
    const nb = normalize(headless.toDiagramData(), b.tempToReal)

    expect(b.results.map((r) => [r.ok, nb.text(r.resultText)]))
      .toEqual(a.results.map((r) => [r.ok, na.text(r.resultText)]))
    // The scenario must actually exercise refusals and successes
    expect(a.results.some((r) => !r.ok)).toBe(true)
    expect(a.results.filter((r) => r.ok).length).toBeGreaterThan(10)

    expect(nb.nodes).toEqual(na.nodes)
    expect(nb.relations).toEqual(na.relations)
    expect(nb.views).toEqual(na.views)
  })

  it('resets like the store does', () => {
    useDiagramStore.getState().loadDiagram(blueprintDoc as unknown as DiagramData)
    const start = useDiagramStore.getState().saveDiagram()
    const headless = createModelFacade(start)
    run(createStoreFacade(), [['reset_diagram', {}]])
    run(headless, [['reset_diagram', {}]])
    const saved = useDiagramStore.getState().saveDiagram()
    const out = headless.toDiagramData()
    expect([out.nodes, out.relations, out.views]).toEqual([saved.nodes, saved.relations, saved.views ?? []])
    expect(out.metamodel?.id).toBe(saved.metamodel?.id)
  })
})
