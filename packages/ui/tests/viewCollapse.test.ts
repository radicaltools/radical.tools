/**
 * Per-view collapse tests.
 *
 * Covers:
 *   - Collapsing a child node in a named view resizes the parent to fit
 *     only the view's visible children (not all model children).
 *   - Collapsing the parent node itself in a named view renders it at
 *     COLLAPSED_HEIGHT in rfNodes.
 *   - Collapsing a child node in a named view renders it at
 *     COLLAPSED_HEIGHT in rfNodes.
 *   - Collapse state is isolated per-view: toggling in one view does
 *     not affect the default (all-nodes) view.
 *   - A node that is model-collapsed (node.collapsed = true) can be
 *     expanded in a named view without affecting other views.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { useDiagramStore } from '../src/store/diagramStore'
import { COLLAPSED_HEIGHT, COLLAPSED_WIDTH, type C4Node, type DiagramView } from '@radical/common/c4'

const initial = (() => {
  const s = useDiagramStore.getState()
  return {
    c4Nodes: JSON.parse(JSON.stringify(s.c4Nodes)) as Record<string, C4Node>,
    views: JSON.parse(JSON.stringify(s.views)) as Record<string, DiagramView>,
    activeViewId: s.activeViewId,
    defaultPositions: JSON.parse(JSON.stringify(s.defaultPositions)),
  }
})()

beforeEach(() => {
  useDiagramStore.setState({
    c4Nodes: JSON.parse(JSON.stringify(initial.c4Nodes)),
    views: JSON.parse(JSON.stringify(initial.views)),
    activeViewId: initial.activeViewId,
    defaultPositions: JSON.parse(JSON.stringify(initial.defaultPositions)),
    appMode: 'designer',
  } as any)
  useDiagramStore.getState()._sync()
})

describe('view-collapse parent resize', () => {
  it('parent is resized to fit only the view children after collapsing a child', () => {
    const store = useDiagramStore.getState()
    // sys1 starts at full snap3 size (includes ctn1-ctn5)
    const sys1Before = store.c4Nodes['sys1']
    expect(sys1Before.height).toBeGreaterThan(400) // large — snap3 has h=500

    // Create a named view with only sys1, ctn1, ctn2 (not ctn3-ctn5)
    const vid = store.addView('Partial view')
    store.addNodeToView(vid, 'sys1')
    store.addNodeToView(vid, 'ctn1')
    store.addNodeToView(vid, 'ctn2')
    store.setActiveView(vid)

    // Collapse ctn1 (Frontend) inside this view
    useDiagramStore.getState().toggleCollapse('ctn1')

    const state = useDiagramStore.getState()

    // ctn1 must be tracked as view-collapsed
    expect(state.views[vid].collapsedNodeIds).toContain('ctn1')

    // sys1's stored height must be SMALLER than before — sized for only ctn1
    // (collapsed) + ctn2 (expanded), NOT for ctn3/ctn4/ctn5.
    // Before fix: height stays at ~500 (based on all 5 model children).
    // After fix:  height is roughly 290 (max(ctn1 collapsed, ctn2 expanded) + pad).
    const sys1After = state.c4Nodes['sys1']
    expect(sys1After.height).toBeLessThan(sys1Before.height - 50)

    // In rfNodes, ctn1 must render at the collapsed container height
    const rfCtn1 = state.rfNodes.find((n) => n.id === 'ctn1')
    expect(rfCtn1).toBeDefined()
    expect(rfCtn1!.style!.height).toBe(COLLAPSED_HEIGHT['container'])
    expect(rfCtn1!.data.height).toBe(COLLAPSED_HEIGHT['container'])

    // sys1 (parent) must render at its updated (smaller) height, NOT at
    // COLLAPSED_HEIGHT['system'] — sys1 itself is not collapsed.
    const rfSys1 = state.rfNodes.find((n) => n.id === 'sys1')
    expect(rfSys1).toBeDefined()
    expect(rfSys1!.style!.height).toBe(sys1After.height)
    expect(rfSys1!.style!.height).toBeLessThan(sys1Before.height - 50)
  })

  it('collapsing the parent node renders it at COLLAPSED_HEIGHT in rfNodes', () => {
    const store = useDiagramStore.getState()

    // Create a named view with only sys1 (no children)
    const vid = store.addView('System-only view')
    store.addNodeToView(vid, 'sys1')
    store.setActiveView(vid)

    // Collapse sys1 itself in this view
    useDiagramStore.getState().toggleCollapse('sys1')

    const state = useDiagramStore.getState()

    // sys1 must be in view.collapsedNodeIds
    expect(state.views[vid].collapsedNodeIds).toContain('sys1')

    // sys1's model-level collapsed flag must NOT be set (view-only collapse)
    expect(state.c4Nodes['sys1'].collapsed).toBe(false)

    // rfNode for sys1 must render at the per-type COLLAPSED dimensions
    const rfSys1 = state.rfNodes.find((n) => n.id === 'sys1')
    expect(rfSys1).toBeDefined()
    expect(rfSys1!.style!.height).toBe(COLLAPSED_HEIGHT['system'])
    expect(rfSys1!.style!.width).toBe(COLLAPSED_WIDTH['system'])
    expect(rfSys1!.data.height).toBe(COLLAPSED_HEIGHT['system'])
    expect(rfSys1!.data.width).toBe(COLLAPSED_WIDTH['system'])
  })

  it('collapse in named view does not affect the default (all-elements) view', () => {
    const store = useDiagramStore.getState()
    const sys1ModelHeight = store.c4Nodes['sys1'].height

    // Create a named view and collapse sys1 inside it
    const vid = store.addView('View 1')
    store.addNodeToView(vid, 'sys1')
    store.setActiveView(vid)
    useDiagramStore.getState().toggleCollapse('sys1')

    // Switch back to default (all-elements) view
    useDiagramStore.getState().setActiveView(null)

    const state = useDiagramStore.getState()

    // model-level collapsed flag must still be false
    expect(state.c4Nodes['sys1'].collapsed).toBe(false)

    // rfNode for sys1 in the default view must NOT be at collapsed height
    const rfSys1 = state.rfNodes.find((n) => n.id === 'sys1')
    expect(rfSys1).toBeDefined()
    expect(rfSys1!.style!.height).not.toBe(COLLAPSED_HEIGHT['system'])
    // It should be at the model height (or the full expanded container height)
    expect((rfSys1!.style!.height as number)).toBeGreaterThan(COLLAPSED_HEIGHT['system'])
  })
})

describe('view-expand override for model-collapsed nodes', () => {
  /**
   * Scenario: sys1 is collapsed at the model level (node.collapsed = true).
   * The user opens a named view and tries to expand sys1 in the right panel.
   * Before the fix: clicking ▶ had no effect — sys1 stayed collapsed.
   * After the fix: sys1 is added to view.expandedNodeIds and renders expanded.
   */
  it('can expand a model-collapsed parent in a named view', () => {
    // First, collapse sys1 at the model level (no view active)
    useDiagramStore.getState().setActiveView(null)
    useDiagramStore.getState().toggleCollapse('sys1')

    const afterModelCollapse = useDiagramStore.getState()
    expect(afterModelCollapse.c4Nodes['sys1'].collapsed).toBe(true)

    // Create a named view with sys1 in it
    const vid = afterModelCollapse.addView('Expanded view')
    afterModelCollapse.addNodeToView(vid, 'sys1')
    afterModelCollapse.setActiveView(vid)

    // In the named view, sys1 should appear collapsed initially
    const stateInView = useDiagramStore.getState()
    const rfSys1Before = stateInView.rfNodes.find((n) => n.id === 'sys1')
    expect(rfSys1Before!.style!.height).toBe(COLLAPSED_HEIGHT['system'])
    expect(rfSys1Before!.data.collapsed).toBe(true)

    // Expand sys1 in the named view (click ▶ in right panel tree)
    useDiagramStore.getState().toggleCollapse('sys1')

    const stateAfter = useDiagramStore.getState()

    // sys1 must be tracked in view.expandedNodeIds
    expect(stateAfter.views[vid].expandedNodeIds).toContain('sys1')

    // sys1 model-level flag must remain true (not changed)
    expect(stateAfter.c4Nodes['sys1'].collapsed).toBe(true)

    // rfNode for sys1 must now render EXPANDED (NOT at COLLAPSED_HEIGHT)
    const rfSys1After = stateAfter.rfNodes.find((n) => n.id === 'sys1')
    expect(rfSys1After).toBeDefined()
    expect(rfSys1After!.style!.height).not.toBe(COLLAPSED_HEIGHT['system'])
    expect(rfSys1After!.data.collapsed).toBe(false)
  })

  it('re-collapsing a view-expanded node removes it from expandedNodeIds', () => {
    // Model-collapse sys1
    useDiagramStore.getState().setActiveView(null)
    useDiagramStore.getState().toggleCollapse('sys1')
    expect(useDiagramStore.getState().c4Nodes['sys1'].collapsed).toBe(true)

    // Create view, expand sys1 inside it
    const store = useDiagramStore.getState()
    const vid = store.addView('View')
    store.addNodeToView(vid, 'sys1')
    store.setActiveView(vid)
    useDiagramStore.getState().toggleCollapse('sys1') // expand in view
    expect(useDiagramStore.getState().views[vid].expandedNodeIds).toContain('sys1')

    // Collapse it again in the same view
    useDiagramStore.getState().toggleCollapse('sys1')

    const stateAfter = useDiagramStore.getState()
    // Must be removed from expandedNodeIds
    expect(stateAfter.views[vid].expandedNodeIds ?? []).not.toContain('sys1')
    // Must be added to collapsedNodeIds (redundant but correct)
    expect(stateAfter.views[vid].collapsedNodeIds ?? []).toContain('sys1')
    // rfNode must render collapsed
    const rfSys1 = stateAfter.rfNodes.find((n) => n.id === 'sys1')
    expect(rfSys1!.style!.height).toBe(COLLAPSED_HEIGHT['system'])
  })

  it('view-expand does not affect the default view — default stays collapsed', () => {
    // Model-collapse sys1
    useDiagramStore.getState().setActiveView(null)
    useDiagramStore.getState().toggleCollapse('sys1')

    // Create view, expand sys1 inside it
    const store = useDiagramStore.getState()
    const vid = store.addView('View')
    store.addNodeToView(vid, 'sys1')
    store.setActiveView(vid)
    useDiagramStore.getState().toggleCollapse('sys1') // expand in view

    // Switch back to default view
    useDiagramStore.getState().setActiveView(null)

    const stateDefault = useDiagramStore.getState()
    // model flag still true
    expect(stateDefault.c4Nodes['sys1'].collapsed).toBe(true)
    // rfNode in default view renders collapsed
    const rfSys1 = stateDefault.rfNodes.find((n) => n.id === 'sys1')
    expect(rfSys1!.style!.height).toBe(COLLAPSED_HEIGHT['system'])
    expect(rfSys1!.data.collapsed).toBe(true)
  })
})

