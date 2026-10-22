/**
 * An element moved into another parent lies inside it on every canvas.
 *
 * Each canvas (All elements, every view) keeps its own positions, relative
 * to the parent. A move rebased the element's place on the canvas shown
 * only: the others kept its old parent-relative place, now read against
 * the new parent. Quote FX indented under Validate in the Warnier view
 * stood on Payment Process at its old offset in the process, which there
 * put it inside Approve, over Hold for review.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import type { C4Node, DiagramData, NodePosition } from '@radical/common/c4'
import { useDiagramStore } from '../src/store/diagramStore'
// Copies of the e2e suite's bookstore and Studio's sample model
// (tests/fixtures): a workspace imports no file of another.
import bookstoreText from './fixtures/bookstore.radical?raw'

const s = useDiagramStore.getState
const pos = (x: number, y: number, width: number, height: number): NodePosition => ({ x, y, width, height })
const node = (id: string, type: string, parentId: string | undefined, p: NodePosition): C4Node =>
  ({ id, type, label: id, collapsed: false, ...(parentId ? { parentId } : {}), ...p }) as C4Node

/** A process with three steps in a row, Hold inside Approve. The view
 *  "flow" draws them in a column instead; "outline" is a Warnier view. */
function model(): DiagramData {
  const all = {
    pay: pos(0, 0, 1180, 520),
    validate: pos(30, 120, 300, 200),
    fx: pos(360, 120, 300, 200),
    approve: pos(690, 120, 460, 370),
    hold: pos(30, 120, 300, 200),
  }
  return {
    nodes: [
      node('pay', 'process', undefined, all.pay),
      node('validate', 'step', 'pay', all.validate),
      node('fx', 'step', 'pay', all.fx),
      node('approve', 'step', 'pay', all.approve),
      node('hold', 'step', 'approve', all.hold),
    ],
    relations: [],
    views: [
      {
        id: 'flow', name: 'Flow', nodeIds: ['pay', 'validate', 'fx', 'approve', 'hold'],
        positions: {
          pay: pos(0, 0, 520, 1180),
          validate: pos(30, 120, 300, 200),
          fx: pos(30, 360, 300, 200),
          approve: pos(30, 600, 460, 370),
          hold: pos(30, 120, 300, 200),
        },
      },
      { id: 'outline', name: 'Outline', kind: 'warnier', nodeIds: [], positions: {} },
    ],
    defaultPositions: all,
  }
}

interface Box { x: number; y: number; width: number; height: number }
const box = (id: string): Box => {
  const n = s().c4Nodes[id]
  return { x: n.x, y: n.y, width: n.width, height: n.height }
}
const abs = (id: string): Box => {
  const b = box(id)
  for (let p = s().c4Nodes[id].parentId; p; p = s().c4Nodes[p].parentId) { b.x += s().c4Nodes[p].x; b.y += s().c4Nodes[p].y }
  return b
}
const overlap = (a: Box, b: Box): boolean =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height
/** `child` lies inside the frame of its parent. */
const inside = (child: string): boolean => {
  const c = box(child)
  const p = box(s().c4Nodes[child].parentId!)
  return c.x >= 0 && c.y >= 0 && c.x + c.width <= p.width && c.y + c.height <= p.height
}

beforeEach(() => {
  s().setAppMode('designer')
  s().loadDiagram(model())
})
afterEach(() => s().stopLiveLayout())

describe('a step indented in the Warnier view', () => {
  const indent = (): void => {
    s().setActiveView('outline')
    s().reparentNodes(['fx'], 'validate', { quiet: true })
    expect(s().c4Nodes.fx.parentId).toBe('validate')
  }

  it('lies inside its new parent on a view, clear of the other steps', () => {
    indent()
    s().setActiveView('flow')
    expect(inside('fx')).toBe(true)
    expect(inside('validate')).toBe(true)
    expect(overlap(abs('fx'), abs('approve'))).toBe(false)
    expect(overlap(abs('fx'), abs('hold'))).toBe(false)
  })

  it('lies inside its new parent on All elements', () => {
    s().setActiveView('flow')
    indent()
    s().setActiveView(null)
    expect(inside('fx')).toBe(true)
    expect(inside('validate')).toBe(true)
    expect(overlap(abs('fx'), abs('approve'))).toBe(false)
  })

  it('the same after a save and a reload', () => {
    indent()
    const saved = JSON.parse(JSON.stringify(s().saveDiagram())) as DiagramData
    s().loadDiagram(saved)
    s().setActiveView('flow')
    expect(inside('fx')).toBe(true)
    expect(overlap(abs('fx'), abs('hold'))).toBe(false)
  })
})

