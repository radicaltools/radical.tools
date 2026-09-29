/**
 * Headless regression test for the render-aware composite cost function.
 *
 * Builds two snapshots of the SAME C4 scene (mirroring two screenshots a
 * user sent: algorithm output vs. their manual fix) and verifies that
 * `computeCompositeScore` ranks the manual fix BETTER (lower composite).
 * This is the empirical check that caught the original bug — the cost
 * function preferring a visibly worse layout — so it's wired into `npm test`
 * instead of being a standalone script nobody runs.
 */
import { describe, it, expect } from 'vitest'
import { computeCompositeScore } from '../src/renderer/src/layout/smartLayout'

// ─── Scene ──────────────────────────────────────────────────────────────────
//
// Mirrors the screenshots:
//   - 2 SoftwareSystems (sysA upper-right, sysB lower)
//   - sysA contains: containerA → has DB connection
//   - sysB contains: containerB which contains 3 components, plus DB+Queue siblings
//   - external Person, second Person, and a grey ExternalSystem
//
// Sizes from typical C4 nodes (system 280×140, container 200×100, etc.).

/** Build the common node SET (without positions) — only sizes and parents. */
function buildNodes() {
  const N = (id, type, label, w, h, extras = {}) => ({
    id, type, label, width: w, height: h, x: 0, y: 0, collapsed: false, ...extras,
  })

  // Components inside sysB.containerB
  const compA = N('compA', 'component', 'Component', 180, 70)
  const compB = N('compB', 'component', 'Component', 180, 70)
  const compC = N('compC', 'component', 'Component', 180, 70)

  // sysB.containerB (parent of 3 components)
  const sysBContainerB = N('sysB.containerB', 'container', 'Container', 0, 0)

  // sysB siblings (Database, Queue, Container)
  const sysBDb    = N('sysB.db',    'database', 'Database', 130, 80)
  const sysBQueue = N('sysB.queue', 'queue',    'Queue',    130, 70)

  // sysB itself
  const sysB = N('sysB', 'system', 'System', 0, 0)

  // sysA contents
  const sysAContainer = N('sysA.container', 'container', 'Container', 200, 110)
  const sysADb        = N('sysA.db',        'database',  'Database', 130, 80)
  const sysA = N('sysA', 'system', 'System', 0, 0)

  // External actors
  const personTop = N('personTop', 'person', 'Person', 100, 70, { external: true })
  const personSide = N('personSide', 'person', 'Person', 100, 70, { external: true })
  const extSys = N('extSys', 'system', 'ExternalSystem', 150, 70, { external: true })

  return {
    compA, compB, compC,
    sysBContainerB, sysBDb, sysBQueue, sysB,
    sysAContainer, sysADb, sysA,
    personTop, personSide, extSys,
  }
}

/** Common relation set (stable ids). */
function buildRelations() {
  const R = (id, s, t) => ({ id, sourceId: s, targetId: t })
  return [
    R('r1', 'personTop',     'sysA.container'),
    R('r2', 'personTop',     'compA'),               // long edge in algo layout
    R('r3', 'personSide',    'sysB.containerB'),
    R('r4', 'sysA.container', 'sysA.db'),
    R('r5', 'sysA.container', 'sysB.queue'),
    R('r6', 'sysA.container', 'compB'),
    R('r7', 'extSys',         'sysB.containerB'),
    R('r8', 'extSys',         'sysA.container'),
    R('r9', 'compA',          'compB'),
    R('r10', 'compB',         'compC'),
    R('r11', 'compC',         'sysB.db'),
    R('r12', 'compA',         'sysB.queue'),
  ]
}

/** Algorithm-style layout (tall column, External System pushed centrally). */
function layoutAlgorithm(N) {
  // 3 components stacked roughly vertically: compA top, compB right, compC bottom-mid
  N.compA.parentId = 'sysB.containerB'; N.compA.x = 30;  N.compA.y = 40
  N.compB.parentId = 'sysB.containerB'; N.compB.x = 230; N.compB.y = 40
  N.compC.parentId = 'sysB.containerB'; N.compC.x = 130; N.compC.y = 160
  N.sysBContainerB.width = 440; N.sysBContainerB.height = 280
  N.sysBContainerB.parentId = 'sysB'; N.sysBContainerB.x = 30; N.sysBContainerB.y = 200

  // sysB siblings
  N.sysBDb.parentId    = 'sysB'; N.sysBDb.x    = 30;  N.sysBDb.y = 60
  N.sysBQueue.parentId = 'sysB'; N.sysBQueue.x = 320; N.sysBQueue.y = 70
  N.sysB.x = 80; N.sysB.y = 800; N.sysB.width = 510; N.sysB.height = 520

  // sysA upper
  N.sysAContainer.parentId = 'sysA'; N.sysAContainer.x = 30; N.sysAContainer.y = 50
  N.sysADb.parentId        = 'sysA'; N.sysADb.x        = 280; N.sysADb.y = 70
  N.sysA.x = 320; N.sysA.y = 80; N.sysA.width = 460; N.sysA.height = 220

  // External actors
  N.personTop.x  = 250; N.personTop.y  = 0      // top, very high
  N.personSide.x = 100; N.personSide.y = 200    // left side
  N.extSys.x     = 280; N.extSys.y     = 480    // CENTRAL — between sysA and sysB
}

/** User-fixed layout (horizontal spread, External pushed to corner). */
function layoutManual(N) {
  N.compA.parentId = 'sysB.containerB'; N.compA.x = 130; N.compA.y = 40
  N.compB.parentId = 'sysB.containerB'; N.compB.x = 30;  N.compB.y = 200
  N.compC.parentId = 'sysB.containerB'; N.compC.x = 230; N.compC.y = 200
  N.sysBContainerB.width = 440; N.sysBContainerB.height = 320
  N.sysBContainerB.parentId = 'sysB'; N.sysBContainerB.x = 30; N.sysBContainerB.y = 60

  // sysB siblings
  N.sysBDb.parentId    = 'sysB'; N.sysBDb.x    = 200; N.sysBDb.y = 410   // below container
  N.sysBQueue.parentId = 'sysB'; N.sysBQueue.x = 500; N.sysBQueue.y = 200
  N.sysB.x = 200; N.sysB.y = 350; N.sysB.width = 660; N.sysB.height = 520

  // sysA
  N.sysAContainer.parentId = 'sysA'; N.sysAContainer.x = 30;  N.sysAContainer.y = 50
  N.sysADb.parentId        = 'sysA'; N.sysADb.x        = 280; N.sysADb.y = 70
  N.sysA.x = 380; N.sysA.y = 50; N.sysA.width = 460; N.sysA.height = 220

  // External actors — peripheral
  N.personTop.x  = 380; N.personTop.y  = 0     // just above sysA
  N.personSide.x = 50;  N.personSide.y = 600   // far left, near sysB
  N.extSys.x     = 950; N.extSys.y     = 700   // BOTTOM-RIGHT CORNER — peripheral
}

function scoreScenario(layoutFn) {
  const Nobj = buildNodes()
  layoutFn(Nobj)
  const nodes = Object.fromEntries(Object.values(Nobj).map((n) => [n.id, n]))
  const relations = Object.fromEntries(buildRelations().map((r) => [r.id, r]))
  return computeCompositeScore(nodes, relations)
}

describe('smartLayout composite score — real user regression scenario', () => {
  it('ranks the peripheral-External manual fix below the central-External algorithm output', () => {
    const algo = scoreScenario(layoutAlgorithm)
    const manual = scoreScenario(layoutManual)

    expect(manual.composite).toBeLessThan(algo.composite)
  })
})