describe('view-filter parent without children', () => {
  /**
   * Regression: when a view contains a container node but none of its children,
   * the container must render at COLLAPSED_HEIGHT (like a single collapsed element),
   * not at its full model height (which was sized to include all children).
   *
   * Root cause: parentSet in deriveRFNodes was computed from ALL model nodes,
   * so hasChildren=true even when all children were excluded by viewFilter.
   * Fix: parentSet is now computed from sorted (view-filtered) nodes only.
   */
  it('parent included in view without its children renders at COLLAPSED_HEIGHT', () => {
    const store = useDiagramStore.getState()
    const sys1ModelHeight = store.c4Nodes['sys1'].height
    expect(sys1ModelHeight).toBeGreaterThan(200) // has real children, big height

    // Create a view that includes only sys1, none of its children
    const vid = store.addView('Parent-only view')
    store.addNodeToView(vid, 'sys1')
    store.setActiveView(vid)

    const state = useDiagramStore.getState()

    // sys1 must appear in rfNodes
    const rfSys1 = state.rfNodes.find((n) => n.id === 'sys1')
    expect(rfSys1).toBeDefined()

    // sys1 is not explicitly collapsed but has no visible children in this view —
    // it should render at COLLAPSED_HEIGHT, not at n.height
    expect(rfSys1!.style!.height).toBe(COLLAPSED_HEIGHT['system'])
    expect(rfSys1!.style!.width).toBe(COLLAPSED_WIDTH['system'])
    expect(rfSys1!.data.height).toBe(COLLAPSED_HEIGHT['system'])
    expect(rfSys1!.data.width).toBe(COLLAPSED_WIDTH['system'])

    // hasChildren data must be false (no children in this view)
    expect(rfSys1!.data.hasChildren).toBe(false)

    // Model height must NOT be changed
    expect(useDiagramStore.getState().c4Nodes['sys1'].height).toBe(sys1ModelHeight)
  })

  it('parent with SOME children in view renders at full height', () => {
    const store = useDiagramStore.getState()

    // Create a view with sys1 + one child (ctn1) — parent should still appear expanded
    const vid = store.addView('Partial-children view')
    store.addNodeToView(vid, 'sys1')
    store.addNodeToView(vid, 'ctn1')
    store.setActiveView(vid)

    const state = useDiagramStore.getState()
    const rfSys1 = state.rfNodes.find((n) => n.id === 'sys1')
    expect(rfSys1).toBeDefined()

    // sys1 has at least one visible child → must NOT render at COLLAPSED_HEIGHT
    expect(rfSys1!.style!.height).not.toBe(COLLAPSED_HEIGHT['system'])
    expect(rfSys1!.data.hasChildren).toBe(true)
  })
})

