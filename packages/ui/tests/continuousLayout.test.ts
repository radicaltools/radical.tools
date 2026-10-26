/**
 * Continuous layout: a view with continuousLayout on is tidied after each
 * change to what it shows (ADR "A view can keep itself tidied").
 *
 * Covers:
 *   - an add tidies the whole view, a pinned element stays where it was
 *     dropped, and the tidying is part of the add's undo step
 *   - undo, redo, a view switch and an outside change of positions only
 *     tidy nothing
 *   - an outside change (an agent's write reloaded) that adds an element
 *     tidies the view
 *   - switching it on tidies the view at once; the setting is saved with
 *     the view and read back from a folder
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { NODE_SIZES, pinnedNodeIds, type C4Node, type DiagramData } from '@radical/common/c4'
import { deserializeFromMdFolder, serializeToMdFolder } from '@radical/common/formats/mdFolder'
import { CONTINUOUS_DELAY_MS, continuousLayoutBusy, useDiagramStore } from '../src/store/diagramStore'

const s = useDiagramStore.getState
const wait = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))
const sys = (id: string, x: number, y: number): C4Node =>
  ({ id, type: 'system', label: id, collapsed: false, x, y, ...NODE_SIZES.system } as C4Node)
const at = (id: string) => ({ x: s().c4Nodes[id].x, y: s().c4Nodes[id].y })
const places = () => Object.fromEntries(Object.keys(s().c4Nodes).sort().map((id) => [id, at(id)]))
const gap = (a: string, b: string) => Math.hypot(at(a).x - at(b).x, at(a).y - at(b).y)

/** Waits for the view to be tidied and the elements to have glided there. */
async function settled(): Promise<void> {
  for (let i = 0; i < 400; i++) {
    await wait(50)
    if (!continuousLayoutBusy() && !s().isLayoutRunning) return
  }
  throw new Error('continuous layout never settled')
}

function model(continuous: boolean): DiagramData {
  const size = NODE_SIZES.system
  return {
    nodes: [sys('a', 0, 0), sys('b', 400, 0), sys('c', 800, 0)],
    relations: [{ id: 'ab', sourceId: 'a', targetId: 'b' }, { id: 'bc', sourceId: 'b', targetId: 'c' }],
    views: [
      {
        id: 'v', name: 'Kept tidy', nodeIds: ['a', 'b', 'c'],
        positions: { a: { x: 0, y: 0, ...size }, b: { x: 400, y: 0, ...size }, c: { x: 800, y: 0, ...size } },
        ...(continuous ? { continuousLayout: true } : {}),
      },
      {
        id: 'w', name: 'Also kept tidy', nodeIds: ['a', 'b'], continuousLayout: true,
        positions: { a: { x: 0, y: 0, ...size }, b: { x: 3000, y: 2000, ...size } },
      },
    ],
  }
}

/** What a drag does to the store (see dragUndo.test.ts). */
function drag(id: string, to: { x: number; y: number }): void {
  s().liveGrab(id, at(id).x, at(id).y, 'calm', at(id))
  useDiagramStore.setState((st) => ({ c4Nodes: { ...st.c4Nodes, [id]: { ...st.c4Nodes[id], ...to } } }))
  s().liveRelease(id, [], true)
}

/** The folder changed outside Studio (an agent's write), read back. */
function outsideChange(change: (data: DiagramData) => void): void {
  const data = structuredClone(s().saveDiagram())
  change(data)
  s().loadDiagram(data, { outsideChange: true })
  s().setActiveView('v')
}

