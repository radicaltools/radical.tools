/**
 * What a view keeps of the canvas positions: only those of the nodes it
 * draws (its nodes and their ancestors) when it is a canvas, none when it is
 * a table, wiki, matrix, hierarchy or flow view. The canvas keeps one set of
 * positions in the nodes, and every node's used to go into each view.
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
  it('keeps those of the nodes a canvas draws, none for other kinds, all for a view of every node', () => {
    const byId = Object.fromEntries(nodes.map((n) => [n.id, n]))
    expect(Object.keys(viewCanvasPositions(view('v', ['web', 'bank']), byId, all)).sort()).toEqual(['bank', 'shop', 'web'])
    expect(viewCanvasPositions(view('v', ['web'], 'wiki'), byId, all)).toEqual({})
    expect(viewCanvasPositions(view('v', []), byId, all)).toBe(all)
    const trimmed = view('v', ['bank'])
    trimmed.positions = { bank: all.bank }
    expect(withCanvasPositions([trimmed], byId)[0]).toBe(trimmed)
  })

  it('a document that kept every position in each view drops the rest on load', () => {
    expect(Object.keys(s().views.ctx.positions).sort()).toEqual(['bank', 'shop', 'web'])
    expect(s().views.table.positions).toEqual({})
    expect(Object.keys(s().views.every.positions)).toHaveLength(nodes.length)
  })

  it('leaving a view saves only the positions it draws', () => {
    s().setActiveView('ctx')
    useDiagramStore.setState((st: any) => { st.c4Nodes.bank.x = 1234; st.c4Nodes.user.x = 777 })
    s().setActiveView(null)
    expect(s().views.ctx.positions.bank.x).toBe(1234)
    expect(Object.keys(s().views.ctx.positions).sort()).toEqual(['bank', 'shop', 'web'])
    // A table view draws no positions and keeps none.
    s().setActiveView('table')
    s().setActiveView(null)
    expect(s().views.table.positions).toEqual({})
  })

  it('an element added to a view later gets a place there', () => {
    s().setActiveView('ctx')
    s().addNodeToView('ctx', 'user')
    const user = s().c4Nodes.user
    expect(Number.isFinite(user.x) && Number.isFinite(user.y)).toBe(true)
    s().setActiveView(null)
    expect(s().views.ctx.positions.user).toBeDefined()
  })
})