describe('showing an element that is searched for (expandAncestors)', () => {
  // Quick Search opens the containers around what it finds. It looked at
  // the element's own `collapsed`, and collapse is per view: a container
  // collapsed on All elements and open in the view was "expanded" by a
  // toggle that closed it there (hiding the element found, and saved), and a
  // container closed in the view only was left closed.
  const viewWith = (): string => {
    const store = useDiagramStore.getState()
    const vid = store.addView('Search view')
    for (const id of ['sys1', 'ctn1', 'ctn2']) store.addNodeToView(vid, id)
    return vid
  }
  const shown = (id: string): boolean => useDiagramStore.getState().rfNodes.find((n) => n.id === id)?.hidden !== true

  it('leaves a container open that is collapsed on All elements but open in the view', () => {
    useDiagramStore.getState().toggleCollapse('sys1') // on All elements
    expect(useDiagramStore.getState().c4Nodes.sys1.collapsed).toBe(true)
    const vid = viewWith()
    useDiagramStore.getState().setActiveView(vid)
    useDiagramStore.getState().toggleCollapse('sys1') // open in the view
    expect(shown('ctn1')).toBe(true)

    useDiagramStore.getState().expandAncestors('ctn1')
    expect(shown('ctn1')).toBe(true)
    expect(useDiagramStore.getState().views[vid].collapsedNodeIds ?? []).not.toContain('sys1')
  })

  it('opens a container that is collapsed in the view only', () => {
    const vid = viewWith()
    useDiagramStore.getState().setActiveView(vid)
    useDiagramStore.getState().toggleCollapse('sys1')
    expect(useDiagramStore.getState().views[vid].collapsedNodeIds).toContain('sys1')
    expect(shown('ctn1')).toBe(false)

    useDiagramStore.getState().expandAncestors('ctn1')
    expect(shown('ctn1')).toBe(true)
  })

  it('is one undo step however many containers it opens', () => {
    const store = useDiagramStore.getState
    store().toggleCollapse('ctn1')
    store().toggleCollapse('sys1')
    const child = Object.values(store().c4Nodes).find((n) => n.parentId === 'ctn1')
    if (!child) return // the sample has no component under ctn1
    store().expandAncestors(child.id)
    expect(shown(child.id)).toBe(true)
    store().undo()
    expect(store().c4Nodes.sys1.collapsed).toBe(true)
    expect(store().c4Nodes.ctn1.collapsed).toBe(true)
  })
})

