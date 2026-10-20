/**
 * Undo after an outside change. A folder model reloads whenever an agent (or
 * an editor, git) writes it, and the reload forgot the history: Undo stayed
 * grey for an agent's whole run, also for the user's own edits merged into
 * it. The history now outlives such a reload: Undo and Redo take back and
 * give back the user's steps on the model as it is now, and never take back
 * the outside change (item 36: a step that restored the model from before
 * the change undid the agent's edit).
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import type { C4Node, DiagramData } from '@radical/common/c4'
import { NODE_SIZES } from '@radical/common/c4'
import { deserializeFromMdFolder, serializeToMdFolder } from '@radical/common/formats/mdFolder'
import { useDiagramStore } from '../src/store/diagramStore'

const s = useDiagramStore.getState
const sys = (id: string, x: number, y: number, extra: Partial<C4Node> = {}): C4Node =>
  ({ id, type: 'system', label: id, collapsed: false, x, y, ...NODE_SIZES.system, ...extra } as C4Node)
const at = (id: string) => ({ x: s().c4Nodes[id].x, y: s().c4Nodes[id].y })
const label = (id: string) => s().c4Nodes[id]?.label

function model(): DiagramData {
  const size = NODE_SIZES.system
  return {
    nodes: [sys('a', 0, 0), sys('b', 600, 0)],
    relations: [],
    views: [{ id: 'one', name: 'One', nodeIds: ['a', 'b'], positions: { a: { x: 100, y: 100, ...size }, b: { x: 900, y: 100, ...size } } }],
  }
}

/** What a drag does to the store (see dragUndo.test.ts). */
function drag(id: string, to: { x: number; y: number }): void {
  s().liveGrab(id, at(id).x, at(id).y, 'calm', at(id))
  useDiagramStore.setState((st) => ({ c4Nodes: { ...st.c4Nodes, [id]: { ...st.c4Nodes[id], ...to } } }))
  s().liveRelease(id, [], true)
}

/** The folder changed outside Studio: what autosave reloads, the user's
 *  unsaved edits merged in, with `change` made to it. */
function outsideChange(change: (data: DiagramData) => void): void {
  const data = structuredClone(s().saveDiagram())
  change(data)
  const viewId = s().activeViewId
  s().loadDiagram(data, { outsideChange: true })
  if (viewId) s().setActiveView(viewId)
}

/** The model as the folder gives it back: what the store saves, written
 *  and read again (an empty text, an unticked box are written as nothing). */
const throughFolder = (data: DiagramData): DiagramData => deserializeFromMdFolder(serializeToMdFolder(data)).data

/** An outside change as Studio reads it from a folder. */
function outsideFolderChange(change: (data: DiagramData) => void): void {
  const viewId = s().activeViewId
  const data = throughFolder(structuredClone(s().saveDiagram()))
  change(data)
  s().loadDiagram(data, { outsideChange: true })
  if (viewId && s().views[viewId]) s().setActiveView(viewId)
}

const lastNotice = () => s().notifications[s().notifications.length - 1]?.message ?? ''

