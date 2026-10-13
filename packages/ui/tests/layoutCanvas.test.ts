/**
 * A layout is for the canvas it was computed from. Smart Layout takes
 * seconds on a large view; when the user opened another view meanwhile, its
 * positions were written onto that view's elements and saved there, and the
 * view it was started on stayed as it was.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import type { C4Node, C4Relation, DiagramData } from '@radical/common/c4'
import { NODE_SIZES } from '@radical/common/c4'
import { useDiagramStore } from '../src/store/diagramStore'

const s = useDiagramStore.getState

/** Four related systems piled up, and a view of two of them laid out by hand. */
function model(): DiagramData {
  const sys = (id: string, x: number, y: number): C4Node =>
    ({ id, type: 'system', label: id, collapsed: false, x, y, ...NODE_SIZES.system } as C4Node)
  const nodes = [sys('a', 0, 0), sys('b', 20, 10), sys('c', 40, 20), sys('d', 60, 30)]
  const relations: C4Relation[] = [
    { id: 'ab', sourceId: 'a', targetId: 'b' },
    { id: 'bc', sourceId: 'b', targetId: 'c' },
    { id: 'cd', sourceId: 'c', targetId: 'd' },
  ]
  const at = (x: number, y: number) => ({ x, y, ...NODE_SIZES.system })
  return {
    nodes,
    relations,
    views: [{ id: 'pair', name: 'Pair', nodeIds: ['a', 'b'], positions: { a: at(1000, 1000), b: at(1600, 1000), c: at(0, 0), d: at(0, 0) } }],
  }
}

const places = (ids: string[]): Record<string, { x: number; y: number }> =>
  Object.fromEntries(ids.map((id) => [id, { x: s().c4Nodes[id].x, y: s().c4Nodes[id].y }]))

describe('A layout and the canvas it was started on', () => {
  beforeEach(() => {
    s().setAppMode('designer')
    s().loadDiagram(model())
  })
  afterEach(() => s().stopLiveLayout())

  it('is applied when the canvas is still the one shown', async () => {
    const before = places(['a', 'b', 'c', 'd'])
    await s().runSmartLayout()
    expect(places(['a', 'b', 'c', 'd'])).not.toEqual(before)
  }, 60_000)

  it('is dropped when another view was opened while it ran', async () => {
    const all = places(['a', 'b', 'c', 'd'])
    const running = s().runSmartLayout()
    s().setActiveView('pair')
    await running

    // The view opened meanwhile is as it was saved.
    expect(places(['a', 'b'])).toEqual({ a: { x: 1000, y: 1000 }, b: { x: 1600, y: 1000 } })
    expect(s().views.pair.positions.a).toMatchObject({ x: 1000, y: 1000 })
    // All elements was not given a layout computed for it behind the user's back either.
    s().setActiveView(null)
    expect(places(['a', 'b', 'c', 'd'])).toEqual(all)
    expect(s().isLayoutRunning).toBe(false)
    expect(s().notifications.some((n) => /was not applied/.test(n.message))).toBe(true)
  }, 60_000)

  it('is dropped when another model was loaded while it ran', async () => {
    const running = s().runSmartLayout()
    s().loadDiagram(model())
    const loaded = places(['a', 'b', 'c', 'd'])
    await running
    expect(places(['a', 'b', 'c', 'd'])).toEqual(loaded)
  }, 60_000)

  it('asks for a save at once in Designer, and for none in Viewer', async () => {
    let asked = 0
    const w = window as unknown as Record<string, unknown>
    const had = w.__radicalFlushPersist
    w.__radicalFlushPersist = async () => { asked++ }
    try {
      await s().runSmartLayout()
      expect(asked).toBe(1)
      s().loadDiagram(model())
      s().setAppMode('viewer')
      await s().runSmartLayout()
      expect(asked).toBe(1)
    } finally {
      s().setAppMode('designer')
      w.__radicalFlushPersist = had
    }
  }, 60_000)
})
