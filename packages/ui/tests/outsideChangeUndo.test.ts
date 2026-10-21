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
import { mergeModels } from '@radical/common/modelMerge'
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

  it('brings back no step of a relation it leaves out (item 254)', () => {
    // "browses and orders" deleted, the agent deleted Bookstore, Undo: no
    // relation came back, but its step did, saved so.
    s().addRelation({ sourceId: 'a', targetId: 'b', label: 'charges card' })
    const rel = Object.keys(s().c4Relations)[0]
    const seq = s().addSequence('Order')
    s().toggleRelationInSequence(seq, rel)
    s().removeRelation(rel)
    expect(s().sequences[seq].relationIds).toEqual([])
    outsideChange((d) => {
      d.nodes = d.nodes.filter((n) => n.id !== 'a')
      for (const v of d.views ?? []) v.nodeIds = v.nodeIds.filter((id) => id !== 'a')
    })
    s().undo()
    expect(Object.values(s().c4Relations)).toEqual([])
    expect(s().sequences[seq].relationIds).toEqual([])
    expect(lastNotice()).toMatch(/outside Studio.*charges card/)
  })

  it('brings back no row, fold or hidden relation of what was removed outside Studio (item 254)', () => {
    s().setActiveView('one')
    s().addRelation({ sourceId: 'a', targetId: 'b', label: 'pays' })
    const rel = Object.keys(s().c4Relations)[0]
    s().addAlignment('horizontal', ['a', 'b'])
    const row = s().views.one.layoutConstraints![0].id
    s().toggleCollapse('a')
    s().hideRelationFromView('one', rel)
    // Undone after the agent removed A, these steps put back what they took.
    s().removeLayoutConstraint([row])
    s().toggleCollapse('a')
    s().unhideRelationInView('one', rel)
    outsideChange((d) => {
      d.nodes = d.nodes.filter((n) => n.id !== 'a')
      d.relations = []
      for (const v of d.views ?? []) v.nodeIds = v.nodeIds.filter((id) => id !== 'a')
    })
    s().undo()
    s().undo()
    s().undo()
    const view = s().views.one
    expect(view.layoutConstraints ?? []).toEqual([])
    expect(view.collapsedNodeIds ?? []).toEqual([])
    expect(view.hiddenRelationIds ?? []).toEqual([])
    expect(view.nodeIds).toEqual(['b'])
  })

  it('keeps an element the agent built on since its add, and says so (item 163)', () => {
    s().setActiveView('one')
    const id = s().addNode({ type: 'system', label: 'Shop', x: 1200, y: 0, ...NODE_SIZES.system, collapsed: false } as Omit<C4Node, 'id'>)
    outsideChange((d) => {
      d.nodes.push({ id: 'agent', type: 'container', label: 'Agent Container', parentId: id, collapsed: false, x: 40, y: 80, ...NODE_SIZES.container } as C4Node)
      d.relations.push({ id: 'uses', sourceId: 'a', targetId: id, label: 'uses' })
      d.views![0].nodeIds.push(id, 'agent')
    })
    s().undo()
    expect(label(id)).toBe('Shop')
    expect(label('agent')).toBe('Agent Container')
    expect(s().c4Relations.uses).toBeDefined()
    expect(s().views.one.nodeIds).toEqual(expect.arrayContaining([id, 'agent']))
    expect(lastNotice()).toMatch(/outside Studio.*Shop/)
    expect(lastNotice()).not.toMatch(/left out/)
    s().redo()
    expect(label('agent')).toBe('Agent Container')
    expect(s().c4Relations.uses).toBeDefined()
  })

  it('a relation the agent drew to an added element keeps the element too (item 163)', () => {
    const id = s().addNode({ type: 'system', label: 'Shop', x: 1200, y: 0, ...NODE_SIZES.system, collapsed: false } as Omit<C4Node, 'id'>)
    outsideChange((d) => { d.relations.push({ id: 'uses', sourceId: id, targetId: 'b', label: 'uses' }) })
    s().undo()
    expect(label(id)).toBe('Shop')
    expect(s().c4Relations.uses).toBeDefined()
  })

  it('a name typed while the agent writes is one step (item 164)', () => {
    s().beginTyping()
    for (const v of ['O', 'Or', 'Orders']) s().updateNode('a', { label: v })
    outsideChange((d) => { d.nodes.find((n) => n.id === 'b')!.description = 'agent wrote' })
    for (const v of ['Orders ', 'Orders A', 'Orders API']) s().updateNode('a', { label: v })
    s().endTyping()
    expect(label('a')).toBe('Orders API')
    s().undo()
    expect(label('a')).toBe('a')
    expect(s().c4Nodes.b.description).toBe('agent wrote')
    expect(s().canUndo).toBe(false)
    s().redo()
    expect(label('a')).toBe('Orders API')
  })

  it('takes back Keep in a row whole when the reload nudged the row (item 165)', () => {
    s().setActiveView('one')
    drag('b', { x: 900, y: 400 })
    s().addAlignment('horizontal', ['a', 'b'])
    const row = { a: at('a'), b: at('b') }
    expect(row.a.y).toBe(row.b.y)
    outsideChange((d) => {
      // The reload's enforcement of the row moves it by a hair.
      const p = d.views![0].positions!
      p.a = { ...p.a, y: p.a.y + 0.04 }
      p.b = { ...p.b, y: p.b.y + 0.04 }
      d.nodes.find((n) => n.id === 'b')!.description = 'agent wrote'
    })
    s().undo()
    expect(at('a')).toEqual({ x: 100, y: 100 })
    expect(at('b')).toEqual({ x: 900, y: 400 })
  })

  // The history was forgotten when the agent wrote while Designer was left
  // for the Inspector, the metamodel editor, Viewer or Presenter.
  for (const mode of ['inspector', 'metamodel', 'viewer', 'presenter'] as const) {
    it(`outlives an outside change while the ${mode} is open`, () => {
      s().updateNode('a', { label: 'Shop' })
      s().setAppMode(mode)
      outsideChange((d) => { d.nodes.find((n) => n.id === 'b')!.label = 'Bank' })
      s().setAppMode('designer')
      expect(s().canUndo).toBe(true)
      s().undo()
      expect(label('a')).toBe('a')
      expect(label('b')).toBe('Bank')
      s().redo()
      expect(label('a')).toBe('Shop')
    })
  }

  it('never brings back an element of a type deleted outside Studio', () => {
    s().upsertNodeType({ ...s().metamodel.nodeTypes.system, id: 'gizmo', label: 'Gizmo', builtin: false, properties: [] })
    const id = s().addNode({ type: 'gizmo', label: 'G', x: 0, y: 700, width: 200, height: 100, collapsed: false } as unknown as Omit<C4Node, 'id'>)
    s().removeNode(id)
    outsideChange((d) => {
      const { gizmo: _, ...nodeTypes } = d.metamodel!.nodeTypes
      d.metamodel = { ...d.metamodel!, id: 'custom', nodeTypes }
    })
    expect(s().metamodel.nodeTypes.gizmo).toBeUndefined()
    for (let i = 0; i < 4; i++) {
      s().undo()
      expect(Object.values(s().c4Nodes).some((n) => (n.type as string) === 'gizmo')).toBe(false)
    }
  })

  it('another model loaded still forgets the history', () => {
    s().updateNode('a', { label: 'Shop' })
    s().loadDiagram(model())
    expect(s().canUndo).toBe(false)
  })
})