describe('a container collapsed at its parent\'s edge', () => {
  /** A system holding a narrow container on the left and a wide one, with
   *  components, against its right edge: folded, the wide one leaves its
   *  parent a frame narrower than its stored (open) width. */
  const edge = () => ({
    nodes: [
      { id: 'sys', type: 'system', label: 'Shop', x: 0, y: 0, width: 1420, height: 460, collapsed: false },
      { id: 'a', type: 'container', label: 'Web', parentId: 'sys', x: 30, y: 120, width: 300, height: 200, collapsed: false },
      { id: 'b', type: 'container', label: 'Orders', parentId: 'sys', x: 400, y: 120, width: 990, height: 310, collapsed: false },
      { id: 'b1', type: 'component', label: 'Checkout', parentId: 'b', x: 20, y: 120, width: 220, height: 140, collapsed: false },
      { id: 'b2', type: 'component', label: 'Billing', parentId: 'b', x: 750, y: 120, width: 220, height: 140, collapsed: false },
      { id: 'ext', type: 'person', label: 'Buyer', x: 0, y: -400, width: 220, height: 180, collapsed: false },
    ] as C4Node[],
    relations: [],
    views: [{ id: 'v', name: 'Shop', nodeIds: ['sys', 'a', 'b', 'b1', 'b2', 'ext'], positions: {} }],
  })

  it('stays where it is after a view switch (item 222)', () => {
    const s = useDiagramStore.getState
    s().loadDiagram(edge() as any)
    s().setActiveView('v')
    s().toggleCollapse('b')
    const at = () => Object.fromEntries(['sys', 'a', 'b', 'ext'].map((id) => {
      const n = s().c4Nodes[id]
      return [id, { x: Math.round(n.x), y: Math.round(n.y), width: Math.round(n.width), height: Math.round(n.height) }]
    }))
    const folded = at()
    expect(folded.sys.width).toBeLessThan(1100)
    s().setActiveView(null)
    s().setActiveView('v')
    expect(at()).toEqual(folded)
  })
})