describe('a step outdented in the Warnier view', () => {
  // It lay inside its old parent, which is now beside it: it keeps no place
  // there, and goes beside its new siblings, clear of them.
  it('lies clear of its old parent on every canvas', () => {
    s().setActiveView('outline')
    s().reparentNodes(['hold'], 'pay', { quiet: true })
    expect(s().c4Nodes.hold.parentId).toBe('pay')
    for (const canvas of ['flow', null, 'flow']) {
      s().setActiveView(canvas)
      expect(inside('hold'), String(canvas)).toBe(true)
      expect(overlap(abs('hold'), abs('approve')), String(canvas)).toBe(false)
      expect(overlap(abs('hold'), abs('fx')), String(canvas)).toBe(false)
    }
  })
})

/** Two domains side by side at the root, holding systems, and a loose
 *  system below the first; a view draws them all, the loose one elsewhere. */
function roots(): DiagramData {
  const all = {
    a: pos(0, 0, 690, 340),
    a1: pos(30, 120, 300, 200),
    a2: pos(360, 120, 300, 200),
    b: pos(730, 0, 360, 340),
    b1: pos(30, 120, 300, 200),
    loose: pos(0, 420, 300, 200),
  }
  const ids = Object.keys(all) as Array<keyof typeof all>
  return {
    nodes: [
      node('a', 'domain', undefined, all.a),
      node('a1', 'system', 'a', all.a1),
      node('a2', 'system', 'a', all.a2),
      node('b', 'domain', undefined, all.b),
      node('b1', 'system', 'b', all.b1),
      node('loose', 'system', undefined, all.loose),
    ],
    relations: [],
    views: [{ id: 'other', name: 'Other', nodeIds: [...ids], positions: { ...all, loose: pos(200, 500, 300, 200) } }],
    defaultPositions: all,
  }
}

/** Pairs of siblings drawn on top of each other, and children outside
 *  their parent, on the canvas shown. */
const violations = (): string[] => {
  const nodes = s().c4Nodes
  const ids = Object.keys(nodes)
  const out: string[] = []
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      if (nodes[ids[i]].parentId === nodes[ids[j]].parentId && overlap(abs(ids[i]), abs(ids[j]))) out.push(`${ids[i]} ~ ${ids[j]}`)
    }
  }
  for (const id of ids) if (nodes[id].parentId && !inside(id)) out.push(`${id} outside`)
  return out
}

describe('Move to… a container', () => {
  beforeEach(() => s().loadDiagram(roots()))

  it('places what lies outside it inside, beside what it holds, and makes room for it', () => {
    const b = abs('b')
    s().reparentNodes(['loose'], 'a', { quiet: true })
    expect(violations()).toEqual([])
    // A grew to the right, over where B stood: B moved out of its way.
    expect(abs('b').x).toBeGreaterThan(b.x)
    expect(abs('b').y).toBe(b.y)
  })

  it('does so on the other canvases too', () => {
    s().reparentNodes(['loose'], 'a', { quiet: true })
    s().setActiveView('other')
    expect(violations()).toEqual([])
    s().setActiveView(null)
    expect(violations()).toEqual([])
  })

  // The other canvases had no place for it until they were opened: the
  // place was made then, and the live layout settled it with its
  // surroundings (Payment Provider moved into Bookstore on All elements:
  // opening Containers moved Customer by (−179, −82)).
  it('gives it its place on the other canvases at once: opening one moves nothing there', () => {
    s().reparentNodes(['loose'], 'a', { quiet: true })
    const other = () => JSON.parse(JSON.stringify(s().saveDiagram().views!.find((v) => v.id === 'other')!.positions)) as Record<string, NodePosition>
    const there = other()
    expect(there.loose).toBeDefined()
    expect(there.loose.x >= 0 && there.loose.y >= 0 && there.loose.x + there.loose.width <= there.a.width && there.loose.y + there.loose.height <= there.a.height).toBe(true)
    s().setActiveView('other')
    expect(other()).toEqual(there)
    expect(violations()).toEqual([])
  })

  it('keeps the place of what lies inside it, clear of what it holds', () => {
    useDiagramStore.setState((st: any) => {
      st.c4Nodes.a.width = 1100
      st.c4Nodes.b.x = 1140
      st.c4Nodes.loose.x = 720
      st.c4Nodes.loose.y = 120
    })
    s().reparentNodes(['loose'], 'a', { quiet: true })
    expect(abs('loose')).toMatchObject({ x: 720, y: 120 })
    expect(violations()).toEqual([])
  })
})