describe('an outside change while a sequence is open', () => {
  beforeEach(() => {
    s().setAppMode('designer')
    s().loadDiagram(model())
  })
  afterEach(() => s().stopLiveLayout())

  it('keeps the sequence card open, unless the sequence is gone', () => {
    // An agent's write closed the sequence card.
    const seq = s().addSequence('Checkout')
    s().setActiveSequence(seq)
    outsideChange((d) => { d.nodes.push(sys('c', 0, 600, { label: 'Courier' })) })
    expect(s().activeSequenceId).toBe(seq)
    outsideChange((d) => { d.sequences = [] })
    expect(s().activeSequenceId).toBeNull()
  })
})

describe('an outside change while a milestone is shown (item 126)', () => {
  beforeEach(() => {
    s().setAppMode('designer')
    s().loadDiagram(model())
  })
  afterEach(() => s().stopLiveLayout())

  it('keeps the milestone shown and its edits, and brings the change into the live model', () => {
    s().updateNode('a', { label: 'Shop' })
    const m = s().createSnapshot('As-is')
    s().selectMilestone(m)
    s().updateNode('b', { label: 'Bank (as-is)' })
    expect(s().milestoneDirty).toBe(true)

    outsideChange((d) => { d.nodes.push(sys('c', 0, 600, { label: 'Courier' })) })
    expect(s().activeSnapshotId).toBe(m)
    expect(s().milestoneDirty).toBe(true)
    expect(label('b')).toBe('Bank (as-is)')
    expect(s().c4Nodes.c).toBeUndefined()
    expect(s().liveBackup?.nodes.c?.label).toBe('Courier')
    expect(s().saveDiagram().nodes.map((n) => n.id).sort()).toEqual(['a', 'b', 'c'])

    // The milestone's steps stay its own.
    s().undo()
    expect(label('b')).toBe('b')
    s().redo()
    expect(label('b')).toBe('Bank (as-is)')

    // Its edits saved as a new milestone; the live model has the change, and
    // its own steps take back the user's, not the agent's.
    s().commitMilestoneChanges('new', 'As-is 2')
    s().discardMilestoneChanges()
    expect(s().activeSnapshotId).toBeNull()
    expect(label('c')).toBe('Courier')
    expect(label('b')).toBe('b')
    expect(s().snapshots.find((x) => x.name === 'As-is 2')?.nodes.b.label).toBe('Bank (as-is)')
    // Making the milestone was a step of its own.
    s().undo()
    expect(s().snapshots.map((x) => x.name)).toEqual(['As-is 2'])
    expect(label('a')).toBe('Shop')
    s().undo()
    expect(label('a')).toBe('a')
    expect(label('c')).toBe('Courier')
  })

  it('takes back the milestone\'s steps and leaves the views as the change left them (item 262)', () => {
    // The agent moved Web App into another system (its place on Containers
    // dropped), a group added in the milestone, Undo: the live Containers
    // view had Web App's old place again.
    const m = s().createSnapshot('As-is')
    s().selectMilestone(m)
    s().updateNode('b', { label: 'Bank (as-is)' })
    outsideChange((d) => {
      const view = d.views![0]
      delete view.positions.a
      view.positions.b = { ...view.positions.b, x: 1200, y: 300 }
    })
    const views = () => structuredClone(s().saveDiagram().views)
    const after = views()
    expect(after![0].positions.a).toBeUndefined()
    s().undo()
    expect(label('b')).toBe('b')
    expect(views()).toEqual(after)
    s().redo()
    expect(label('b')).toBe('Bank (as-is)')
    expect(views()).toEqual(after)
  })

  it('says so when the milestone with edits was deleted outside Studio', () => {
    const m = s().createSnapshot('As-is')
    s().selectMilestone(m)
    s().updateNode('b', { label: 'Bank (as-is)' })
    outsideChange((d) => { d.snapshots = [] })
    expect(s().activeSnapshotId).toBeNull()
    expect(label('b')).toBe('b')
    expect(lastNotice()).toMatch(/As-is.*deleted outside Studio/)
  })
})