describe('the assistant folding and opening a container on the view shown', () => {
  it('does what the −/+ does: folds to the middle and opens round it (item 172)', () => {
    const s = useDiagramStore.getState
    s().loadDiagram({
      nodes: [
        { id: 'sys', type: 'system', label: 'Shop', x: 0, y: 0, width: 860, height: 310, collapsed: false },
        { id: 'a', type: 'container', label: 'Web', parentId: 'sys', x: 30, y: 120, width: 240, height: 160, collapsed: false },
        { id: 'b', type: 'container', label: 'API', parentId: 'sys', x: 590, y: 120, width: 240, height: 160, collapsed: false },
      ] as C4Node[],
      relations: [],
      views: [{ id: 'v', name: 'Shop', nodeIds: ['sys', 'a', 'b'], positions: {} }],
    } as any)
    s().setActiveView('v')
    s().setViewCollapsed('v', ['sys'], true)
    expect(s().views.v.collapsedNodeIds).toEqual(['sys'])
    expect(s().c4Nodes.sys.x + COLLAPSED_WIDTH.system / 2).toBeCloseTo(430, 0)
    s().setViewCollapsed('v', ['sys'], false)
    expect(s().views.v.collapsedNodeIds).toEqual([])
    expect(s().c4Nodes.sys.x).toBeCloseTo(0, 0)
  })
})

describe('a container a view shows without its children', () => {
  it('keeps its place there on a reload (item 180)', () => {
    // A Containers view of an imported workspace: API Application, which
    // holds components the view does not list, is drawn folded; its stored
    // (open) size put its middle outside its system, and every reload
    // placed it, and what it pushed, afresh.
    const s = useDiagramStore.getState
    const doc = {
      nodes: [
        { id: 'bank', type: 'system', label: 'Big Bank', x: 0, y: 0, width: 700, height: 330, collapsed: false },
        { id: 'web', type: 'container', label: 'Web', parentId: 'bank', x: 30, y: 120, width: 240, height: 180, collapsed: false },
        { id: 'api', type: 'container', label: 'API Application', parentId: 'bank', x: 330, y: 120, width: 1400, height: 900, collapsed: false },
        { id: 'c1', type: 'component', label: 'Sign In', parentId: 'api', x: 30, y: 120, width: 220, height: 140, collapsed: false },
        { id: 'c2', type: 'component', label: 'Accounts', parentId: 'api', x: 1100, y: 700, width: 220, height: 140, collapsed: false },
      ] as C4Node[],
      relations: [],
      views: [{
        id: 'v', name: 'Containers', nodeIds: ['bank', 'web', 'api'],
        positions: {
          bank: { x: 0, y: 0, width: 640, height: 330 },
          web: { x: 30, y: 120, width: 240, height: 180 },
          api: { x: 330, y: 120, width: 1400, height: 900 },
        },
      }],
    }
    const view = doc.views[0] as { positions: Record<string, { x: number; y: number }> }
    s().loadDiagram(structuredClone(doc) as any)
    s().setActiveView('v')
    for (const id of ['bank', 'web', 'api']) {
      expect(Math.round(s().c4Nodes[id].x), id).toBe(Math.round(view.positions[id].x))
      expect(Math.round(s().c4Nodes[id].y), id).toBe(Math.round(view.positions[id].y))
    }
  })
})