describe('Undo after an outside change', () => {
  beforeEach(() => {
    s().setAppMode('designer')
    s().loadDiagram(model())
  })
  afterEach(() => s().stopLiveLayout())

  it('takes back the user\'s steps and keeps the outside change; Redo gives them back', () => {
    s().updateNode('a', { label: 'Shop' })
    s().addNode({ type: 'system', label: 'Stock', x: 1200, y: 0, ...NODE_SIZES.system, collapsed: false } as Omit<C4Node, 'id'>)
    outsideChange((d) => {
      d.nodes.find((n) => n.id === 'b')!.label = 'Bank'
      d.nodes.push(sys('c', 0, 600, { label: 'Courier' }))
    })
    expect(s().canUndo).toBe(true)
    const stock = Object.values(s().c4Nodes).find((n) => n.label === 'Stock')!.id

    s().undo()
    expect(s().c4Nodes[stock]).toBeUndefined()
    expect(label('a')).toBe('Shop')
    s().undo()
    expect(label('a')).toBe('a')
    expect(s().canUndo).toBe(false)
    // The agent's edits stay all along.
    expect(label('b')).toBe('Bank')
    expect(label('c')).toBe('Courier')

    s().redo()
    expect(label('a')).toBe('Shop')
    s().redo()
    expect(label(stock)).toBe('Stock')
    expect(label('b')).toBe('Bank')
    expect(label('c')).toBe('Courier')
  })

  it('never takes back an outside change to what the step changed, and says so', () => {
    s().updateNode('a', { label: 'Shop' })
    outsideChange((d) => { d.nodes.find((n) => n.id === 'a')!.label = 'Bookshop' })
    s().undo()
    expect(label('a')).toBe('Bookshop')
    expect(s().notifications[s().notifications.length - 1]?.message).toMatch(/outside Studio.*Bookshop: label/)
  })

  it('takes back a drag on a view, on that view, with the agent\'s element still there', () => {
    s().setActiveView('one')
    drag('a', { x: 300, y: 400 })
    outsideChange((d) => {
      d.nodes.push(sys('c', 0, 600))
      d.views![0].nodeIds.push('c')
    })
    expect(at('a')).toEqual({ x: 300, y: 400 })
    s().undo()
    expect(s().activeViewId).toBe('one')
    expect(at('a')).toEqual({ x: 100, y: 100 })
    expect(at('b')).toEqual({ x: 900, y: 100 })
    expect(s().views.one.nodeIds).toContain('c')
    expect(s().c4Nodes.c).toBeDefined()
  })

  it('takes back an add after a folder round trip, with no notice (item 125)', () => {
    s().loadDiagram(throughFolder(s().saveDiagram()))
    const notices = s().notifications.length
    const id = s().addNode({ type: 'system', label: 'System', description: '', x: 1200, y: 0, ...NODE_SIZES.system, collapsed: false } as Omit<C4Node, 'id'>)
    outsideFolderChange((d) => { d.nodes.find((n) => n.id === 'b')!.description = 'agent wrote' })
    expect(s().c4Nodes[id]).toBeDefined()
    s().undo()
    expect(s().c4Nodes[id]).toBeUndefined()
    expect(s().c4Nodes.b.description).toBe('agent wrote')
    expect(s().notifications.length).toBe(notices)
  })

  it('takes back a new view after a folder round trip, with no notice (item 125)', () => {
    s().loadDiagram(throughFolder(s().saveDiagram()))
    const notices = s().notifications.length
    const id = s().addView('Fresh')
    s().addNodeToView(id, 'a')
    s().setActiveView(id)
    // The camera in use is saved with the view shown, not kept in the store.
    ;(window as any).__rfCurrentViewport = { x: 40, y: 20, zoom: 0.8 }
    try {
      outsideFolderChange((d) => { d.nodes.find((n) => n.id === 'b')!.description = 'agent wrote' })
    } finally {
      delete (window as any).__rfCurrentViewport
    }
    expect(s().views[id]).toBeDefined()
    s().undo()
    s().undo()
    expect(s().views[id]).toBeUndefined()
    expect(s().notifications.length).toBe(notices)
  })

  it('brings back no relation to an element removed outside Studio, and says so (item 127)', () => {
    s().addRelation({ sourceId: 'a', targetId: 'b', label: 'charges card' })
    s().removeNode('b')
    expect(Object.keys(s().c4Relations)).toEqual([])
    outsideChange((d) => { d.nodes = d.nodes.filter((n) => n.id !== 'a') })
    s().undo()
    expect(s().c4Nodes.b).toBeDefined()
    expect(s().c4Nodes.a).toBeUndefined()
    expect(Object.values(s().c4Relations)).toEqual([])
    expect(lastNotice()).toMatch(/outside Studio.*charges card/)
  })

  it('brings back no element whose container was removed outside Studio, and says so (item 127)', () => {
    const db = s().addNode({ type: 'container', label: 'Orders DB', parentId: 'a', x: 40, y: 80, ...NODE_SIZES.container, collapsed: false } as Omit<C4Node, 'id'>)
    s().addRelation({ sourceId: 'b', targetId: db, label: 'reads' })
    s().removeNode(db)
    outsideChange((d) => {
      d.nodes = d.nodes.filter((n) => n.id !== 'a')
      for (const v of d.views ?? []) v.nodeIds = v.nodeIds.filter((id) => id !== 'a')
    })
    s().undo()
    expect(s().c4Nodes[db]).toBeUndefined()
    expect(Object.values(s().c4Relations)).toEqual([])
    expect(s().views.one.nodeIds).not.toContain(db)
    expect(lastNotice()).toMatch(/outside Studio.*Orders DB/)
  })

  it('another model loaded still forgets the history', () => {
    s().updateNode('a', { label: 'Shop' })
    s().loadDiagram(model())
    expect(s().canUndo).toBe(false)
  })
})