describe('Move to… a container the view draws with nothing in it', () => {
  // The view lists S2 without what it holds: S2 is drawn at its folded
  // size, though it keeps its open one (600 × 330). S1 moved into it grew
  // it from the size it keeps, which counted as no growth: no room was
  // made, and S2 lay over S3 just below it (System 0 moved into System 1
  // on a System context view, over Operator).
  it('grows it from the size it is drawn at, and makes room for it', () => {
    const data = folds(false)
    data.views = [{
      id: 'roots', name: 'Roots', nodeIds: ['s1', 's2', 's3'],
      positions: { ...JSON.parse(JSON.stringify(data.defaultPositions)), s3: pos(400, 220, 300, 180) },
    }]
    s().loadDiagram(data)
    s().setActiveView('roots')
    s().reparentNodes(['s1'], 's2', { quiet: true })
    expect(s().c4Nodes.s1.parentId).toBe('s2')
    expect(inside('s1')).toBe(true)
    expect(overlap(abs('s2'), abs('s3'))).toBe(false)
  })
})

describe('Move to… a container in a row, on a view that does not draw it', () => {
  // System 0's containers are kept in a row on All elements. A component
  // moved into Container 0.0 on a view of systems and containers got its
  // place on All elements: Container 0.0 grew, and the room made for it put
  // Container 0.1 below it, off the row; read again, the row was snapped
  // and every container refit (Container 0.1 (840, 400) → (990, 120)).
  it('keeps the row on All elements, so a reload moves nothing there', () => {
    const comp = (x: number): NodePosition => pos(x, 120, 200, 120)
    const all: Record<string, NodePosition> = {
      s0: pos(0, 400, 2440, 440),
      c0: pos(40, 120, 760, 280), c0k0: comp(40), c0k1: comp(280), c0k2: comp(520),
      c1: pos(840, 120, 520, 280), c1k0: comp(40), c1k1: comp(280),
      c2: pos(1400, 120, 1000, 280), c2k0: comp(40), c2k1: comp(280), c2k2: comp(520), c2k3: comp(760),
      s1: pos(2560, 400, 1240, 440),
      d0: pos(40, 120, 520, 280), d0k0: comp(40), d0k1: comp(280),
    }
    const parents: Record<string, string> = { c0: 's0', c1: 's0', c2: 's0', d0: 's1' }
    const nodes = Object.entries(all).map(([id, p]) => {
      const parentId = parents[id] ?? (id.includes('k') ? id.slice(0, 2) : undefined)
      const type = id.startsWith('s') ? 'system' : id.includes('k') ? 'component' : 'container'
      return node(id, type, parentId, p)
    })
    s().loadDiagram({
      nodes,
      relations: [],
      views: [{ id: 'chain', name: 'Systems and containers', nodeIds: ['s0', 'c0', 'c1', 'c2', 's1', 'd0'], positions: {} }],
      defaultPositions: JSON.parse(JSON.stringify(all)),
      defaultLayoutConstraints: [{ id: 'row', type: 'align', axis: 'horizontal', nodeIds: ['c0', 'c1', 'c2'] }],
    })
    s().setActiveView('chain')
    s().reparentNodes(['d0k0'], 'c0', { quiet: true })
    const saved = JSON.parse(JSON.stringify(s().saveDiagram())) as DiagramData
    s().loadDiagram(JSON.parse(JSON.stringify(saved)) as DiagramData)
    s().setActiveView('chain')
    expect(s().saveDiagram().defaultPositions).toEqual(saved.defaultPositions)
    s().setActiveView(null)
    expect(violations()).toEqual([])
  })

  // Bookstore: API and Orders DB kept in a row, API moved into Payment
  // Provider on Containers: on All elements Payment Provider grew for it
  // and pushed Bookstore down, Orders DB with it, off the row; read again,
  // the row was snapped (Orders DB 37.5 px lower, Bookstore 17.5 px shorter).
  it('keeps a row through what moved, on All elements', () => {
    s().loadDiagram(JSON.parse(bookstoreText) as DiagramData)
    s().addAlignment('horizontal', ['api', 'db'])
    s().setActiveView('v-containers')
    s().reparentNodes(['api'], 'payments', { quiet: true })
    const saved = JSON.parse(JSON.stringify(s().saveDiagram())) as DiagramData
    s().loadDiagram(JSON.parse(JSON.stringify(saved)) as DiagramData)
    s().setActiveView('v-containers')
    expect(s().saveDiagram().defaultPositions).toEqual(saved.defaultPositions)
  })
})