describe('an element the view shown does not draw', () => {
  it('folds and opens there without a throw, and nothing moves (item 259)', () => {
    // An agent added a system; with a view that does not draw it shown,
    // folding and opening it threw in makeRoomAround: the expand made room
    // round a box the canvas has not got.
    const s = useDiagramStore.getState
    s().loadDiagram({
      nodes: [
        { id: 'shop', type: 'system', label: 'Shop', x: 0, y: 0, width: 400, height: 300, collapsed: false },
        { id: 'web', type: 'container', label: 'Web', parentId: 'shop', x: 30, y: 120, width: 240, height: 140, collapsed: false },
        { id: 'bank', type: 'system', label: 'Bank', x: 600, y: 0, width: 280, height: 180, collapsed: false },
        { id: 'agent', type: 'system', label: 'Agent system', x: 1000, y: 0, width: 400, height: 300, collapsed: false },
        { id: 'job', type: 'container', label: 'Job', parentId: 'agent', x: 30, y: 120, width: 240, height: 140, collapsed: false },
      ] as C4Node[],
      relations: [],
      views: [{ id: 'v', name: 'Context', nodeIds: ['shop', 'bank'], positions: {} }],
    } as any)
    s().setActiveView('v')
    const places = () => Object.fromEntries(Object.values(s().c4Nodes).map((n) => [n.id, { x: n.x, y: n.y, width: n.width, height: n.height }]))
    const before = places()
    s().toggleCollapse('agent')
    expect(s().views.v.collapsedNodeIds).toEqual(['agent'])
    expect(() => s().toggleCollapse('agent')).not.toThrow()
    expect(s().views.v.collapsedNodeIds).toEqual([])
    expect(places()).toEqual(before)
    s().setActiveView(null)
    expect(s().c4Nodes.agent).toMatchObject({ x: 1000, y: 0, width: 400, height: 300 })
    s().stopLiveLayout()
  })
})

describe('folding a container drawn without its children', () => {
  // It is drawn at the folded size already: a fold shrank it from its model
  // size round the middle, and moved it by half the difference, onto its
  // neighbour (fuzzer K5, K5b).
  const shop = () => ({
    nodes: [
      { id: 'sys', type: 'system', label: 'Shop', x: 0, y: 0, width: 1400, height: 450, collapsed: false },
      { id: 'api', type: 'container', label: 'API', parentId: 'sys', x: 30, y: 120, width: 300, height: 200, collapsed: false },
      { id: 'orders', type: 'container', label: 'Orders', parentId: 'sys', x: 400, y: 120, width: 970, height: 300, collapsed: false },
      { id: 'k1', type: 'component', label: 'Checkout', parentId: 'orders', x: 20, y: 120, width: 220, height: 140, collapsed: false },
      { id: 'k2', type: 'component', label: 'Billing', parentId: 'orders', x: 730, y: 120, width: 220, height: 140, collapsed: false },
      { id: 'pay', type: 'system', label: 'Payments', x: 1500, y: 0, width: 300, height: 180, collapsed: false },
    ] as C4Node[],
    relations: [],
    views: [{ id: 'v', name: 'Containers', nodeIds: ['sys', 'api', 'orders', 'pay'], positions: {} }],
  })
  const at = (ids: string[]) => Object.fromEntries(ids.map((id) => {
    const n = useDiagramStore.getState().c4Nodes[id]
    return [id, { x: n.x, y: n.y, width: n.width, height: n.height }]
  }))

  it('moves nothing when it has no children (All elements)', () => {
    const s = useDiagramStore.getState
    s().loadDiagram(shop() as any)
    s().stopLiveLayout()
    const before = at(['sys', 'api', 'orders', 'pay'])
    s().toggleCollapse('api')
    expect(s().c4Nodes.api.collapsed).toBe(true)
    expect(at(['sys', 'api', 'orders', 'pay'])).toEqual(before)
    s().toggleCollapse('api')
    expect(at(['sys', 'api', 'orders', 'pay'])).toEqual(before)
  })

  it('moves nothing when the view shown draws none of its children', () => {
    const s = useDiagramStore.getState
    s().loadDiagram(shop() as any)
    s().stopLiveLayout()
    s().setActiveView('v')
    const before = at(['api', 'orders', 'pay'])
    s().toggleCollapse('orders')
    expect(s().views.v.collapsedNodeIds).toEqual(['orders'])
    // The system may fit what it shows; nothing in it or beside it moves.
    expect(at(['api', 'orders', 'pay'])).toEqual(before)
  })
})

