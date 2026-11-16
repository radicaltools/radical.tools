/**
 * Keep smart by default and in Viewer (scenario "Keep smart by default and
 * in Viewer"; ADR "A view can keep itself tidied").
 *
 * Covers:
 *   - a view with no Keep smart setting of its own follows the default in
 *     Settings: switched on, the view shown is tidied at once and after
 *     each add; a view with off saved with it is not
 *   - switching it in Designer saves on or off with the view, which holds
 *     over the default; null takes the setting away again; off survives the
 *     Markdown folder
 *   - in Viewer the switch tidies the view after an agent's add and saves
 *     nothing: back in Designer the view's setting and places are as saved
 *   - the default is kept in the studio settings
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { NODE_SIZES, type C4Node, type DiagramData } from '@radical/common/c4'
import { deserializeFromMdFolder, serializeToMdFolder } from '@radical/common/formats/mdFolder'
import { loadStudioSettings } from '../src/studioSettings'
import { CONTINUOUS_DELAY_MS, continuousLayoutBusy, keepsSmart, useDiagramStore } from '../src/store/diagramStore'

// Studio settings live in localStorage, which node doesn't have.
const memory = new Map<string, string>()
;(globalThis as any).localStorage ??= {
  getItem: (k: string) => memory.get(k) ?? null,
  setItem: (k: string, v: string) => { memory.set(k, v) },
}

const s = useDiagramStore.getState
const wait = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))
const size = NODE_SIZES.system
const sys = (id: string, x: number, y: number): C4Node =>
  ({ id, type: 'system', label: id, collapsed: false, x, y, ...size } as C4Node)
const at = (id: string) => ({ x: s().c4Nodes[id].x, y: s().c4Nodes[id].y })
const places = () => Object.fromEntries(Object.keys(s().c4Nodes).sort().map((id) => [id, at(id)]))
const gap = (a: string, b: string) => Math.hypot(at(a).x - at(b).x, at(a).y - at(b).y)

async function settled(): Promise<void> {
  for (let i = 0; i < 400; i++) {
    await wait(50)
    if (!continuousLayoutBusy() && !s().isLayoutRunning) return
  }
  throw new Error('continuous layout never settled')
}

/** Spread apart, so a tidying draws them in: `free` has no setting, `off` is off. */
function model(): DiagramData {
  const spread = { a: { x: 0, y: 0, ...size }, b: { x: 400, y: 0, ...size }, c: { x: 7000, y: 6000, ...size } }
  return {
    nodes: [sys('a', 0, 0), sys('b', 400, 0), sys('c', 7000, 6000)],
    relations: [{ id: 'ab', sourceId: 'a', targetId: 'b' }, { id: 'bc', sourceId: 'b', targetId: 'c' }],
    views: [
      { id: 'free', name: 'No setting', nodeIds: ['a', 'b', 'c'], positions: structuredClone(spread) },
      { id: 'off', name: 'Off', nodeIds: ['a', 'b', 'c'], positions: structuredClone(spread), continuousLayout: false },
    ],
  }
}

/** The folder, as saved in `disk`, changed outside Studio (an agent's
 *  write) and read back. */
function agentAdds(disk: DiagramData, view: string, id: string): void {
  const data = structuredClone(disk)
  data.nodes.push(sys(id, 6000, 5000))
  data.relations.push({ id: `c${id}`, sourceId: 'c', targetId: id })
  const v = data.views!.find((x) => x.id === view)!
  v.nodeIds.push(id)
  v.positions[id] = { x: 6000, y: 5000, ...size }
  s().loadDiagram(data, { outsideChange: true })
  s().setActiveView(view)
}