describe('Move to… the root', () => {
  beforeEach(() => s().loadDiagram(roots()))

  it('places it clear of its old parent, on every canvas', () => {
    s().reparentNodes(['a2'], null, { quiet: true })
    expect(s().c4Nodes.a2.parentId).toBeUndefined()
    expect(violations()).toEqual([])
    s().setActiveView('other')
    expect(violations()).toEqual([])
  })
})

/** Root systems S1, S3; S2 holds Q0 and Q1. The view "folded" folds S2. */
function folds(modelFold: boolean): DiagramData {
  const all = {
    s1: pos(0, 400, 300, 180),
    s2: pos(400, 0, 600, 330),
    q0: pos(30, 120, 240, 150),
    q1: pos(330, 120, 240, 150),
    s3: pos(1100, 400, 300, 180),
  }
  const ids = Object.keys(all) as Array<keyof typeof all>
  return {
    nodes: [
      node('s1', 'system', undefined, all.s1),
      { ...node('s2', 'system', undefined, all.s2), collapsed: modelFold },
      node('q0', 'container', 's2', all.q0),
      node('q1', 'container', 's2', all.q1),
      node('s3', 'system', undefined, all.s3),
    ],
    relations: [],
    views: [{ id: 'folded', name: 'Folded', nodeIds: [...ids], positions: JSON.parse(JSON.stringify(all)), collapsedNodeIds: ['s2'] }],
    defaultPositions: JSON.parse(JSON.stringify(all)),
  }
}

describe('Move to… a folded container', () => {
  // S1 lay left of S2, outside its frame: its place, rebased onto S2, is no
  // place in it. Not drawn while S2 is folded, it kept it, and the expand
  // drew it left of S2, outside its parent.
  it('places it inside, beside what it holds, when the view folds it', () => {
    s().loadDiagram(folds(false))
    s().setActiveView('folded')
    s().reparentNodes(['s1'], 's2', { quiet: true })
    s().toggleCollapse('s2')
    expect(violations()).toEqual([])
  })

  it('places it inside, beside what it holds, when the model folds it', () => {
    s().loadDiagram(folds(true))
    s().setActiveView(null)
    s().reparentNodes(['s1'], 's2', { quiet: true })
    s().toggleCollapse('s2')
    expect(violations()).toEqual([])
  })
})

describe('Move to… with a row', () => {
  // A row [S1, S3] at the root; S1 moved into S2 stays in it (S3 is none
  // of its ancestors) but the row was not held until a reload, which then
  // moved six elements, the file unchanged.
  const rowModel = (): DiagramData => {
    const data = folds(false)
    const row = [{ id: 'row', type: 'align' as const, axis: 'horizontal' as const, nodeIds: ['s1', 's3'] }]
    data.views = [{ ...data.views![0], id: 'v', name: 'Row', collapsedNodeIds: [], layoutConstraints: row }]
    data.defaultLayoutConstraints = row
    return data
  }
  const centreY = (id: string): number => abs(id).y + abs(id).height / 2

  for (const canvas of ['v', null]) {
    it(`holds the row at once, as a reload draws it (${canvas ?? 'All elements'})`, () => {
      s().loadDiagram(rowModel())
      s().setActiveView(canvas)
      s().reparentNodes(['s1'], 's2', { quiet: true })
      expect(s().c4Nodes.s1.parentId).toBe('s2')
      expect(Math.abs(centreY('s1') - centreY('s3'))).toBeLessThanOrEqual(1)
      expect(violations()).toEqual([])
      const after = Object.fromEntries(Object.keys(s().c4Nodes).map((id) => [id, abs(id)]))
      s().loadDiagram(JSON.parse(JSON.stringify(s().saveDiagram())) as DiagramData)
      s().setActiveView(canvas)
      for (const id of Object.keys(after)) expect(abs(id), id).toEqual(after[id])
    })
  }
})