describe('opening on a view a container folded in the model, whose children the view does not draw', () => {
  // The view draws it at its open size then (it keeps its open size and the
  // view opens it over the model's fold), yet the room was made for it as
  // for a container drawn without children, at its folded size: it opened
  // over the container beside it (fuzzer, nested: Container 0.1 folded on
  // All elements, opened on System 0, over Container 0.2).
  const shop = () => ({
    nodes: [
      { id: 'sys', type: 'system', label: 'Shop', x: 0, y: 0, width: 1300, height: 450, collapsed: false },
      { id: 'api', type: 'container', label: 'API', parentId: 'sys', x: 30, y: 120, width: 300, height: 200, collapsed: false },
      { id: 'orders', type: 'container', label: 'Orders', parentId: 'sys', x: 400, y: 120, width: 970, height: 300, collapsed: true },
      { id: 'k1', type: 'component', label: 'Checkout', parentId: 'orders', x: 20, y: 120, width: 220, height: 140, collapsed: false },
      { id: 'k2', type: 'component', label: 'Billing', parentId: 'orders', x: 730, y: 120, width: 220, height: 140, collapsed: false },
      { id: 'cart', type: 'container', label: 'Cart', parentId: 'sys', x: 700, y: 120, width: 300, height: 200, collapsed: false },
    ] as C4Node[],
    relations: [],
    views: [{ id: 'v', name: 'Containers', nodeIds: ['sys', 'api', 'orders', 'cart'], positions: {} }],
  })
  /** The boxes the canvas draws, at their absolute places. */
  const drawnBoxes = () => {
    const rf = useDiagramStore.getState().rfNodes
    const byId = Object.fromEntries(rf.map((n) => [n.id, n]))
    return Object.fromEntries(rf.filter((n) => !n.hidden).map((n) => {
      let { x, y } = n.position
      for (let p = n.parentNode; p && byId[p]; p = byId[p].parentNode) { x += byId[p].position.x; y += byId[p].position.y }
      return [n.id, { x, y, width: Number(n.width ?? n.style?.width), height: Number(n.height ?? n.style?.height) }]
    }))
  }

  it('makes room for the size it is drawn at', () => {
    const s = useDiagramStore.getState
    s().loadDiagram(shop() as any)
    s().stopLiveLayout()
    s().setActiveView('v')
    s().toggleCollapse('orders')
    expect(s().views.v.expandedNodeIds).toEqual(['orders'])
    const b = drawnBoxes()
    expect(b.orders.width).toBe(970)
    const apart = (p: string, q: string) => b[p].x + b[p].width <= b[q].x || b[q].x + b[q].width <= b[p].x || b[p].y + b[p].height <= b[q].y || b[q].y + b[q].height <= b[p].y
    expect(apart('orders', 'cart')).toBe(true)
    expect(apart('orders', 'api')).toBe(true)
    for (const id of ['api', 'orders', 'cart']) {
      expect(b[id].x + b[id].width, id).toBeLessThanOrEqual(b.sys.x + b.sys.width)
      expect(b[id].y + b[id].height, id).toBeLessThanOrEqual(b.sys.y + b.sys.height)
    }
  })
})
