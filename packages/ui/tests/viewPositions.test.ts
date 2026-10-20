/**
 * What a view keeps of the canvas positions: only those of the nodes it
 * draws (its nodes and their ancestors). Shown as a table, wiki, matrix,
 * hierarchy or flow, it keeps those it had, not the canvas shown with it.
 * The canvas keeps one set of positions in the nodes, and every node's used
 * to go into each view.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { useDiagramStore } from '../src/store/diagramStore'
import { viewCanvasPositions, withCanvasPositions, type C4Node, type DiagramView } from '@radical/common/c4'

const s = () => useDiagramStore.getState()
const node = (id: string, type: C4Node['type'], x: number, parentId?: string): C4Node =>
  ({ id, type, label: id, x, y: 0, width: 160, height: 80, ...(parentId ? { parentId } : {}) }) as C4Node
const nodes = [node('user', 'person', 0), node('shop', 'system', 300), node('web', 'container', 320, 'shop'), node('db', 'container', 520, 'shop'), node('bank', 'system', 900)]
const all = Object.fromEntries(nodes.map((n) => [n.id, { x: n.x, y: n.y, width: n.width, height: n.height }]))
const view = (id: string, nodeIds: string[], kind?: DiagramView['kind']): DiagramView => ({ id, name: id, nodeIds, positions: { ...all }, ...(kind ? { kind } : {}) })

beforeEach(() => {
  s().loadDiagram({ nodes, relations: [], views: [view('ctx', ['web', 'bank']), view('table', ['user'], 'table'), view('every', [])] })
  useDiagramStore.setState({ appMode: 'designer' } as any)
})

describe('view positions', () => {
  it('keeps those of the nodes a canvas draws, its own for other kinds, all for a view of every node', () => {
    const byId = Object.fromEntries(nodes.map((n) => [n.id, n]))
    expect(Object.keys(viewCanvasPositions(view('v', ['web', 'bank']), byId, all)).sort()).toEqual(['bank', 'shop', 'web'])
    const wiki = { ...view('v', ['web'], 'wiki'), positions: { web: all.web } }
    expect(viewCanvasPositions(wiki, byId, { ...all, web: { ...all.web, x: 1 } })).toEqual({ web: all.web })
    expect(viewCanvasPositions({ ...wiki, positions: {} }, byId, all)).toEqual({})
    expect(viewCanvasPositions(view('v', []), byId, all)).toBe(all)
    const trimmed = view('v', ['bank'])
    trimmed.positions = { bank: all.bank }
    expect(withCanvasPositions([trimmed], byId)[0]).toBe(trimmed)
  })

  it('a view of a filter chain keeps those of what its chain draws, on load too', () => {
    // A view of a viewpoint lists no nodes: its chain decides what it draws.
    const chained: DiagramView = { ...view('chain', []), pipeline: { levels: [{ ways: [{ types: ['container'] }] }] } }
    s().loadDiagram({ nodes, relations: [], views: [chained] })
    expect(Object.keys(s().views.chain.positions).sort()).toEqual(['db', 'shop', 'web'])
    const byId = Object.fromEntries(nodes.map((n) => [n.id, n]))
    expect(Object.keys(viewCanvasPositions(chained, byId, all, ['web'])).sort()).toEqual(['shop', 'web'])
  })

  it('a document that kept every position in each view drops the rest on load', () => {
    expect(Object.keys(s().views.ctx.positions).sort()).toEqual(['bank', 'shop', 'web'])
    expect(Object.keys(s().views.table.positions)).toEqual(['user'])
    expect(Object.keys(s().views.every.positions)).toHaveLength(nodes.length)
  })

  it('leaving a view saves only the positions it draws', () => {
    s().setActiveView('ctx')
    useDiagramStore.setState((st: any) => { st.c4Nodes.bank.x = 1234; st.c4Nodes.user.x = 777 })
    s().setActiveView(null)
    expect(s().views.ctx.positions.bank.x).toBe(1234)
    expect(Object.keys(s().views.ctx.positions).sort()).toEqual(['bank', 'shop', 'web'])
    // A table view draws no positions: it keeps its own, not the canvas
    // shown with it.
    s().setActiveView('table')
    useDiagramStore.setState((st: any) => { st.c4Nodes.user.x = 555 })
    s().setActiveView(null)
    expect(s().views.table.positions).toEqual({ user: all.user })
  })

  it('an element added to a view later gets a place there', () => {
    s().setActiveView('ctx')
    s().addNodeToView('ctx', 'user')
    const user = s().c4Nodes.user
    expect(Number.isFinite(user.x) && Number.isFinite(user.y)).toBe(true)
    s().setActiveView(null)
    expect(s().views.ctx.positions.user).toBeDefined()
  })

  it('a view shown as a table keeps its canvas positions, through a reload and a view switch', () => {
    // System Context → Table → reload or another view → Structure: the
    // layout it had, not All elements' places.
    for (const via of ['reload', 'switch'] as const) {
      s().loadDiagram({ nodes, relations: [], views: [view('ctx', ['web', 'bank'])] })
      s().setActiveView('ctx')
      useDiagramStore.setState((st: any) => { st.c4Nodes.bank.x = 1234 })
      s().setViewKind('ctx', 'table')
      if (via === 'reload') {
        s().loadDiagram(s().saveDiagram())
        s().setActiveView('ctx')
      } else {
        s().setActiveView(null)
        s().setActiveView('ctx')
      }
      s().setViewKind('ctx', 'static')
      expect(s().c4Nodes.bank.x, via).toBe(1234)
      expect(s().c4Nodes.web.x, via).toBe(320)
    }
  })
})