describe('Studio\'s edits merged with an outside change (item 264)', () => {
  // A queue dropped into Payment Provider, not saved yet, while the agent
  // moved Orders DB into it: each placed clear of what it had, and the
  // merge put both at (1140, 464.8).
  beforeEach(() => {
    s().setAppMode('designer')
    s().loadDiagram({
      nodes: [
        sys('shop', 0, 0, { width: 600, height: 400 }),
        { id: 'db', type: 'container', label: 'Orders DB', parentId: 'shop', collapsed: false, x: 40, y: 120, ...NODE_SIZES.container } as C4Node,
        sys('pay', 800, 0, { width: 400, height: 400 }),
        { id: 'gw', type: 'container', label: 'Gateway', parentId: 'pay', collapsed: false, x: 40, y: 120, ...NODE_SIZES.container } as C4Node,
      ],
      relations: [],
    })
  })
  afterEach(() => s().stopLiveLayout())

  const box = (id: string) => ({ ...s().c4Nodes[id], width: s().c4Nodes[id].width, height: s().c4Nodes[id].height })
  const overlaps = (a: string, b: string) => {
    const p = box(a), q = box(b)
    return p.x < q.x + q.width && q.x < p.x + p.width && p.y < q.y + q.height && q.y < p.y + p.height
  }

  it('moves what the change placed clear of what Studio placed there, inside the parent', () => {
    const base = throughFolder(structuredClone(s().saveDiagram()))
    const queue = s().addNode({ type: 'container', label: 'Queue', parentId: 'pay', x: 40, y: 280, ...NODE_SIZES.container, collapsed: false } as Omit<C4Node, 'id'>)
    const placed = { x: s().c4Nodes[queue].x, y: s().c4Nodes[queue].y }
    const theirs = structuredClone(base)
    const db = theirs.nodes.find((n) => n.id === 'db')!
    Object.assign(db, { parentId: 'pay', x: placed.x, y: placed.y })
    theirs.defaultPositions!.db = { x: placed.x, y: placed.y, width: db.width, height: db.height }
    const { merged } = mergeModels(base, structuredClone(s().saveDiagram()), theirs)
    s().loadDiagram(structuredClone(merged), { outsideChange: true })
    expect(s().c4Nodes.db.parentId).toBe('pay')
    // Studio's queue stays where it was dropped; Orders DB goes beside it.
    expect({ x: s().c4Nodes[queue].x, y: s().c4Nodes[queue].y }).toEqual(placed)
    expect(overlaps(queue, 'db')).toBe(false)
    expect(overlaps('gw', 'db')).toBe(false)
    const pay = box('pay'), d = box('db')
    expect(d.x).toBeGreaterThanOrEqual(0)
    expect(d.x + d.width).toBeLessThanOrEqual(pay.width)
    expect(d.y + d.height).toBeLessThanOrEqual(pay.height)
    expect(overlaps('shop', 'pay')).toBe(false)
    // Saved so: All elements' places are the settled ones.
    expect(s().saveDiagram().defaultPositions!.db).toMatchObject({ x: d.x, y: d.y })
  })

  it('makes room round what the change grew where Studio moved a neighbour next to it', () => {
    // Smart Layout not saved yet, the agent adds a container into Payment
    // Provider: the server grew it where the old layout had room, onto
    // Bookstore where Smart Layout put it.
    const base = throughFolder(structuredClone(s().saveDiagram()))
    drag('shop', { x: 800, y: 450 })
    const theirs = structuredClone(base)
    theirs.nodes.push({ id: 'job', type: 'container', label: 'Job', parentId: 'pay', collapsed: false, x: 40, y: 400, ...NODE_SIZES.container } as C4Node)
    theirs.defaultPositions!.job = { x: 40, y: 400, ...NODE_SIZES.container }
    theirs.nodes.find((n) => n.id === 'pay')!.height = 600
    theirs.defaultPositions!.pay = { ...theirs.defaultPositions!.pay, height: 600 }
    const { merged } = mergeModels(base, structuredClone(s().saveDiagram()), theirs)
    s().loadDiagram(structuredClone(merged), { outsideChange: true })
    expect(s().c4Nodes.pay.height).toBe(600)
    expect(overlaps('shop', 'pay')).toBe(false)
  })

  it('makes room on Undo where the step puts back an element where the change grew another', () => {
    drag('shop', { x: 800, y: 450 })
    drag('shop', { x: 0, y: 900 })
    // The agent adds a container into Payment Provider, which grows down.
    outsideFolderChange((d) => {
      d.nodes.push({ id: 'job', type: 'container', label: 'Job', parentId: 'pay', collapsed: false, x: 40, y: 400, ...NODE_SIZES.container } as C4Node)
      d.defaultPositions!.job = { x: 40, y: 400, ...NODE_SIZES.container }
      d.nodes.find((n) => n.id === 'pay')!.height = 600
      d.defaultPositions!.pay = { ...d.defaultPositions!.pay, height: 600 }
    })
    s().undo()
    expect(at('shop').x).toBe(800)
    expect(overlaps('shop', 'pay')).toBe(false)
  })

  it('leaves an overlap Studio had as it was', () => {
    s().loadDiagram({ nodes: [sys('a', 0, 0), sys('b', 100, 50)], relations: [] })
    const base = throughFolder(structuredClone(s().saveDiagram()))
    s().updateNode('a', { label: 'Shop' })
    const theirs = structuredClone(base)
    theirs.nodes.find((n) => n.id === 'b')!.description = 'agent wrote'
    const { merged } = mergeModels(base, structuredClone(s().saveDiagram()), theirs)
    s().loadDiagram(structuredClone(merged), { outsideChange: true })
    expect(at('a')).toEqual({ x: 0, y: 0 })
    expect(at('b')).toEqual({ x: 100, y: 50 })
  })
})