describe('Continuous layout', () => {
  beforeEach(async () => {
    s().setAppMode('designer')
    s().loadDiagram(model(true))
    s().setActiveView('v')
    await wait(CONTINUOUS_DELAY_MS * 2)
  })
  afterEach(() => s().stopLiveLayout())

  it("tidies the whole view after an add, pins kept, in the add's undo step", async () => {
    // A drop pins and tidies the rest round it.
    drag('a', { x: 40, y: 40 })
    await settled()
    expect(pinnedNodeIds(s().views.v.layoutConstraints)).toEqual(['a'])
    expect(at('a')).toEqual({ x: 40, y: 40 })
    const before = places()

    const d = s().addNode({ type: 'system', label: 'D', collapsed: false, x: 5000, y: 4000, ...NODE_SIZES.system } as Omit<C4Node, 'id'>)
    expect(s().views.v.nodeIds).toContain(d)
    s().addRelation({ sourceId: 'a', targetId: d })
    await settled()
    expect(gap('a', d), 'the added element drawn in').toBeLessThan(1500)
    expect(at('a'), 'the pinned element stays').toEqual({ x: 40, y: 40 })
    expect(pinnedNodeIds(s().views.v.layoutConstraints)).toEqual(['a'])
    expect(s().notifications.some((n) => n.message.startsWith('Smart layout')), 'no notice').toBe(false)

    // Undo takes back the relation with the tidying it set off.
    s().undo()
    expect(Object.keys(s().c4Relations)).not.toContain(Object.keys(s().c4Relations).find((id) => s().c4Relations[id].targetId === d))
    expect(at(d)).toEqual({ x: 5000, y: 4000 })
    s().undo()
    expect(s().c4Nodes[d]).toBeUndefined()
    expect(places()).toEqual(before)
  }, 60_000)

  it('undo, redo, a view switch and a move tidy nothing', async () => {
    // An agent moves an element: a move is not a change to what is shown.
    outsideChange((data) => { data.views!.find((v) => v.id === 'v')!.positions.c = { x: 2000, y: 1500, ...NODE_SIZES.system } })
    expect(at('c')).toEqual({ x: 2000, y: 1500 })
    await wait(CONTINUOUS_DELAY_MS * 3)
    expect(continuousLayoutBusy() || s().isLayoutRunning).toBe(false)
    expect(at('c')).toEqual({ x: 2000, y: 1500 })

    // An add tidies the whole view, c too; Undo puts c back where the agent
    // left it, and it stays there.
    s().addNode({ type: 'system', label: 'D', collapsed: false, x: 5000, y: 4000, ...NODE_SIZES.system } as Omit<C4Node, 'id'>)
    await settled()
    const tidied = places()
    expect(gap('b', 'c')).toBeLessThan(1000)
    s().undo()
    const undone = places()
    expect(at('c')).toEqual({ x: 2000, y: 1500 })
    await wait(CONTINUOUS_DELAY_MS * 3)
    expect(places(), 'nothing moves after an undo').toEqual(undone)
    s().redo()
    await wait(CONTINUOUS_DELAY_MS * 3)
    expect(places(), 'redo gives back the tidied view, and nothing moves').toEqual(tidied)

    // Another view kept tidy is shown as it is.
    s().setActiveView('w')
    const shown = places()
    expect(at('b')).toEqual({ x: 3000, y: 2000 })
    await wait(CONTINUOUS_DELAY_MS * 3)
    expect(places()).toEqual(shown)
  }, 60_000)

  it('an outside reload that adds an element tidies the view', async () => {
    outsideChange((data) => {
      data.nodes.push(sys('e', 6000, 5000))
      data.relations.push({ id: 'ce', sourceId: 'c', targetId: 'e' })
      const v = data.views!.find((view) => view.id === 'v')!
      v.nodeIds.push('e')
      v.positions.e = { x: 6000, y: 5000, ...NODE_SIZES.system }
    })
    expect(at('e')).toEqual({ x: 6000, y: 5000 })
    await settled()
    expect(gap('c', 'e'), 'the agent\'s element drawn in').toBeLessThan(1500)
  }, 60_000)

  it('switching it on tidies the view and is saved with it', async () => {
    s().loadDiagram(model(false))
    s().setActiveView('v')
    // Spread far apart: Tidy draws them in.
    useDiagramStore.setState((st) => ({ c4Nodes: { ...st.c4Nodes, c: { ...st.c4Nodes.c, x: 7000, y: 6000 } } }))
    s()._saveShownCanvas()
    await wait(CONTINUOUS_DELAY_MS * 3)
    expect(at('c'), 'off: nothing moves').toEqual({ x: 7000, y: 6000 })

    s().setViewContinuousLayout('v', true)
    await settled()
    expect(gap('b', 'c')).toBeLessThan(1500)
    const saved = s().saveDiagram()
    expect(saved.views!.find((v) => v.id === 'v')!.continuousLayout).toBe(true)
    expect(saved.views!.find((v) => v.id === 'w')!.continuousLayout).toBe(true)
    const read = deserializeFromMdFolder(serializeToMdFolder(saved)).data
    expect(read.views!.find((v) => v.id === 'v')!.continuousLayout).toBe(true)

    // Undo switches it off and puts the view back as it was.
    s().undo()
    expect(s().views.v.continuousLayout).toBeUndefined()
    expect(at('c')).toEqual({ x: 7000, y: 6000 })
  }, 60_000)
})