describe('Keep smart by default and in Viewer', () => {
  beforeEach(async () => {
    memory.clear()
    s().setKeepSmartDefault(false)
    s().setAppMode('designer')
    s().loadDiagram(model())
    s().setActiveView('free')
    await wait(CONTINUOUS_DELAY_MS * 2)
  })
  afterEach(() => {
    s().setAppMode('designer')
    s().setKeepSmartDefault(false)
    s().stopLiveLayout()
    memory.clear()
  })

  it('a view without a setting follows the default; its own on or off holds over it', async () => {
    expect(keepsSmart(s(), s().views.free)).toBe(false)
    await wait(CONTINUOUS_DELAY_MS * 3)
    expect(at('c'), 'default off: nothing moves').toEqual({ x: 7000, y: 6000 })

    s().setKeepSmartDefault(true)
    expect(loadStudioSettings().keepSmart, 'kept in the studio settings').toBe(true)
    await settled()
    expect(gap('b', 'c'), 'switched on, the view shown is tidied at once').toBeLessThan(1500)
    expect(s().views.free.continuousLayout, 'nothing saved with the view').toBeUndefined()

    // A view with off saved with it stays as it is after an add.
    s().setActiveView('off')
    expect(keepsSmart(s(), s().views.off)).toBe(false)
    const d = s().addNode({ type: 'system', label: 'D', collapsed: false, x: 5000, y: 4000, ...size } as Omit<C4Node, 'id'>)
    await wait(CONTINUOUS_DELAY_MS * 3)
    expect(continuousLayoutBusy() || s().isLayoutRunning).toBe(false)
    expect(at(d)).toEqual({ x: 5000, y: 4000 })
    expect(at('c')).toEqual({ x: 7000, y: 6000 })

    // Switched off in Designer, off is saved and holds over the default.
    s().setActiveView('free')
    s().setViewContinuousLayout('free', false)
    expect(s().views.free.continuousLayout).toBe(false)
    const read = deserializeFromMdFolder(serializeToMdFolder(s().saveDiagram())).data
    expect(read.views!.find((v) => v.id === 'free')!.continuousLayout, 'off survives the folder').toBe(false)
    expect(read.views!.find((v) => v.id === 'off')!.continuousLayout).toBe(false)
    const e = s().addNode({ type: 'system', label: 'E', collapsed: false, x: 9000, y: 8000, ...size } as Omit<C4Node, 'id'>)
    expect(s().views.free.nodeIds).toContain(e)
    s().addRelation({ sourceId: 'a', targetId: e })
    await wait(CONTINUOUS_DELAY_MS * 3)
    expect(continuousLayoutBusy() || s().isLayoutRunning).toBe(false)
    expect(at(e), 'off: nothing moves after a change').toEqual({ x: 9000, y: 8000 })

    // No setting again: the default holds, and the view is tidied.
    s().setViewContinuousLayout('free', null)
    expect('continuousLayout' in s().views.free).toBe(false)
    await settled()
    expect(gap('a', e)).toBeLessThan(1500)
  }, 60_000)

  it('in Viewer the switch tidies the view after an agent\'s add and saves nothing', async () => {
    s().setActiveView('off')
    const saved = structuredClone(s().views.off.positions)
    const disk = structuredClone(s().saveDiagram())
    s().setAppMode('viewer')
    s().setActiveView('off')
    expect(keepsSmart(s(), s().views.off)).toBe(false)
    // The canvas Viewer opened on is taken as it is (a person clicks later).
    await wait(CONTINUOUS_DELAY_MS * 2)
    expect(at('c'), 'Viewer opens the view as saved').toEqual({ x: 7000, y: 6000 })

    s().setViewerKeepSmart('off', true)
    expect(keepsSmart(s(), s().views.off)).toBe(true)
    expect(s().views.off.continuousLayout, 'the view keeps its own setting').toBe(false)
    await settled()
    expect(gap('b', 'c'), 'switched on, the view is tidied at once').toBeLessThan(1500)

    agentAdds(disk, 'off', 'e')
    expect(at('e')).toEqual({ x: 6000, y: 5000 })
    await settled()
    expect(gap('c', 'e'), "the agent's element drawn in").toBeLessThan(1500)

    s().setAppMode('designer')
    s().setActiveView('off')
    expect(s().viewerKeepSmart).toEqual({})
    expect(s().views.off.continuousLayout).toBe(false)
    for (const id of ['a', 'b', 'c'] as const) {
      expect(s().views.off.positions[id], `${id} as saved`).toMatchObject({ x: saved[id].x, y: saved[id].y })
    }
  }, 60_000)

  it('the Viewer switch is refused outside Viewer', () => {
    s().setViewerKeepSmart('free', true)
    expect(s().viewerKeepSmart).toEqual({})
  })
})
