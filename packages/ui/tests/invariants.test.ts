/**
 * The product's rules as invariants over random sequences of store actions
 * (ADR "Rules checked as invariants"; the rules are those of
 * docs/EXPLORATORY-TESTING.md, "How to tell that something is wrong").
 *
 * fast-check builds sequences of what a user or an agent does (add, delete,
 * rename, move into another parent, drag, collapse, keep in a row or a
 * column, unpin, Smart Layout, switch views, open a milestone and leave it,
 * edit in it, new views, relations, sequence steps, an agent's write merged
 * as Studio merges it, undo, redo, a reload) on three models, and checks
 * after every step:
 *
 *  - undoRestores / redoRestores: Undo of the step gives back the model as it
 *    was before it, Redo gives back the model after it (0.5 px for places);
 *    a chain of undos and redos walks the same states;
 *  - oneStepPerAction: one action of the user makes at most one undo step;
 *  - folderRoundTrip: the document written as a Markdown folder and read
 *    back is the same model (what the folder writes as nothing aside);
 *  - reloadKeeps: the document read again (as the .radical JSON, into a
 *    second store) moves nothing on the canvas shown and saves the same;
 *  - nothingMovesByItself: an action that edits nothing (a view or
 *    milestone switch, a save) leaves the document as it was;
 *  - geometry: on the canvas shown no drawn child lies outside its drawn
 *    parent and no two drawn siblings overlap (0.5 px), that were not so
 *    when the model was opened (a view first seen after an agent's write
 *    is taken as it is: it settles when opened, as decided);
 *  - references: no relation, parent, step, view entry, alignment or slide
 *    points at nothing; step texts and backward flags stay parallel to the
 *    steps (a view's positions may keep elements gone from the live model:
 *    they are its layout for every milestone);
 *  - milestoneKeepsLive: while a milestone is shown, the live document is
 *    as it was when it was opened until Save as new (milestones only) or
 *    Propagate; Discard gives it back;
 *  - validation: a user's edit adds no issue of Validation that says the
 *    model breaks its metamodel's structure (a parent, a place, a
 *    relation's ends or type, a reference, a maximum; rule 8);
 *  - noErrors: no action throws and nothing is written to console.error.
 *
 * CI runs fixed seeds. For more:
 *   FUZZ_RUNS=2000 FUZZ_SEED=7 npx vitest run tests/invariants.test.ts
 * (or `npm run fuzz -w @radical/ui`, 2000 runs of each model by default).
 * FUZZ_MODEL=bookstore|sample|nested runs one model, FUZZ_LENGTH sets the
 * longest sequence, FUZZ_PATH (with the same FUZZ_SEED and FUZZ_LENGTH)
 * replays the counterexample a failure prints. A failure names the rule,
 * shows the shrunk sequence, the ids and labels each step resolved to, and
 * what differs. FUZZ_SURVEY=<file> reports every distinct failure into the
 * file and goes on; FUZZ_NO_KNOWN=1 lets KNOWN filter nothing.
 *
 * Violations that are product bugs not fixed yet are listed in KNOWN: a
 * run that hits one ends there, quietly (a known geometry violation is
 * left as it is and the run goes on), so CI stays green until the fix
 * (which removes the entry and adds a plain regression test).
 */
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'
import fc from 'fast-check'
import type { C4Node, C4Relation, DiagramData, DiagramSequence, DiagramView, LayoutConstraint } from '@radical/common/c4'
import { isContainerType, nodeTypeSize, pinnedNodeIds, withCanvasPositions, NODE_SIZES } from '@radical/common/c4'
import { viewDrawnIds } from '@radical/common/viewPipeline'
import { builtInGovernanceMetamodel, isParentAllowed, validateModel, type Metamodel } from '@radical/common/metamodel'
import { deserializeFromMdFolder, serializeToMdFolder } from '@radical/common/formats/mdFolder'
import { mergeModels } from '@radical/common/modelMerge'
import { createModelFacade } from '@radical/common/ai/modelFacade'
import { fitShown, growWithRoom, modelCanvas, placeNewNode, settleMovedNodes } from '@radical/layout/geometry'
import { applyAlignments, viewLayoutInput } from '@radical/layout/viewInput'
import bookstoreText from '../../../apps/e2e/fixtures/bookstore.radical?raw'
import sampleText from '../../../apps/studio/src/renderer/src/store/fintechSampleData.json?raw'

// ─── The live physics, stepped by hand ──────────────────────────────────────
// The live layout runs on a d3 timer (liveColaEngine.ts). Here the timer only
// ticks when the test steps it, so every step is driven to rest before the
// checks, the same way on every machine.
vi.mock('d3-timer', async (importOriginal) => {
  const real = await importOriginal<Record<string, unknown>>()
  interface ManualTimer { cb: (elapsed: number) => void; t0: number; stop(): void; restart(cb: (elapsed: number) => void, delay?: number): void }
  const timers = new Set<ManualTimer>()
  let clock = 0
  const timer = (cb: (elapsed: number) => void, delay = 0): ManualTimer => {
    const t: ManualTimer = {
      cb,
      t0: clock + delay,
      stop() { timers.delete(t) },
      restart(next, d = 0) { t.cb = next; t.t0 = clock + d; timers.add(t) },
    }
    timers.add(t)
    return t
  }
  ;(globalThis as Record<string, unknown>).__fuzzTimers = {
    timers,
    tick() {
      clock += 16
      for (const t of [...timers]) if (timers.has(t)) t.cb(clock - t.t0)
    },
  }
  return { ...real, timer, now: () => clock }
})

import { useDiagramStore, historyMark, activeLayoutConstraints } from '../src/store/diagramStore'

type Store = typeof useDiagramStore
type State = ReturnType<Store['getState']>
const timers = (): { timers: Set<unknown>; tick(): void } => (globalThis as unknown as { __fuzzTimers: { timers: Set<unknown>; tick(): void } }).__fuzzTimers

const env = ((globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env) ?? {}
const RUNS = env.FUZZ_RUNS ? Number(env.FUZZ_RUNS) : undefined
const SEED = env.FUZZ_SEED ? Number(env.FUZZ_SEED) : undefined
const ONLY_MODEL = env.FUZZ_MODEL
const PATH = env.FUZZ_PATH
const LENGTH = env.FUZZ_LENGTH ? Number(env.FUZZ_LENGTH) : undefined
/** Survey mode (FUZZ_SURVEY=1): each failure is reported and then taken as
 *  known by its rule and last action, so that one run finds many. */
const SURVEY = !!env.FUZZ_SURVEY
/** FUZZ_NO_KNOWN=1: KNOWN filters nothing (to see whether one still happens). */
const NO_KNOWN = !!env.FUZZ_NO_KNOWN
/** FUZZ_NO_SHRINK=1: report the first failure as found (shrinking a long
 *  sequence on the sample takes minutes). */
const NO_SHRINK = !!env.FUZZ_NO_SHRINK
/** Where survey mode appends its reports as they come (FUZZ_SURVEY=<file>). */
const SURVEY_FILE = env.FUZZ_SURVEY && env.FUZZ_SURVEY !== '1' ? env.FUZZ_SURVEY : undefined
/** Half a pixel: what a place may be off by and still be the same. */
const TOL = 0.5
const MAX_TICKS = 2500

// ─── Determinism ────────────────────────────────────────────────────────────
// Ids and the physics' jitter come from counters seeded per run, so a
// counterexample replays to the same ids.
let idCounter = 0
let rngState = 1
function resetDeterminism(seed: number): void {
  idCounter = 0
  rngState = (seed >>> 0) || 1
}
const realRandom = Math.random
const realLog = console.log.bind(console)
function seededRandom(): number {
  // mulberry32
  rngState = (rngState + 0x6d2b79f5) >>> 0
  let t = rngState
  t = Math.imul(t ^ (t >>> 15), t | 1)
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}
const nextId = (): string => `00000000-0000-4000-8000-${(++idCounter).toString(16).padStart(12, '0')}`

// ─── Models ─────────────────────────────────────────────────────────────────

function bookstoreModel(): DiagramData {
  return JSON.parse(bookstoreText) as DiagramData
}

function sampleModel(): DiagramData {
  const data = JSON.parse(sampleText) as DiagramData
  if (!data.metamodel) data.metamodel = builtInGovernanceMetamodel()
  return data
}

/** Systems › containers › components, laid out tidily: three systems of two
 *  or three containers of two to four components, people above, relations
 *  between them, a row and a pin, two milestones, a sequence, and views (a
 *  context view, one system's containers, a filter chain, a flow). */
function nestedModel(): DiagramData {
  const nodes: C4Node[] = []
  const relations: C4Relation[] = []
  const comp = NODE_SIZES.component
  const cont = NODE_SIZES.container
  void cont
  const plan = [[3, 2, 4], [2, 3], [4, 2, 2]]
  let sx = 0
  const containers: string[][] = []
  const components: string[] = []
  plan.forEach((sys, si) => {
    const sysId = `s${si}`
    let cx = 40
    let sysH = 0
    const ids: string[] = []
    sys.forEach((count, ci) => {
      const cId = `s${si}c${ci}`
      ids.push(cId)
      const cw = 40 + count * (comp.width + 40)
      const ch = 120 + comp.height + 40
      nodes.push({ id: cId, type: 'container', label: `Container ${si}.${ci}`, description: '', technology: 'Node', parentId: sysId, collapsed: false, x: cx, y: 120, width: cw, height: ch } as C4Node)
      for (let k = 0; k < count; k++) {
        const kId = `${cId}k${k}`
        components.push(kId)
        nodes.push({ id: kId, type: 'component', label: `Component ${si}.${ci}.${k}`, description: '', parentId: cId, collapsed: false, x: 40 + k * (comp.width + 40), y: 120, ...comp } as C4Node)
      }
      cx += cw + 40
      sysH = Math.max(sysH, ch)
    })
    containers.push(ids)
    nodes.push({ id: sysId, type: 'system', label: `System ${si}`, description: '', collapsed: false, x: sx, y: 400, width: cx, height: 120 + sysH + 40 } as C4Node)
    sx += cx + 120
  })
  nodes.push({ id: 'p0', type: 'person', label: 'Customer', description: '', collapsed: false, x: 200, y: 0, ...NODE_SIZES.person } as C4Node)
  nodes.push({ id: 'p1', type: 'person', label: 'Operator', description: '', collapsed: false, x: 900, y: 0, ...NODE_SIZES.person } as C4Node)
  let r = 0
  const rel = (sourceId: string, targetId: string, label: string): string => {
    const id = `r${r++}`
    relations.push({ id, sourceId, targetId, label })
    return id
  }
  const flow = [
    rel('p0', 's0c0', 'uses'),
    rel('s0c0', 's0c1', 'calls'),
    rel('s0c1k0', 's1c0k1', 'reads'),
    rel('s1c0', 's2c0', 'publishes'),
  ]
  rel('p1', 's2c1', 'operates')
  rel('s0c0k0', 's0c0k1', 'delegates')
  rel('s0c2k3', 's2c2k0', 'sends')
  rel('s2c0k3', 's2c1k0', 'notifies')
  rel('s1c1k2', 's1c1k0', 'caches')
  // A row of the first system's containers, a pinned person.
  const defaultLayoutConstraints: LayoutConstraint[] = [
    { id: 'row0', type: 'align', axis: 'horizontal', nodeIds: containers[0] },
    { id: 'pin0', type: 'pin', nodeIds: ['p1'] } as LayoutConstraint,
  ]
  const byId = Object.fromEntries(nodes.map((n) => [n.id, n]))
  const relsById = Object.fromEntries(relations.map((x) => [x.id, x]))
  // Milestones: an early one without the third system, and one without a component.
  const early = Object.fromEntries(nodes.filter((n) => !n.id.startsWith('s2')).map((n) => [n.id, n]))
  const earlyRels = Object.fromEntries(relations.filter((x) => early[x.sourceId] && early[x.targetId]).map((x) => [x.id, x]))
  const later = Object.fromEntries(nodes.filter((n) => n.id !== 's1c1k1').map((n) => [n.id, n]))
  const sequence: DiagramSequence = { id: 'seq0', name: 'Order', relationIds: flow, stepDescriptions: ['opens', 'posts', 'reads', 'tells'] }
  const views: DiagramView[] = [
    { id: 'v-ctx', name: 'Context', kind: 'static', nodeIds: ['p0', 'p1', 's0', 's1', 's2'], positions: {}, collapsedNodeIds: ['s0', 's1', 's2'] } as DiagramView,
    { id: 'v-s0', name: 'System 0', kind: 'static', nodeIds: ['p0', 's0', ...containers[0]], positions: {} },
    { id: 'v-chain', name: 'Systems and containers', kind: 'static', nodeIds: [], positions: {}, pipeline: { levels: [{ ways: [{ types: ['system', 'container'] }] }] } } as DiagramView,
    { id: 'v-flow', name: 'Order flow', kind: 'dynamic', nodeIds: ['p0', 's0c0', 's0c1', 's0c1k0', 's1c0k1', 's1c0', 's2c0'], sequenceId: 'seq0', positions: {} },
    { id: 'v-table', name: 'Table', kind: 'table', nodeIds: [], positions: {} },
  ]
  return {
    nodes,
    relations,
    sequences: [sequence],
    views,
    defaultLayoutConstraints,
    snapshots: [
      { id: 'm-early', name: 'Early', timestamp: 1, nodes: early, relations: earlyRels, sequences: {} },
      { id: 'm-later', name: 'Later', timestamp: 2, nodes: later, relations: Object.fromEntries(Object.entries(relsById).filter(([, x]) => later[x.sourceId] && later[x.targetId])), sequences: { seq0: sequence } },
    ],
    defaultPositions: Object.fromEntries(Object.values(byId).map((n) => [n.id, { x: n.x, y: n.y, width: n.width, height: n.height }])),
  }
}

const MODELS: Record<string, () => DiagramData> = { bookstore: bookstoreModel, sample: sampleModel, nested: nestedModel }

// ─── Actions ────────────────────────────────────────────────────────────────
// Each refers to elements by an index into a list sorted by id (taken modulo
// its length), so that every sequence fast-check makes or shrinks to can run.

type Action =
  | { a: 'add'; parent: number; type: number; fx: number; fy: number }
  | { a: 'delete'; el: number; hide: boolean }
  | { a: 'deleteRel'; rel: number }
  | { a: 'rename'; el: number; text: string }
  | { a: 'describe'; el: number; text: string }
  | { a: 'reparent'; el: number; to: number }
  | { a: 'drag'; el: number; dx: number; dy: number }
  | { a: 'collapse'; el: number }
  | { a: 'align'; el: number; axis: 'horizontal' | 'vertical'; n: number }
  | { a: 'unalign'; c: number }
  | { a: 'unpin'; el: number }
  | { a: 'smartLayout' }
  | { a: 'view'; v: number }
  | { a: 'newView' }
  | { a: 'viewKind'; kind: 'static' | 'table' | 'dynamic' | 'wiki' }
  | { a: 'viewpointView'; vp: number }
  | { a: 'createMilestone' }
  | { a: 'openMilestone'; m: number }
  | { a: 'discard' }
  | { a: 'saveAsNew' }
  | { a: 'propagate' }
  | { a: 'connect'; from: number; to: number; pick: number }
  | { a: 'seqAdd'; seq: number; rel: number }
  | { a: 'seqRemove'; seq: number; step: number }
  | { a: 'seqBackward'; seq: number; step: number }
  | { a: 'agent'; kind: 'add' | 'rename' | 'delete' | 'move' | 'relate' | 'describe'; el: number; el2: number }
  | { a: 'save' }
  | { a: 'undo' }
  | { a: 'redo' }
  | { a: 'reload' }

const idx = fc.nat({ max: 1000 })
const frac = fc.integer({ min: 5, max: 95 }).map((n) => n / 100)
const word = fc.constantFrom('Orders', 'API', 'Shop DB', 'Billing', 'x', 'Payment Gateway')

const actionArb: fc.Arbitrary<Action> = fc.oneof(
  { weight: 6, arbitrary: fc.record({ a: fc.constant('add' as const), parent: idx, type: idx, fx: frac, fy: frac }) },
  { weight: 3, arbitrary: fc.record({ a: fc.constant('delete' as const), el: idx, hide: fc.boolean() }) },
  { weight: 2, arbitrary: fc.record({ a: fc.constant('deleteRel' as const), rel: idx }) },
  { weight: 3, arbitrary: fc.record({ a: fc.constant('rename' as const), el: idx, text: word }) },
  { weight: 1, arbitrary: fc.record({ a: fc.constant('describe' as const), el: idx, text: word }) },
  { weight: 3, arbitrary: fc.record({ a: fc.constant('reparent' as const), el: idx, to: idx }) },
  { weight: 6, arbitrary: fc.record({ a: fc.constant('drag' as const), el: idx, dx: fc.integer({ min: -400, max: 400 }), dy: fc.integer({ min: -400, max: 400 }) }) },
  { weight: 4, arbitrary: fc.record({ a: fc.constant('collapse' as const), el: idx }) },
  { weight: 2, arbitrary: fc.record({ a: fc.constant('align' as const), el: idx, axis: fc.constantFrom('horizontal' as const, 'vertical' as const), n: fc.integer({ min: 1, max: 2 }) }) },
  { weight: 1, arbitrary: fc.record({ a: fc.constant('unalign' as const), c: idx }) },
  { weight: 2, arbitrary: fc.record({ a: fc.constant('unpin' as const), el: idx }) },
  { weight: 2, arbitrary: fc.constant({ a: 'smartLayout' as const }) },
  { weight: 5, arbitrary: fc.record({ a: fc.constant('view' as const), v: fc.integer({ min: -1, max: 1000 }) }) },
  { weight: 1, arbitrary: fc.constant({ a: 'newView' as const }) },
  { weight: 1, arbitrary: fc.record({ a: fc.constant('viewKind' as const), kind: fc.constantFrom('static' as const, 'table' as const, 'dynamic' as const, 'wiki' as const) }) },
  { weight: 1, arbitrary: fc.record({ a: fc.constant('viewpointView' as const), vp: idx }) },
  { weight: 1, arbitrary: fc.constant({ a: 'createMilestone' as const }) },
  { weight: 3, arbitrary: fc.record({ a: fc.constant('openMilestone' as const), m: idx }) },
  { weight: 2, arbitrary: fc.constant({ a: 'discard' as const }) },
  { weight: 1, arbitrary: fc.constant({ a: 'saveAsNew' as const }) },
  { weight: 1, arbitrary: fc.constant({ a: 'propagate' as const }) },
  { weight: 3, arbitrary: fc.record({ a: fc.constant('connect' as const), from: idx, to: idx, pick: idx }) },
  { weight: 2, arbitrary: fc.record({ a: fc.constant('seqAdd' as const), seq: idx, rel: idx }) },
  { weight: 1, arbitrary: fc.record({ a: fc.constant('seqRemove' as const), seq: idx, step: idx }) },
  { weight: 1, arbitrary: fc.record({ a: fc.constant('seqBackward' as const), seq: idx, step: idx }) },
  { weight: 3, arbitrary: fc.record({ a: fc.constant('agent' as const), kind: fc.constantFrom('add' as const, 'rename' as const, 'delete' as const, 'move' as const, 'relate' as const, 'describe' as const), el: idx, el2: idx }) },
  { weight: 2, arbitrary: fc.constant({ a: 'save' as const }) },
  { weight: 5, arbitrary: fc.constant({ a: 'undo' as const }) },
  { weight: 3, arbitrary: fc.constant({ a: 'redo' as const }) },
  { weight: 2, arbitrary: fc.constant({ a: 'reload' as const }) },
).map((action) => Object.defineProperty({ ...action }, fc.toStringMethod, { value: () => showAction(action), enumerable: false }))

function showAction(action: Action): string {
  const { a, ...args } = action as Action & Record<string, unknown>
  const list = Object.entries(args).map(([k, v]) => `${k}: ${JSON.stringify(v)}`).join(', ')
  return `{ a: '${a}'${list ? `, ${list}` : ''} }`
}

// ─── Reading the store ──────────────────────────────────────────────────────

const byIdOf = <T extends { id: string }>(items: T[] | undefined): Record<string, T> =>
  Object.fromEntries((items ?? []).map((item) => [item.id, item]))
const sortedIds = (record: Record<string, unknown>): string[] => Object.keys(record).sort()
const pick = <T>(list: T[], i: number): T | undefined => (list.length ? list[i % list.length] : undefined)
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T

type Canon = Record<string, unknown>
/** A document as compared: the camera out, lists by id. */
function canon(data: DiagramData): Canon {
  // A view keeps the places of what it draws; those of elements deleted
  // since stay in it until it is shown or read again, and draw nothing.
  const d = clone(withDrawnPositions(data)) as DiagramData & Record<string, unknown>
  delete d.defaultViewport
  for (const v of d.views ?? []) delete (v as Partial<DiagramView>).viewport
  // The nodes' places mirror the canvas shown when it was saved; All
  // elements' are in defaultPositions, each view's in the view.
  // Likewise All elements' places of elements deleted on a view.
  const live = new Set(d.nodes.map((n) => n.id))
  for (const id of Object.keys(d.defaultPositions ?? {})) if (!live.has(id)) delete d.defaultPositions![id]
  for (const n of d.nodes) {
    if (!d.defaultPositions?.[n.id]) continue
    const m = n as Partial<C4Node>
    delete m.x; delete m.y; delete m.width; delete m.height
  }
  return {
    ...d,
    nodes: byIdOf(d.nodes),
    relations: byIdOf(d.relations),
    views: byIdOf(d.views),
    sequences: byIdOf(d.sequences),
    snapshots: byIdOf(d.snapshots),
    presentations: byIdOf(d.presentations),
  }
}

/** What the store holds: the live document as saved, and the milestone
 *  shown over it with what was done in it. */
interface Full { doc: Canon; shown: Canon | null }
function full(store: Store): Full {
  const st = store.getState()
  const doc = canon(st.saveDiagram())
  if (!st.activeSnapshotId) return { doc, shown: null }
  const views = clone(st.views) as Record<string, DiagramView>
  for (const v of Object.values(views)) delete v.viewport
  return {
    doc,
    shown: clone({
      milestone: st.activeSnapshotId,
      nodes: st.c4Nodes,
      relations: st.c4Relations,
      sequences: st.sequences,
      views,
      defaultLayoutConstraints: st.defaultLayoutConstraints,
      defaultPositions: st.defaultPositions,
    }) as Canon,
  }
}

/** Where `a` and `b` differ, as "path: a → b", numbers within `tol`. */
function differences(a: unknown, b: unknown, tol = TOL, path = '', out: string[] = [], max = 12): string[] {
  if (out.length >= max) return out
  if (typeof a === 'number' && typeof b === 'number') {
    if (Math.abs(a - b) > tol || Number.isNaN(a) !== Number.isNaN(b)) out.push(`${path}: ${a} → ${b}`)
    return out
  }
  if (a === b) return out
  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object' || Array.isArray(a) !== Array.isArray(b)) {
    if (a === undefined && b === undefined) return out
    out.push(`${path}: ${short(a)} → ${short(b)}`)
    return out
  }
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) {
      out.push(`${path}: ${short(a)} → ${short(b)}`)
      return out
    }
    for (let i = 0; i < a.length; i++) differences(a[i], b[i], tol, `${path}[${i}]`, out, max)
    return out
  }
  const ao = a as Record<string, unknown>, bo = b as Record<string, unknown>
  for (const k of new Set([...Object.keys(ao), ...Object.keys(bo)])) {
    if (ao[k] === undefined && bo[k] === undefined) continue
    differences(ao[k], bo[k], tol, path ? `${path}.${k}` : k, out, max)
  }
  return out
}
function short(v: unknown): string {
  const s = JSON.stringify(v)
  return s === undefined ? 'undefined' : s.length > 160 ? `${s.slice(0, 160)}…` : s
}

/** What a folder writes as nothing: an empty text, an unticked box, an
 *  empty list. Taken out of both sides before comparing a folder round trip. */
function withoutBlanks(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(withoutBlanks)
  if (v && typeof v === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, x] of Object.entries(v)) {
      const y = withoutBlanks(x)
      if (y === '' || y === false || y === null || y === undefined) continue
      if (Array.isArray(y) && !y.length) continue
      if (y && typeof y === 'object' && !Array.isArray(y) && !Object.keys(y).length) continue
      out[k] = y
    }
    return out
  }
  return v
}

interface Box { x: number; y: number; width: number; height: number }
/** What the canvas shown draws, in canvas coordinates; null when the view
 *  shown is no canvas (a table, a wiki…). */
function drawn(st: State): { boxes: Record<string, Box>; parent: Record<string, string | undefined> } | null {
  const view = st.activeViewId ? st.views[st.activeViewId] : undefined
  // A dynamic view is drawn as a sequence diagram, a table as a table…:
  // only a Structure view and All elements are canvases.
  if (view && (view.kind ?? 'static') !== 'static') return null
  const rf = st.rfNodes
  const byId = Object.fromEntries(rf.map((n) => [n.id, n]))
  const boxes: Record<string, Box> = {}
  const parent: Record<string, string | undefined> = {}
  for (const n of rf) {
    if (n.hidden || (n.className ?? '').includes('ghost')) continue
    let { x, y } = n.position
    for (let p = n.parentNode; p && byId[p]; p = byId[p].parentNode) { x += byId[p].position.x; y += byId[p].position.y }
    boxes[n.id] = { x, y, width: Number(n.width ?? 0), height: Number(n.height ?? 0) }
    parent[n.id] = n.parentNode
  }
  return { boxes, parent }
}

/** Overlapping siblings and children outside their parent, as keys. */
function geometryKeys(st: State): Set<string> {
  const d = drawn(st)
  const out = new Set<string>()
  if (!d) return out
  const ids = Object.keys(d.boxes).sort()
  const groups = new Map<string, string[]>()
  for (const id of ids) {
    const p = d.parent[id] ?? ''
    if (!groups.has(p)) groups.set(p, [])
    groups.get(p)!.push(id)
  }
  for (const members of groups.values()) {
    for (let i = 0; i < members.length; i++) {
      for (let j = i + 1; j < members.length; j++) {
        const a = d.boxes[members[i]], b = d.boxes[members[j]]
        if (a.x < b.x + b.width - TOL && b.x < a.x + a.width - TOL && a.y < b.y + b.height - TOL && b.y < a.y + a.height - TOL) out.add(`overlap ${members[i]} ~ ${members[j]}`)
      }
    }
  }
  for (const id of ids) {
    const p = d.parent[id]
    if (!p || !d.boxes[p]) continue
    const c = d.boxes[id], f = d.boxes[p]
    if (c.x < f.x - TOL || c.y < f.y - TOL || c.x + c.width > f.x + f.width + TOL || c.y + c.height > f.y + f.height + TOL) out.add(`outside ${id} < ${p}`)
  }
  return out
}

function describeGeometry(st: State, key: string): string {
  const d = drawn(st)
  if (!d) return key
  const ids = key.replace(/^(overlap|outside) /, '').split(/ [~<] /)
  const label = (id: string) => `${st.c4Nodes[id]?.label ?? '?'} (${id})`
  const box = (b: Box | undefined) => (b ? `x ${r1(b.x)} y ${r1(b.y)} w ${r1(b.width)} h ${r1(b.height)}` : 'none')
  return `${key.startsWith('overlap') ? 'overlap' : 'outside'}: ${ids.map((id) => `${label(id)} [${box(d.boxes[id])}]`).join(key.startsWith('overlap') ? ' ~ ' : ' in ')}`
}
const r1 = (n: number) => Math.round(n * 10) / 10

/** Every reference of `data` (a document, or a milestone shown) that points at nothing. */
function danglingReferences(data: { nodes: Record<string, C4Node>; relations: Record<string, C4Relation>; sequences: Record<string, DiagramSequence>; views?: Record<string, DiagramView>; snapshots?: DiagramData['snapshots']; defaultPositions?: Record<string, unknown>; defaultLayoutConstraints?: LayoutConstraint[]; presentations?: DiagramData['presentations'] }, where: string): string[] {
  const out: string[] = []
  const { nodes, relations, sequences } = data
  for (const n of Object.values(nodes)) if (n.parentId && !nodes[n.parentId]) out.push(`${where}: ${n.label} (${n.id}) has missing parent ${n.parentId}`)
  for (const rel of Object.values(relations)) {
    if (!nodes[rel.sourceId] || !nodes[rel.targetId]) out.push(`${where}: relation ${rel.label ?? ''} (${rel.id}) ${rel.sourceId} → ${rel.targetId} has a missing end`)
  }
  for (const seq of Object.values(sequences)) {
    seq.relationIds.forEach((rid, i) => { if (!relations[rid]) out.push(`${where}: sequence ${seq.name} step ${i + 1} names missing relation ${rid}`) })
    if ((seq.stepDescriptions?.length ?? 0) > seq.relationIds.length) out.push(`${where}: sequence ${seq.name} has ${seq.stepDescriptions!.length} step texts for ${seq.relationIds.length} steps`)
    if (seq.stepBackward && (seq.stepBackward.length > seq.relationIds.length || seq.stepBackward[seq.stepBackward.length - 1] !== true)) out.push(`${where}: sequence ${seq.name} stepBackward ${JSON.stringify(seq.stepBackward)} for ${seq.relationIds.length} steps`)
  }
  // Views are the live model's and every milestone's: they may list what
  // only a milestone has.
  const inMilestone = new Set((data.snapshots ?? []).flatMap((m) => Object.keys(m.nodes)))
  const known = (id: string) => !!nodes[id] || inMilestone.has(id)
  const constraintIds = (list: LayoutConstraint[] | undefined, at: string) => {
    for (const c of list ?? []) for (const id of (c as { nodeIds?: string[] }).nodeIds ?? []) if (!known(id)) out.push(`${at}: ${c.type} ${c.id} holds missing ${id}`)
  }
  for (const v of Object.values(data.views ?? {})) {
    const at = `${where} view ${v.name}`
    for (const id of v.nodeIds ?? []) if (!known(id)) out.push(`${at}: nodeIds has missing ${id}`)
    for (const id of v.hiddenRelationIds ?? []) if (!relations[id]) out.push(`${at}: hiddenRelationIds has missing ${id}`)
    for (const id of (v as { collapsedNodeIds?: string[] }).collapsedNodeIds ?? []) if (!known(id)) out.push(`${at}: collapsedNodeIds has missing ${id}`)
    for (const id of (v as { expandedNodeIds?: string[] }).expandedNodeIds ?? []) if (!known(id)) out.push(`${at}: expandedNodeIds has missing ${id}`)
    if (v.sequenceId && !sequences[v.sequenceId]) out.push(`${at}: sequenceId ${v.sequenceId} is missing`)
    constraintIds(v.layoutConstraints, at)
  }
  constraintIds(data.defaultLayoutConstraints, `${where} All elements`)
  for (const m of data.snapshots ?? []) {
    const mn = m.nodes as Record<string, C4Node>, mr = m.relations as Record<string, C4Relation>
    for (const rel of Object.values(mr)) if (!mn[rel.sourceId] || !mn[rel.targetId]) out.push(`${where} milestone ${m.name}: relation ${rel.id} has a missing end`)
    for (const n of Object.values(mn)) if (n.parentId && !mn[n.parentId]) out.push(`${where} milestone ${m.name}: ${n.id} has missing parent ${n.parentId}`)
    for (const seq of Object.values((m.sequences ?? {}) as Record<string, DiagramSequence>)) {
      seq.relationIds.forEach((rid, i) => { if (!mr[rid]) out.push(`${where} milestone ${m.name}: sequence ${seq.name} step ${i + 1} names missing relation ${rid}`) })
    }
  }
  const milestones = new Set((data.snapshots ?? []).map((m) => m.id))
  for (const p of data.presentations ?? []) {
    for (const slide of p.slides) {
      if (slide.viewId && !data.views?.[slide.viewId]) out.push(`${where}: slide ${slide.name} shows missing view ${slide.viewId}`)
      if (slide.snapshotId && !milestones.has(slide.snapshotId)) out.push(`${where}: slide ${slide.name} shows missing milestone ${slide.snapshotId}`)
    }
  }
  return out
}

// ─── Driving the store to rest ──────────────────────────────────────────────

/** Steps the live physics until it rests; false when it did not within MAX_TICKS. */
function flushPhysics(): boolean {
  const t = timers()
  if (!t.timers.size) return true
  // The engine also caps a run by the clock (MAX_PROJECTED_RUN_MS): it reads
  // a frame clock here, 16 ms a tick, as on a screen, not the time the
  // ticks take to compute.
  const realNow = performance.now
  let frame = realNow.call(performance)
  performance.now = () => frame
  try {
    for (let n = 0; n < MAX_TICKS && t.timers.size; n++) { t.tick(); frame += 16 }
  } finally {
    performance.now = realNow
  }
  return t.timers.size === 0
}

async function settle(store: Store): Promise<boolean> {
  let rested = true
  for (let round = 0; round < 400; round++) {
    rested = flushPhysics()
    // Still moving after MAX_TICKS frames: reported, not waited for again.
    if (!rested) break
    // Microtasks and the 0 ms timers rAF stands for here.
    await new Promise((r) => setTimeout(r, 0))
    if (!store.getState().isLayoutRunning && !timers().timers.size) break
    if (store.getState().isLayoutRunning) await new Promise((r) => setTimeout(r, 2))
  }
  return rested
}

// ─── One run ────────────────────────────────────────────────────────────────

interface Violation {
  rule: string
  detail: string
  /** What KNOWN matchers read: for geometry, whether a pin holds the
   *  elements involved, their parent or an ancestor of it. */
  facts?: { pinned?: boolean; overlap?: boolean; outside?: boolean; childless?: boolean; aligned?: boolean; types?: string[] }
  /** Geometry: the new violations, as keys ("overlap a ~ b", "outside c < p"). */
  keys?: string[]
}
class RuleBroken extends Error {
  constructor(readonly violation: Violation, readonly trace: string[], readonly actions: Action[] = []) {
    super(`[${violation.rule}] ${violation.detail}\n  steps (as resolved):\n${trace.map((t, i) => `    ${i + 1}. ${t}`).join('\n')}`)
  }
}

/** A known product bug: a run that breaks `rule` where `match` says so ends
 *  there, without failing. Each names its IMPROVEMENTS item or says what
 *  happens. Remove the entry with the fix. */
interface Known { rule: string; match: (trace: Action[], v: Violation, resolved: string[]) => boolean; note: string }
const lastAction = (trace: Action[]): Action['a'] | undefined => trace[trace.length - 1]?.a
const KNOWN: Known[] = [
  {
    // Bookstore dragged by a pixel (pinned), then a component dropped into
    // Web App near its right edge: Web App grows 210 → 260.7 px wide, onto
    // API 80 px to its right; a pin holds what is in the container, so the
    // physics moves nothing. Without the pin the add makes room.
    rule: 'geometry',
    // The same for a move into a container that grows next to a pinned one.
    match: (t, v) => !!v.facts?.pinned && !!v.facts.overlap && ['add', 'reparent', 'collapse', 'redo', 'undo'].includes(lastAction(t) ?? ''),
    note: 'K1: what grows next to or inside a pinned element is left over its neighbour (IMPROVEMENTS "Calm drags and pins" item 2)',
  },
  {
    // A container dropped into Payment Provider, then Payment Provider and
    // Bookstore kept in a row: the physics frames Bookstore with 60 px over
    // its children; read again, the frame is refitted with 120 (top 333.5 →
    // 273.8, left −42.1 → −12.3, 980 → 920 wide), its children where they were.
    // The same after any add, expand or drag the physics framed a
    // container for (nested: Container 0.0 saved at (84, 84) 696 × 376,
    // read again at (30, 120) 624 × 404).
    rule: 'reloadKeeps',
    match: (_t, v) => v.detail.split('\n').slice(1).every((line) => /positions|^\s+[\w-]+\.(x|y|width|height):/i.test(line)),
    note: 'K2: a container the physics framed is framed anew on a reload, 60 → 120 px over its children (the leftover of item 1 of "Found by exploratory runs")',
  },
  {
    // Payment Provider moved into Bookstore on All elements: the Containers
    // view, which lists it, has no place for it any more; opening the view
    // places it and the physics moves Customer by (−179, −82), Bookstore
    // grows 860 → 1360 wide, its children shift.
    // The same for an add: nested, a container added into System 0 on the
    // System 0 view gets no place on Systems and containers (a filter
    // chain that draws it); opening that view shrinks System 0 2440 → 1380
    // and moves it 588 px right, System 1 210 px.
    rule: 'nothingMovesByItself',
    match: (t) => lastAction(t) === 'view' && t.some((a) => a.a === 'reparent' || a.a === 'add'),
    note: 'K3: a move into another parent, or an add, leaves other views that draw it without a place for it; opening one moves its neighbours (new)',
  },
  {
    // Nested, a new view of the System context viewpoint: System 0 moved
    // into System 1, which grows 280 × 180 → 360 × 330 over Operator.
    rule: 'geometry',
    match: (t, v) => lastAction(t) === 'reparent' && !!v.facts?.overlap,
    note: 'K3c: a move into another parent grows it over a neighbour on the canvas shown (new)',
  },
  {
    // K3 on the geometry: Orders DB deleted, API moved into Payment
    // Provider on All elements, Containers opened: there Payment Provider
    // has grown to 360 × 350 at (738, 333), 370 px over Bookstore.
    rule: 'geometry',
    match: (t, v) => lastAction(t) === 'view' && !!v.facts?.overlap && t.some((a) => a.a === 'reparent'),
    note: 'K3b: a move into another parent grows the parent over its neighbour on a view it was not made on (new)',
  },
  {
    // A group dropped on the bookstore's All elements at (310, 136): drawn
    // 360 × 220 at (50, −41), 55 px over Customer; a system dropped there
    // moves clear.
    rule: 'geometry',
    match: (t, v) => lastAction(t) === 'add' && !!v.facts?.overlap && !v.facts.pinned,
    note: 'K4: an element dropped where there is no room for it stays over its neighbours (new)',
  },
  {
    // API (no children: drawn 240 × 160, the model 300 × 200) dropped 81 px
    // right: drawn at x 371, saved at 401; the next rebuild (a fold, a
    // reload) draws it at 401 and 20 px lower, 1 px over Orders DB.
    rule: 'geometry',
    // The same on a view that does not draw a container's children (nested,
    // Systems and containers: Container 2.0, 1000 × 280 in the model, drawn
    // 240 × 160, jumps (380, 60) onto Container 2.1 when folded).
    match: (_t, v) => (!!v.facts?.overlap || !!v.facts?.outside) && !!v.facts?.childless,
    note: 'K5: a container drawn without its children is placed by the physics at its drawn size and saved at its model size: the next rebuild shifts it by half the difference (new)',
  },
  {
    // K5 seen from the parent: on a new view of the Containers viewpoint
    // (nested), folding Container 0.2 (drawn 240 × 160, 1000 × 280 in the
    // model) moves it (380, 60) and System 0 grows 681 → 1061 wide, over
    // System 2.
    rule: 'geometry',
    match: (t, v) => lastAction(t) === 'collapse' && !!v.facts?.overlap,
    note: 'K5b: a fold of a container drawn without its children moves it, and its parent grows over a neighbour (new)',
  },
  {
    // K5 through a row: API (drawn 240 wide, 300 in the model) and Orders
    // DB in a row, Bookstore folded and unfolded, then dragged 1 px: Orders
    // DB moves 55 px right (727 → 782), 25 px out of Bookstore.
    rule: 'geometry',
    match: (t, v) => lastAction(t) === 'drag' && !!v.facts?.outside && !!v.facts.aligned,
    note: 'K5c: a drag of a container moves a member of a row in it out of it, the row spaced by a container drawn without children (new)',
  },
  {
    // API and Orders DB in a row, API dragged 196 px right onto Orders DB:
    // they stay 56 px over each other, also after a view switch.
    rule: 'geometry',
    match: (t, v) => lastAction(t) === 'drag' && !!v.facts?.overlap && !!v.facts.aligned,
    note: 'K6: a calm drop onto an element of the same row leaves them overlapping (new; after the fix of "Calm drags and pins" item 3)',
  },
  {
    // API and Orders DB kept in a row, not saved yet, while the agent
    // deletes API: the merge keeps the row holding API; it is saved so.
    rule: 'references',
    // The same for a view's fold of it (collapsedNodeIds ["api"]).
    // And a view's list (Element Table listing all but API, the agent
    // deletes Bookstore: the merged list keeps bookstore, web, db).
    match: (t, v) => t.some((a) => a.a === 'agent') && /(: (align|grid|pin) .* holds missing|(collapsed|expanded)?NodeIds has missing|nodeIds has missing)/.test(v.detail),
    note: 'K7: a merge keeps an alignment, pin, view fold or view list entry of an element the other side deleted (new; sibling of item 234)',
  },
  {
    // API moved into Payment Provider (API → Payment Provider "charges
    // card", now a relation to its own container), then Smart Layout: 11
    // "[ELK] Layout error … UnsupportedGraphException" on the console; the
    // layout is applied all the same.
    rule: 'noErrors',
    match: (_t, v) => v.detail.includes('UnsupportedGraphException'),
    note: 'K8: Smart Layout logs ELK errors for a relation between an element and its container (new)',
  },
  {
    // "browses and orders" (step 1 of Place Order) deleted, the agent
    // deletes Bookstore with Web App, Undo: no relation comes back (its end
    // is gone) but the sequence has the step ["r1"] again, saved so.
    rule: 'references',
    match: (t, v) => t.some((a) => a.a === 'agent') && (lastAction(t) === 'undo' || lastAction(t) === 'redo') && /names missing relation/.test(v.detail),
    note: 'K9: Undo after an outside change brings back a sequence step whose relation it drops as a stray (new; sibling of items 127 and 234)',
  },
  {
    // Nested model: Component 0.0.0, 0.0.1, 0.0.2, one row already, kept in
    // a row: System 0 grows 2440 → 3040 and moves 814 px left, Container
    // 0.0 754 px left, Component 0.0.2 ends 40 px outside Container 0.0.
    rule: 'geometry',
    match: (t) => lastAction(t) === 'align',
    note: 'K10: keeping elements in a row moves their container far and leaves one outside it (new)',
  },
  {
    // K10 seen later: in the milestone Early a row of Component 0.0.0 and
    // 0.0.1 made, Propagate, reload: Container 0.0 is drawn at x −703, its
    // components at 80 to 760, outside it.
    rule: 'geometry',
    match: (t, v) => !!v.facts?.outside && t.some((a) => a.a === 'align') && ['reload', 'propagate', 'discard', 'view', 'openMilestone', 'undo', 'redo'].includes(lastAction(t) ?? ''),
    note: 'K10b: a row of components, read again or shown again, puts their container away from them (new)',
  },
  {
    // Sample, All elements: a component dropped into Fraud Detection moves
    // 43 elements (ADRs, needs, mockups, a process); the step Validate goes
    // from (270, 5696) to (−289, 5887), 220 → 556 wide, and its child
    // Screen for fraud stays at (290, 5856), outside it.
    rule: 'geometry',
    match: (t, v) => lastAction(t) === 'add' && !!v.facts?.outside,
    note: 'K11: an add moves elements with nothing in common with it and leaves a child outside its moved parent (new)',
  },
  {
    // Nested: Context open, milestone Early shown, a group dropped on the
    // canvas: the saved live Context lists the new id (no such element in
    // the live model or any milestone), and still does after Discard.
    rule: 'references',
    match: (t, v) => t.some((a) => a.a === 'openMilestone') && /nodeIds has missing/.test(v.detail),
    note: 'K12: an element added in a milestone is listed in the live view it was added on, also after Discard (new; sibling of item 230)',
  },
  {
    // A milestone shown, the agent adds a system (reloaded with the
    // milestone kept), a group added in the milestone, Propagate: TypeError
    // "Cannot perform 'ownKeys' on a proxy that has been revoked" in
    // propagatedHubTemplates (diagramStore.ts).
    rule: 'noErrors',
    match: (_t, v) => v.detail.includes('propagatedHubTemplates'),
    note: 'K13: Propagate throws after an agent write reloaded the milestone shown (new)',
  },
  {
    // An agent adds a system Studio reloads; with a view that does not draw
    // it shown (Place Order Flow, Containers), folding it and unfolding it
    // throws "Cannot read properties of undefined (reading 'x')" in
    // makeRoomAround (packages/layout/src/geometry.ts).
    rule: 'noErrors',
    match: (_t, v) => v.detail.includes('makeRoomAround'),
    note: 'K14: folding and unfolding a system an agent added, with a view shown that does not draw it, throws (new)',
  },
  {
    // Views of the viewpoint System › containers made (one is of System 2),
    // the milestone Early (no System 2) opened, Customer deleted, Undo: the
    // view of System 2 loses its subject and its "within System 2" filter,
    // shown and in the saved live views.
    rule: 'undoRestores',
    match: (_t, v) => /\.subject: /.test(v.detail),
    note: 'K15: Undo in a milestone that lacks a view\'s element strips the view of its element and filter, in the live views too (new)',
  },
  {
    // K15 the other way: a view of API's (Container › components), a
    // milestone with API opened, API deleted there; Undo, then Redo: the
    // view has lost its subject and its "within API" filter.
    rule: 'redoRestores',
    match: (_t, v) => /\.subject: /.test(v.detail),
    note: 'K15b: Undo and Redo of a delete in a milestone strip a view of that element of its element and filter (new)',
  },
  {
    // Nested: the agent deletes Component 1.0.0; Container 2.2 folded;
    // Component 2.2.0 moved into Container 0.1: System 1 (nothing to do
    // with the move) moves (−325, −476), Container 1.0 shrinks 520 × 280 →
    // 300 × 260 and Component 1.0.1 lies 50 px left of it.
    rule: 'geometry',
    match: (t, v) => t.some((a) => a.a === 'agent') && !!v.facts?.outside,
    note: 'K16: after an agent deletes a child, the next local layout moves its container and leaves a sibling outside it (new; next to "Calm drags and pins" item 6, agent adds)',
  },
  {
    // Bookstore: a milestone shown with edits; the agent moves Web App into
    // another system (the facade drops its place on Containers); a group
    // added in the milestone, Undo: the live Containers view has Web App's
    // old place (30, 120) again.
    rule: 'milestoneKeepsLive',
    match: (t) => (lastAction(t) === 'undo' || lastAction(t) === 'redo') && t.some((a) => a.a === 'agent'),
    note: 'K17: Undo in a milestone after an agent\'s write takes back part of the write in the live views (new; sibling of item 36)',
  },
  {
    // Nested: Component 1.1.1 moved into Container 2.0, a view of the
    // Components viewpoint laid out, the milestone Early opened (there it
    // is still in Container 1.1): on that view it is drawn exactly on
    // Component 1.1.2 (both at 359.3, 809.3).
    rule: 'geometry',
    // The same for a fold: Container 0.0 folded on live, a Components view
    // laid out, Early opened (there it is open): it is drawn 760 wide at
    // (30, 120), over Container 0.1 and 0.2.
    match: (t, v) => /^on (?!live\|)/.test(v.detail) && t.some((a) => a.a === 'reparent' || a.a === 'collapse' || (a.a === 'agent' && a.kind === 'move')),
    note: 'K18: in a milestone, an element moved or folded since on live is drawn on a view by the live layout, onto its siblings (new)',
  },
  {
    // A queue dropped into Payment Provider, not saved yet, while the agent
    // moves Orders DB into it: the merge puts both at (1140, 464.8).
    rule: 'geometry',
    // Also when it shows only later: a component of System 0 dragged (System
    // 0 grows, System 1 moves 21 px right), a milestone opened, the agent
    // adds a container into System 1 (the server grows it and moves System 2
    // from where System 1 was); back on live, System 1 overlaps System 2.
    match: (t, v, resolved) => !!v.facts?.overlap && (/merged with unsaved edits/.test(resolved[resolved.length - 1] ?? '') ||
      (['discard', 'view', 'reload', 'openMilestone'].includes(lastAction(t) ?? '') && resolved.some((r) => /merged with unsaved edits/.test(r)))),
    note: 'K19: a merge puts what Studio and the agent each placed or moved on top of each other (new)',
  },
  {
    // Sample, All elements: Auth Service folded, a component dropped into
    // Accounts Service: after 2500 frames (40 s at 60 fps) the physics
    // still runs and 19 elements still move (ADR-000 by 21 px a second).
    rule: 'nothingMovesByItself',
    match: (_t, v) => v.detail.includes('still moving'),
    note: 'K20: after an add on the sample\'s All elements the live physics never comes to rest (new)',
  },
  {
    // Sample: milestone v1 opened, Web Banking deleted there, Propagate:
    // the live model loses Web Banking and its relations, but the live
    // sequence Payment Processing keeps steps 1 and 2 (r-cust-web,
    // r-web-apigw), saved so.
    rule: 'references',
    match: (t, v) => t.some((a) => a.a === 'propagate') && /names missing relation/.test(v.detail),
    note: 'K21: Propagate of a delete leaves the live sequences\' steps of the relations it deletes (new)',
  },
]

const knownHits = new Map<string, number>()
const stats = { runs: 0, steps: 0, noOps: 0 }
const surveySkip = new Set<string>()
const signature = (v: Violation, actions: Action[]): string => `${v.rule}|${lastAction(actions)}`

interface Prepared {
  data: DiagramData
  /** Geometry violations on each canvas as the model opens: `${milestone|live}|${view|all}`. */
  baseline: Map<string, Set<string>>
  baselineAll: Set<string>
}

let second: Store

const CANVAS_LIMIT_FOR_SMART = 40

function canvasKey(st: State): string {
  return `${st.activeSnapshotId ?? 'live'}|${st.activeViewId ?? 'all'}`
}

async function prepare(name: string): Promise<Prepared> {
  const data = MODELS[name]()
  const store = second
  resetDeterminism(1)
  store.getState().setAppMode('designer')
  store.getState().loadDiagram(clone(data))
  await settle(store)
  const baseline = new Map<string, Set<string>>()
  const baselineAll = new Set<string>()
  const canvases = (st: State) => [null, ...Object.values(st.views).filter((v) => (v.kind ?? 'static') === 'static').map((v) => v.id)]
  for (const m of [null, ...store.getState().snapshots.map((x) => x.id)]) {
    if (m) {
      if (store.getState().activeSnapshotId) store.getState().discardMilestoneChanges()
      store.getState().selectMilestone(m)
    }
    for (const v of canvases(store.getState())) {
      store.getState().setActiveView(v)
      await settle(store)
      const keys = geometryKeys(store.getState())
      baseline.set(canvasKey(store.getState()), keys)
      for (const k of keys) baselineAll.add(k)
    }
  }
  store.getState().stopLiveLayout()
  return { data, baseline, baselineAll }
}

/** The run's world: what the "disk" holds, the undo chain the run expects. */
interface World {
  saved: DiagramData
  /** Steps made, as the states before and after, for chains of undo and redo. */
  undoChain: { before: Full; after: Full }[]
  redoChain: { before: Full; after: Full }[]
  /** The live document when the milestone shown was opened. */
  liveAtMilestone: Canon | null
  trace: string[]
  actions: Action[]
  /** Views an agent's write may have left with places that break
   *  containment: they settle when next opened (decided 2026-10-21), and
   *  the MCP server's own settling is not part of this harness. */
  maySettle: Set<string>
  /** After an agent's write: the canvases as first seen since, taken as
   *  they are. The MCP server settles the geometry of what it writes
   *  (settleGeometry), which this harness's agent does not. */
  afterAgent: Map<string, Set<string>> | null
  /** Geometry violations a KNOWN entry explained: the run goes on past
   *  them (they are left as they are), and they are not reported again. */
  knownGeometry: Set<string>
}

const EDITS = new Set<Action['a']>(['add', 'delete', 'deleteRel', 'rename', 'describe', 'reparent', 'drag', 'collapse', 'align', 'unalign', 'unpin', 'smartLayout', 'newView', 'viewKind', 'viewpointView', 'createMilestone', 'connect', 'seqAdd', 'seqRemove', 'seqBackward'])

function containerIds(st: State): string[] {
  return sortedIds(st.c4Nodes).filter((id) => isContainerType(st.c4Nodes[id].type))
}

async function runAction(store: Store, action: Action, w: World): Promise<string> {
  const st = store.getState()
  const nodeIds = sortedIds(st.c4Nodes)
  const relIds = sortedIds(st.c4Relations)
  const d = drawn(st)
  const drawnIds = d ? Object.keys(d.boxes).sort() : []
  const label = (id: string | undefined | null) => (id ? `${store.getState().c4Nodes[id]?.label ?? '?'} (${id})` : 'root')
  switch (action.a) {
    case 'add': {
      // A drop from the palette onto the canvas shown: into the container
      // under the point, or onto the canvas.
      if (!d) return 'add: no canvas'
      const parents = [null, ...drawnIds.filter((id) => isContainerType(st.c4Nodes[id]?.type) && !(st.rfNodes.find((n) => n.id === id)?.data as { collapsed?: boolean } | undefined)?.collapsed)]
      const parentId = parents[action.parent % parents.length]
      const parentType = parentId ? st.c4Nodes[parentId].type : undefined
      const types = Object.keys(st.metamodel?.nodeTypes ?? {}).sort().filter((t) => isParentAllowed(st.metamodel, t, parentType))
      const type = pick(types, action.type)
      if (!type) return `add: nothing fits into ${label(parentId)}`
      const size = nodeTypeSize(type, st.metamodel)
      let relX: number, relY: number
      if (parentId) {
        const b = d.boxes[parentId]
        relX = b.width * action.fx
        relY = b.height * action.fy
      } else {
        const all = Object.values(d.boxes)
        const minX = Math.min(0, ...all.map((b) => b.x)), maxX = Math.max(800, ...all.map((b) => b.x + b.width))
        const minY = Math.min(0, ...all.map((b) => b.y)), maxY = Math.max(600, ...all.map((b) => b.y + b.height))
        relX = minX + (maxX - minX) * action.fx
        relY = minY + (maxY - minY) * action.fy
      }
      const id = st.requestCreateNode({
        type, label: type[0].toUpperCase() + type.slice(1), description: '', technology: '', collapsed: false, external: false,
        parentId: parentId ?? undefined, x: relX - size.width / 2, y: relY - size.height / 2, ...size,
      } as Omit<C4Node, 'id'>, { skipWizard: true })
      return `add ${type} into ${label(parentId)} at (${r1(relX)}, ${r1(relY)}) → ${id || 'refused'}`
    }
    case 'delete': {
      const id = pick(nodeIds, action.el)
      if (!id) return 'delete: nothing'
      const name = label(id)
      st.requestDelete([id])
      store.getState().resolvePendingDelete(action.hide && st.activeViewId ? 'view' : 'model')
      return `${action.hide && st.activeViewId ? 'hide from view' : 'delete'} ${name}`
    }
    case 'deleteRel': {
      const id = pick(relIds, action.rel)
      if (!id) return 'deleteRel: nothing'
      st.removeRelation(id)
      return `delete relation ${id}`
    }
    case 'rename':
    case 'describe': {
      const id = pick(nodeIds, action.el)
      if (!id) return `${action.a}: nothing`
      const field = action.a === 'rename' ? 'label' : 'description'
      const name = label(id)
      // Typed letter by letter into the field.
      st.beginTyping()
      for (let i = 1; i <= action.text.length; i++) store.getState().updateNode(id, { [field]: action.text.slice(0, i) })
      store.getState().endTyping()
      return `type ${field} "${action.text}" into ${name}`
    }
    case 'reparent': {
      const id = pick(nodeIds, action.el)
      if (!id) return 'reparent: nothing'
      const targets = [null, ...containerIds(st).filter((c) => c !== id)]
      const to = targets[action.to % targets.length]
      st.reparentNodes([id], to)
      return `move ${label(id)} into ${label(to)}`
    }
    case 'drag': {
      if (!d) return 'drag: no canvas'
      const id = pick(drawnIds, action.el)
      if (!id) return 'drag: nothing drawn'
      const rf = st.rfNodes.find((n) => n.id === id)!
      const from = { ...rf.position }
      const abs = { x: d.boxes[id].x, y: d.boxes[id].y }
      st.liveGrab(id, from.x, from.y, 'calm', abs, [])
      for (const k of [1, 2, 3]) {
        store.getState().liveDrag(id, from.x + (action.dx * k) / 3, from.y + (action.dy * k) / 3, { x: abs.x + (action.dx * k) / 3, y: abs.y + (action.dy * k) / 3 })
      }
      store.getState().liveRelease(id, [], Math.abs(action.dx) > 0.5 || Math.abs(action.dy) > 0.5)
      return `drag ${label(id)} by (${action.dx}, ${action.dy})`
    }
    case 'collapse': {
      const candidates = (d ? drawnIds : nodeIds).filter((id) => isContainerType(st.c4Nodes[id]?.type))
      const id = pick(candidates, action.el)
      if (!id) return 'collapse: no container'
      st.toggleCollapse(id)
      return `collapse/expand ${label(id)}`
    }
    case 'align': {
      if (!d) return 'align: no canvas'
      const id = pick(drawnIds, action.el)
      if (!id) return 'align: nothing drawn'
      const siblings = drawnIds.filter((x) => x !== id && d.parent[x] === d.parent[id])
      const members = [id, ...siblings.slice(0, action.n)]
      if (members.length < 2) return `align: ${label(id)} has no sibling`
      const made = st.addAlignment(action.axis, members)
      return `keep in ${action.axis === 'horizontal' ? 'row' : 'column'}: ${members.map(label).join(', ')} → ${made ?? 'refused'}`
    }
    case 'unalign': {
      const lines = activeLayoutConstraints(st).filter((c) => c.type !== 'pin')
      const c = pick(lines, action.c)
      if (!c) return 'unalign: none'
      st.removeLayoutConstraint(c.id, st.activeViewId)
      return `remove ${c.type} ${c.id}`
    }
    case 'unpin': {
      const pinned = [...pinnedNodeIds(activeLayoutConstraints(st))].sort()
      const id = pick(pinned, action.el)
      if (!id) return 'unpin: none pinned'
      st.unpinNodes([id])
      return `unpin ${label(id)}`
    }
    case 'smartLayout': {
      if (!d) return 'smartLayout: no canvas'
      if (drawnIds.length > CANVAS_LIMIT_FOR_SMART) return `smartLayout: skipped (${drawnIds.length} drawn)`
      await st.runSmartLayout()
      return 'Smart Layout'
    }
    case 'view': {
      const views = sortedIds(st.views)
      const v = action.v < 0 || !views.length ? null : views[action.v % views.length]
      st.setActiveView(v)
      return `open ${v ? `view ${st.views[v].name} (${v})` : 'All elements'}`
    }
    case 'newView': {
      // "+ New view": a blank view, a table, opened.
      const id = st.addView(`View ${idCounter}`, 'table')
      store.getState().setActiveView(id)
      return `new view ${id}`
    }
    case 'viewKind': {
      const v = st.activeViewId
      if (!v || (st.views[v].kind ?? 'static') === action.kind) return 'viewKind: no change'
      st.setViewKind(v, action.kind)
      return `view type of ${st.views[v].name} → ${action.kind}`
    }
    case 'viewpointView': {
      const vps = (st.metamodel?.viewpoints ?? []).map((vp) => vp.id).sort()
      const vp = pick(vps, action.vp)
      if (!vp) return 'viewpointView: none'
      const id = st.addViewOfViewpoint(vp)
      if (id) store.getState().setActiveView(id)
      return `new view of viewpoint ${vp} → ${id}`
    }
    case 'createMilestone': {
      if (st.activeSnapshotId) return 'createMilestone: a milestone is shown'
      const id = st.createSnapshot(`M ${idCounter}`)
      return `save milestone ${id}`
    }
    case 'openMilestone': {
      const m = pick(st.snapshots.map((x) => x.id), action.m)
      if (!m) return 'openMilestone: none'
      st.selectMilestone(m)
      return `open milestone ${m}${store.getState().milestonePromptOpen ? ' (asked: unsaved edits)' : ''}`
    }
    case 'discard': {
      if (!st.activeSnapshotId) return 'discard: no milestone'
      st.discardMilestoneChanges()
      return 'back to live (discard)'
    }
    case 'saveAsNew': {
      if (!st.activeSnapshotId || !st.milestoneDirty) return 'saveAsNew: nothing to save'
      st.commitMilestoneChanges('new', `New ${idCounter}`)
      return 'Save as new'
    }
    case 'propagate': {
      if (!st.activeSnapshotId || !st.milestoneDirty) return 'propagate: nothing to save'
      st.commitMilestoneChanges('propagate')
      return 'Propagate'
    }
    case 'connect': {
      const from = pick(d ? drawnIds : nodeIds, action.from)
      const to = pick(d ? drawnIds : nodeIds, action.to)
      if (!from || !to || from === to) return 'connect: no pair'
      st.connectNodes(from, to)
      const choice = store.getState().relationTypeChoice
      if (choice) {
        const type = choice.types[action.pick % choice.types.length]
        store.getState().chooseRelationType(type)
        return `connect ${label(from)} → ${label(to)} as ${type}`
      }
      return `connect ${label(from)} → ${label(to)}`
    }
    case 'seqAdd': {
      const seq = pick(sortedIds(st.sequences), action.seq)
      const rel = pick(relIds, action.rel)
      if (!seq || !rel) return 'seqAdd: none'
      st.toggleRelationInSequence(seq, rel)
      return `toggle step ${rel} in sequence ${seq}`
    }
    case 'seqRemove':
    case 'seqBackward': {
      const seq = pick(sortedIds(st.sequences), action.seq)
      const steps = seq ? st.sequences[seq].relationIds.length : 0
      if (!seq || !steps) return `${action.a}: none`
      const i = action.step % steps
      if (action.a === 'seqRemove') st.removeFromSequence(seq, i)
      else st.setStepBackward(seq, i, !st.sequences[seq].stepBackward?.[i])
      return `${action.a === 'seqRemove' ? 'remove' : 'flip direction of'} step ${i + 1} of ${seq}`
    }
    case 'agent':
      return agentWrite(store, action, w)
    case 'save': {
      w.saved = clone(st.saveDiagram())
      return 'autosave writes the document'
    }
    case 'undo':
      st.undo()
      return 'Undo'
    case 'redo':
      st.redo()
      return 'Redo'
    case 'reload': {
      const viewId = st.activeViewId
      const text = JSON.stringify(st.saveDiagram())
      w.saved = JSON.parse(text) as DiagramData
      store.getState().loadDiagram(JSON.parse(text) as DiagramData)
      if (viewId && store.getState().views[viewId]) store.getState().setActiveView(viewId)
      return `reload (on ${viewId ?? 'All elements'})`
    }
  }
}

/** An agent's write to the folder (as the MCP server makes it, through the
 *  model facade), read by Studio: merged with the edits not saved yet, as
 *  autosave.ts does, and loaded as an outside change. */
function agentWrite(store: Store, action: Extract<Action, { a: 'agent' }>, w: World): string {
  const throughFolder = (data: DiagramData): DiagramData => deserializeFromMdFolder(serializeToMdFolder(data)).data
  const disk = throughFolder(clone(w.saved))
  const facade = createModelFacade(disk, { newId: nextId })
  const nodes = facade.getNodes()
  const ids = sortedIds(nodes)
  const id = pick(ids, action.el)
  const other = pick(ids, action.el2)
  let what: string
  switch (action.kind) {
    case 'add': {
      const parents = [undefined, ...ids.filter((x) => isContainerType(nodes[x].type))]
      const parentId = parents[action.el % parents.length]
      const mm = facade.getMetamodel?.()
      const type = ['component', 'container', 'system', 'person', 'requirement'].find((t) => mm?.nodeTypes[t] && isParentAllowed(mm, t, parentId ? nodes[parentId].type : undefined))
      if (!type) return 'agent add: nothing fits'
      const at = placeNewNode(nodes, parentId)
      const made = facade.addNode({ type, label: `Agent ${type}`, description: '', collapsed: false, parentId, ...at, ...nodeTypeSize(type, mm) } as Omit<C4Node, 'id'>)
      what = `adds ${type} ${made} into ${parentId ?? 'root'}`
      break
    }
    case 'rename':
      if (!id) return 'agent rename: nothing'
      facade.updateNode(id, { label: 'Renamed by agent' })
      what = `renames ${id}`
      break
    case 'describe':
      if (!id) return 'agent describe: nothing'
      facade.updateNode(id, { description: 'Written by the agent.' })
      what = `describes ${id}`
      break
    case 'delete':
      if (!id) return 'agent delete: nothing'
      facade.removeNode(id)
      what = `deletes ${id}`
      break
    case 'move': {
      if (!id) return 'agent move: nothing'
      const targets = [null, ...ids.filter((x) => x !== id && isContainerType(nodes[x].type))]
      const to = targets[action.el2 % targets.length]
      facade.moveNodes?.([id], to)
      what = `moves ${id} into ${to ?? 'root'}`
      break
    }
    case 'relate':
      if (!id || !other || id === other) return 'agent relate: no pair'
      facade.addRelation({ sourceId: id, targetId: other, label: 'agent' })
      what = `relates ${id} → ${other}`
      break
  }
  if (facade.lastError) return `agent ${action.kind} refused: ${facade.lastError}`
  const written = facade.toDiagramData()
  serverSettles(disk, written)
  const theirs = throughFolder(written)
  const st = store.getState()
  const ours = clone(st.saveDiagram())
  const unsaved = differences(canon(ours), canon(w.saved), 0, '', [], 1).length > 0
  const viewId = st.activeViewId
  const selected = st.selectedNodeId
  if (unsaved) {
    const { merged } = mergeModels(w.saved, ours, theirs)
    st.loadDiagram(clone(merged), { outsideChange: true })
  } else {
    st.loadDiagram(theirs, { outsideChange: true })
  }
  const next = store.getState()
  if (viewId && next.views[viewId]) next.setActiveView(viewId)
  if (selected && next.c4Nodes[selected]) next.selectNode(selected)
  // What Studio writes next: the merge (saved soon after), or the folder as read.
  w.saved = unsaved ? clone(store.getState().saveDiagram()) : theirs
  return `agent ${what}${unsaved ? ' (merged with unsaved edits)' : ''}`
}

/** What the MCP server does to a write's geometry before it saves it, as
 *  settleGeometry in apps/mcp/src/folderModel.ts (kept in step by hand):
 *  parents refitted around what was added, moved or removed, with room
 *  made round them, moved nodes settled, All elements' places written. */
function serverSettles(before: DiagramData, after: DiagramData): void {
  const old = byIdOf(before.nodes)
  const nodes = byIdOf(after.nodes)
  const depth = (node: C4Node): number => {
    let d = 0
    for (let cur = node.parentId ? nodes[node.parentId] : undefined; cur && d < 64; cur = cur.parentId ? nodes[cur.parentId] : undefined) d++
    return d
  }
  const parents = new Set<string>()
  const touch = (id: string | undefined): void => { if (id && nodes[id]) parents.add(id) }
  for (const node of after.nodes) {
    const prev = old[node.id]
    if (!prev) touch(node.parentId)
    else if (prev.parentId !== node.parentId) { touch(prev.parentId); touch(node.parentId) }
  }
  const moved = after.nodes.filter((node) => old[node.id] && old[node.id].parentId !== node.parentId).map((node) => node.id)
  const canvas = modelCanvas(nodes)
  const fit = (id: string): void => fitShown(nodes, id, { shown: () => true })
  const foldsAbove = new Set(moved.flatMap((id) => {
    const out: string[] = []
    for (let p = nodes[id].parentId; p && nodes[p] && !out.includes(p); p = nodes[p].parentId) out.push(p)
    return out
  }))
  const open = Object.fromEntries(Object.entries(nodes).map(([id, n]) => [id, foldsAbove.has(id) ? { ...n, collapsed: false } : n]))
  const opened = modelCanvas(open)
  settleMovedNodes(nodes, moved, canvas, fit, { shown: opened.shown, boxOf: (n) => opened.boxOf(foldsAbove.has(n.id) ? { ...n, collapsed: false } : n) })
  for (const node of before.nodes) if (!nodes[node.id]) touch(node.parentId)
  for (const id of [...parents].sort((a, b) => depth(nodes[b]) - depth(nodes[a]))) growWithRoom(nodes, id, canvas, fit)
  if (moved.length) applyAlignments(nodes, viewLayoutInput(undefined, nodes, byIdOf(after.relations), after.defaultLayoutConstraints))
  if (!after.defaultPositions) return
  for (const node of after.nodes) {
    const prev = old[node.id]
    if (prev && prev.x === node.x && prev.y === node.y && prev.width === node.width && prev.height === node.height) continue
    after.defaultPositions[node.id] = { x: node.x, y: node.y, width: node.width, height: node.height }
  }
}

// ─── The checks ─────────────────────────────────────────────────────────────

/** Issues of the model shown that say it breaks its metamodel's structure:
 *  a parent, a place, a relation's ends or type, a reference, a maximum.
 *  Missing required values are left out: the palette's add skips the
 *  wizard that would ask for them. */
const STRUCTURAL = /^(bad-parent|bad-place|needs-parent|parent-missing|bad-rel|rel-end-missing|unknown-rel-type|bad-rel-type|untyped-rel|cardinality-max|bad-ref):/
function issueIds(st: State): Map<string, string> {
  const issues = st.metamodel ? validateModel(st.c4Nodes, st.c4Relations, st.metamodel as Metamodel) : []
  return new Map(issues.map((i) => [i.id, i.message]))
}

async function checkReload(store: Store): Promise<Violation | null> {
  const st = store.getState()
  const text = JSON.stringify(st.saveDiagram())
  const saved = canon(JSON.parse(text) as DiagramData)
  const other = second.getState()
  other.setAppMode('designer')
  other.loadDiagram(JSON.parse(text) as DiagramData)
  const viewId = st.activeViewId
  if (viewId && second.getState().views[viewId]) second.getState().setActiveView(viewId)
  await settle(second)
  try {
    const again = canon(second.getState().saveDiagram())
    sameUnplaced(saved, again)
    // A view with no places of its own shows All elements' and saves them
    // as its own once shown (firstCanvasPositions).
    for (const [id, v] of Object.entries(saved.views as Record<string, DiagramView>)) {
      if (Object.keys(v.positions ?? {}).length) continue
      const other = (again.views as Record<string, DiagramView>)[id]
      if (other) other.positions = {}
    }
    const diff = differences(saved, again)
    if (diff.length) return { rule: 'reloadKeeps', detail: `the document read again saves differently:\n      ${diff.join('\n      ')}` }
    // The canvas shown: the same boxes (with no milestone over it).
    if (!st.activeSnapshotId) {
      const a = drawn(st), b = drawn(second.getState())
      if (a && b) {
        const moved = differences(a.boxes, b.boxes)
        if (moved.length) return { rule: 'reloadKeeps', detail: `the canvas shown draws differently after a reload:\n      ${moved.join('\n      ')}` }
      }
    }
    return null
  } finally {
    second.getState().stopLiveLayout()
  }
}

/** The document with each view's places of what it draws only, as a load reads it. */
function withDrawnPositions(data: DiagramData): DiagramData {
  const nodes = byIdOf(data.nodes), relations = byIdOf(data.relations)
  return { ...data, views: withCanvasPositions(data.views ?? [], nodes, (view) => viewDrawnIds(view, nodes, relations)) }
}

/** What was added on a view (or in a milestone, then propagated) has no
 *  place on All elements until All elements is shown or the model read
 *  again; then it gets one (placeUnplaced), and its parents and neighbours
 *  make room there. With such an element in `was`, All elements' places are
 *  not compared (taken out of both). */
function sameUnplaced(was: Canon, now: Canon): void {
  const places = was.defaultPositions as Record<string, unknown> | undefined
  if (!Object.keys(was.nodes as object).some((id) => !places?.[id])) return
  for (const side of [was, now]) {
    delete side.defaultPositions
    for (const n of Object.values(side.nodes as Record<string, Partial<C4Node>>)) { delete n.x; delete n.y; delete n.width; delete n.height }
  }
}

function checkFolder(store: Store): Violation | null {
  const doc = store.getState().saveDiagram()
  const back = deserializeFromMdFolder(serializeToMdFolder(clone(doc))).data
  const a = withoutBlanks(canon(doc)) as Canon, b = withoutBlanks(canon(back)) as Canon
  // The folder keeps no camera and no Hub concept meta; the metamodel is
  // compared on its own below.
  const diff = differences(a, b)
  return diff.length ? { rule: 'folderRoundTrip', detail: `written as a folder and read back:\n      ${diff.join('\n      ')}` } : null
}

function checkReferences(store: Store): Violation | null {
  const st = store.getState()
  const doc = st.saveDiagram()
  const out = danglingReferences({
    nodes: byIdOf(doc.nodes), relations: byIdOf(doc.relations), sequences: byIdOf(doc.sequences), views: byIdOf(doc.views),
    snapshots: doc.snapshots, defaultPositions: doc.defaultPositions, defaultLayoutConstraints: doc.defaultLayoutConstraints, presentations: doc.presentations,
  }, 'saved')
  if (st.activeSnapshotId) {
    // Views are the live model's and every milestone's: they may list what
    // the milestone shown does not have.
    out.push(...danglingReferences({ nodes: st.c4Nodes, relations: st.c4Relations, sequences: st.sequences }, `milestone ${st.activeSnapshotId} shown`))
  }
  return out.length ? { rule: 'references', detail: out.slice(0, 8).join('\n      ') } : null
}

function checkGeometry(store: Store, prepared: Prepared, accepted?: Set<string>): Violation | null {
  const st = store.getState()
  const keys = geometryKeys(st)
  const base = prepared.baseline.get(canvasKey(st)) ?? prepared.baselineAll
  const fresh = [...keys].filter((k) => !base.has(k) && !accepted?.has(k))
  if (!fresh.length) return null
  const pins = new Set(pinnedNodeIds(activeLayoutConstraints(st)))
  // A pin on the element, an ancestor, or anything inside it.
  const held = (id: string): boolean => {
    for (let cur: string | undefined = id; cur; cur = st.c4Nodes[cur]?.parentId) if (pins.has(cur)) return true
    for (const pinned of pins) for (let cur: string | undefined = pinned; cur; cur = st.c4Nodes[cur]?.parentId) if (cur === id) return true
    return false
  }
  const ids = fresh.flatMap((k) => k.replace(/^(overlap|outside) /, '').split(/ [~<] /))
  return {
    rule: 'geometry',
    keys: fresh,
    detail: `on ${canvasKey(st)}: ${fresh.slice(0, 4).map((k) => describeGeometry(st, k)).join('\n      ')}`,
    facts: {
      pinned: ids.some(held),
      overlap: fresh.some((k) => k.startsWith('overlap')),
      outside: fresh.some((k) => k.startsWith('outside')),
      // A container with nothing drawn in it is drawn smaller than the model has it.
      childless: ids.some((id) => isContainerType(st.c4Nodes[id]?.type) && !st.rfNodes.some((n) => n.parentNode === id && !n.hidden)),
      types: [...new Set(ids.map((id) => st.c4Nodes[id]?.type ?? '?'))],
      aligned: activeLayoutConstraints(st).some((c) => c.type !== 'pin' && c.nodeIds.some((id) => ids.includes(id))),
    },
  }
}

/** One action, then every check; throws RuleBroken on the first broken rule. */
async function step(store: Store, action: Action, w: World, prepared: Prepared): Promise<void> {
  const started = performance.now()
  try {
    await checkedStep(store, action, w, prepared)
  } finally {
    const ms = performance.now() - started
    if (ms > 1500 && SURVEY_FILE) (await import('node:fs' as string)).appendFileSync(SURVEY_FILE, `slow step ${Math.round(ms)} ms: ${w.trace[w.trace.length - 1]}\n`)
  }
}

async function checkedStep(store: Store, action: Action, w: World, prepared: Prepared): Promise<void> {
  const fail = (v: Violation): never => {
    throw new RuleBroken(v, w.trace, [...w.actions])
  }
  const st0 = store.getState()
  const before = full(store)
  const mark = historyMark()
  const shownBefore = st0.activeSnapshotId
  const issuesBefore = issueIds(st0)
  const errors: string[] = []
  const consoleError = vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => { errors.push(args.map(String).join(' ').slice(0, 300)) })
  let text: string
  try {
    text = await runAction(store, action, w)
    if (!(await settle(store))) {
      w.actions.push(action)
      w.trace.push(text)
      fail({ rule: 'nothingMovesByItself', detail: `the live physics was still moving ${MAX_TICKS} frames after the step` })
    }
  } catch (e) {
    if (e instanceof RuleBroken) throw e
    w.actions.push(action)
    w.trace.push(`${showAction(action)} (threw)`)
    fail({ rule: 'noErrors', detail: `the action threw: ${(e as Error).stack?.split('\n').slice(0, 6).join('\n      ')}` })
  } finally {
    consoleError.mockRestore()
  }
  w.actions.push(action)
  w.trace.push(text!)
  if (errors.length) fail({ rule: 'noErrors', detail: `console.error: ${errors.slice(0, 3).join(' | ')}` })

  const st = store.getState()
  const after = full(store)
  const steps = historyMark() - mark

  // References first: the other checks read through them.
  const refs = checkReferences(store)
  if (refs) fail(refs)

  if (action.a === 'agent') w.afterAgent = new Map()
  const seenSince = w.afterAgent
  // The server settles All elements; a view settles when it is next opened.
  if (seenSince && st.activeViewId && !seenSince.has(canvasKey(st))) seenSince.set(canvasKey(st), geometryKeys(st))
  const geometry = checkGeometry(store, prepared, new Set([...(seenSince?.get(canvasKey(st)) ?? []), ...w.knownGeometry]))
  if (geometry) {
    // A known geometry bug does not end the run: what it left stays, and
    // the run goes on to find others.
    const known = NO_KNOWN ? undefined : KNOWN.find((k) => k.rule === 'geometry' && k.match(w.actions, geometry, w.trace))
    if (!known) fail(geometry)
    knownHits.set(known!.note, (knownHits.get(known!.note) ?? 0) + 1)
    for (const k of geometry.keys ?? []) w.knownGeometry.add(k)
  }

  // Studio does not let the user build what its own validation flags
  // (rule 8): a user's edit adds no structural issue.
  if (EDITS.has(action.a) && (shownBefore ?? null) === (st.activeSnapshotId ?? null)) {
    const fresh = [...issueIds(st)].filter(([id]) => !issuesBefore.has(id) && STRUCTURAL.test(id))
    if (fresh.length) fail({ rule: 'validation', detail: `"${text!}" made the model break its metamodel:\n      ${fresh.slice(0, 5).map(([id, m]) => `${id}: ${m}`).join('\n      ')}` })
  }

  // A milestone shown: the live document stays as it was opened.
  if (st.activeSnapshotId && !shownBefore) w.liveAtMilestone = before.doc
  if (shownBefore && w.liveAtMilestone) {
    if (action.a === 'saveAsNew' || action.a === 'createMilestone') {
      const { snapshots: _a, ...was } = w.liveAtMilestone
      const { snapshots: _b, ...now } = after.doc
      const diff = differences(was, now)
      if (diff.length) fail({ rule: 'milestoneKeepsLive', detail: `Save as new changed the live document:\n      ${diff.join('\n      ')}` })
      w.liveAtMilestone = after.doc
    } else if (action.a === 'newView' || action.a === 'viewpointView' || action.a === 'undo' || action.a === 'redo') {
      // Views are the live model's as much as a milestone's: a view made in
      // a milestone is made (Studio's rule, not an edit of the milestone),
      // and Undo takes it back.
      const both = (x: Canon, y: Canon) => Object.fromEntries(Object.entries(x.views as object).filter(([id]) => id in (y.views as object)))
      const was = { ...w.liveAtMilestone, views: both(w.liveAtMilestone, after.doc) }
      const now = { ...after.doc, views: both(after.doc, w.liveAtMilestone) }
      const diff = differences(was, now)
      if (diff.length) fail({ rule: 'milestoneKeepsLive', detail: `a new view made with the milestone shown changed the rest of the live document:\n      ${diff.join('\n      ')}` })
      w.liveAtMilestone = after.doc
    } else if (action.a === 'propagate' || action.a === 'agent' || action.a === 'reload') {
      w.liveAtMilestone = st.activeSnapshotId ? after.doc : null
    } else {
      // A view with no places of its own takes All elements' once shown
      // on live (firstCanvasPositions): not an edit of the milestone.
      const was = clone({ ...w.liveAtMilestone, views: { ...(w.liveAtMilestone.views as Record<string, DiagramView>) } })
      const now = clone({ ...after.doc, views: { ...(after.doc.views as Record<string, DiagramView>) } })
      sameUnplaced(was, now)
      for (const [id, v] of Object.entries(was.views)) {
        if (!Object.keys(v.positions ?? {}).length && now.views[id]) now.views[id] = { ...now.views[id], positions: {} }
      }
      const diff = differences(was, now)
      if (diff.length) fail({ rule: 'milestoneKeepsLive', detail: `${st.activeSnapshotId ? 'with the milestone shown' : 'back on live'}, the live document changed:\n      ${diff.join('\n      ')}` })
    }
  }
  if (!st.activeSnapshotId) w.liveAtMilestone = null

  // Undo and redo.
  if (steps > 1 && action.a !== 'undo' && action.a !== 'redo') {
    fail({ rule: 'oneStepPerAction', detail: `one action made ${steps} undo steps` })
  }
  const resetsHistory = action.a === 'reload' || action.a === 'agent' || action.a === 'saveAsNew' || action.a === 'propagate' ||
    (st.activeSnapshotId ?? null) !== (shownBefore ?? null)
  if (action.a === 'undo' || action.a === 'redo') {
    const from = action.a === 'undo' ? w.undoChain : w.redoChain
    const to = action.a === 'undo' ? w.redoChain : w.undoChain
    const entry = from.pop()
    if (entry && steps > 0) {
      const expected = action.a === 'undo' ? entry.before : entry.after
      const diff = differences(expected, after)
      if (diff.length) fail({ rule: action.a === 'undo' ? 'undoRestores' : 'redoRestores', detail: `${action.a === 'undo' ? 'Undo' : 'Redo'} in a chain did not give back the state ${action.a === 'undo' ? 'before' : 'after'} its step:\n      ${diff.join('\n      ')}` })
      to.push(entry)
    } else if (entry) {
      // Nothing to undo or redo where the chain has a step: Undo or Redo
      // lost it.
      const canDo = action.a === 'undo' ? st.canUndo : st.canRedo
      fail({ rule: action.a === 'undo' ? 'undoRestores' : 'redoRestores', detail: `${action.a === 'undo' ? 'Undo' : 'Redo'} did nothing (can${action.a === 'undo' ? 'Undo' : 'Redo'} ${canDo}) though a step was made before it` })
    } else if (!entry) {
      // Steps from before an outside change or a reload: not followed, and
      // what they put on the other stack is not either.
      from.length = 0
      to.length = 0
    }
  } else if (steps > 0) {
    // Undo gives back the state before the step; Redo the one after it.
    store.getState().undo()
    await settle(store)
    const undone = full(store)
    const diffUndo = differences(before, undone)
    if (diffUndo.length) fail({ rule: 'undoRestores', detail: `Undo of "${text!}" did not give back the state before it:\n      ${diffUndo.join('\n      ')}` })
    store.getState().redo()
    await settle(store)
    const redone = full(store)
    const diffRedo = differences(after, redone)
    if (diffRedo.length) fail({ rule: 'redoRestores', detail: `Redo of "${text!}" did not give back the state after it:\n      ${diffRedo.join('\n      ')}` })
    if (resetsHistory) { w.undoChain.length = 0 } else w.undoChain.push({ before, after })
    w.redoChain.length = 0
  } else {
    // Opening or leaving a milestone changes what is shown, not the model.
    const [was, now] = [clone(before.doc), clone(after.doc)]
    if (!EDITS.has(action.a)) sameUnplaced(was, now)
    const diff = differences(was, now)
    if (!diff.length && (shownBefore ?? null) === (st.activeSnapshotId ?? null)) {
      // The milestone's nodes hold the places of the canvas shown.
      const placeless = (f: Canon | null): unknown => f && { ...f, nodes: Object.fromEntries(Object.entries(f.nodes as Record<string, C4Node>).map(([id, n]) => [id, { ...n, x: 0, y: 0, width: 0, height: 0 }])) }
      diff.push(...differences(action.a === 'view' ? placeless(before.shown) : before.shown, action.a === 'view' ? placeless(after.shown) : after.shown))
    }
    if (diff.length) {
      // A view opened for the first time with no places of its own (a view
      // per element, a viewpoint's) is laid out then, as no step (decided).
      const shownView = st.activeViewId ? (before.doc.views as Record<string, DiagramView>)[st.activeViewId] : undefined
      const firstLayout = action.a === 'view' && !!shownView && !Object.keys(shownView.positions ?? {}).length
      // All elements shown again gives a place to what was added on a view
      // since (placeUnplaced), and its parents and neighbours make room.
      const unplaced = Object.keys(before.doc.nodes as object).some((id) => !(before.doc.defaultPositions as Record<string, unknown> | undefined)?.[id])
      const placesAll = action.a === 'view' && st.activeViewId === null && unplaced
      const settles = firstLayout || placesAll || (action.a === 'view' && w.maySettle.has(st.activeViewId ?? ''))
      if (!settles && !EDITS.has(action.a) && action.a !== 'agent' && action.a !== 'reload' && action.a !== 'saveAsNew' && action.a !== 'propagate' && action.a !== 'discard') {
        fail({ rule: 'nothingMovesByItself', detail: `"${text!}" changed the model:\n      ${diff.join('\n      ')}` })
      }
      if (EDITS.has(action.a)) fail({ rule: 'undoRestores', detail: `"${text!}" changed the model with no undo step:\n      ${diff.join('\n      ')}` })
      w.undoChain.length = 0
      w.redoChain.length = 0
    }
  }
  if (resetsHistory) { w.undoChain.length = 0; w.redoChain.length = 0 }
  if (action.a === 'agent') for (const id of Object.keys(st.views)) if (id !== st.activeViewId) w.maySettle.add(id)
  if (action.a === 'view') w.maySettle.delete(st.activeViewId ?? '')

  const folder = checkFolder(store)
  if (folder) fail(folder)

  const reload = await checkReload(store)
  if (reload) fail(reload)
}

async function runSequence(name: string, prepared: Prepared, actions: Action[]): Promise<void> {
  const store = useDiagramStore
  resetDeterminism(1)
  store.getState().setAppMode('designer')
  store.getState().loadDiagram(clone(prepared.data))
  await settle(store)
  const w: World = { saved: clone(store.getState().saveDiagram()), undoChain: [], redoChain: [], liveAtMilestone: null, trace: [], actions: [], maySettle: new Set(), afterAgent: null, knownGeometry: new Set() }
  try {
    stats.runs++
    for (const action of actions) {
      await step(store, action, w, prepared)
      stats.steps++
      if (/: (no |nothing|none|skipped)|no change|no pair|no sibling|no canvas|refused/.test(w.trace[w.trace.length - 1])) stats.noOps++
    }
  } catch (e) {
    if (e instanceof RuleBroken) {
      const known = NO_KNOWN ? undefined : KNOWN.find((k) => k.rule === e.violation.rule && k.match(w.actions, e.violation, w.trace))
      if (known) {
        knownHits.set(known.note, (knownHits.get(known.note) ?? 0) + 1)
        return
      }
      if (surveySkip.has(signature(e.violation, w.actions))) return
      e.message = `${name}: ${e.message}`
    }
    throw e
  } finally {
    store.getState().stopLiveLayout()
  }
}

// ─── The properties ─────────────────────────────────────────────────────────

/** CI: fixed seeds, runs sized to keep the file under a minute. */
const PLAN: Record<string, { seed: number; runs: number; maxLength: number }> = {
  bookstore: { seed: 20261021, runs: 80, maxLength: 20 },
  nested: { seed: 4242, runs: 40, maxLength: 20 },
  sample: { seed: 777, runs: 12, maxLength: 15 },
}

beforeAll(async () => {
  Math.random = seededRandom
  vi.spyOn(globalThis.crypto, 'randomUUID').mockImplementation(() => nextId() as `${string}-${string}-${string}-${string}-${string}`)
  vi.spyOn(console, 'log').mockImplementation(() => {})
  vi.spyOn(console, 'info').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  second = (await import('../src/store/diagramStore?second' as string)).useDiagramStore as Store
  second.getState().stopLiveLayout()
})
afterAll(() => {
  Math.random = realRandom
  vi.restoreAllMocks()
  realLog(`invariants: ${stats.runs} runs, ${stats.steps} steps (${stats.noOps} found nothing to act on)`)
  if (knownHits.size) {
    realLog(`known violations hit: ${[...knownHits].map(([k, n]) => `${n}× ${k}`).join('; ')}`)
  }
})

describe('the rules hold over random sequences of actions', () => {
  for (const name of Object.keys(PLAN)) {
    if (ONLY_MODEL && ONLY_MODEL !== name) continue
    const plan = PLAN[name]
    it(`on the ${name} model`, async () => {
      const prepared = await prepare(name)
      const property = fc.asyncProperty(fc.array(actionArb, { minLength: 1, maxLength: LENGTH ?? plan.maxLength, size: 'max' }), async (actions) => {
        await runSequence(name, prepared, actions)
      })
      const options = { seed: SEED ?? plan.seed, numRuns: RUNS ?? plan.runs, ...(PATH ? { path: PATH } : {}), verbose: 1 as const, endOnFailure: NO_SHRINK }
      if (!SURVEY) {
        await fc.assert(property, options)
        return
      }
      // Survey: report each failure, then go on with its rule and last
      // action taken as known, to find the others in one go.
      for (let round = 0; round < 25; round++) {
        const result = await fc.check(property, options)
        if (!result.failed) break
        const report = `\n===== SURVEY ${name} #${round + 1}\n${fc.defaultReportMessage(result)}\n${(result.errorInstance as Error | undefined)?.message ?? ''}\n`
        if (SURVEY_FILE) (await import('node:fs' as string)).appendFileSync(SURVEY_FILE, report)
        else realLog(report)
        const e = result.errorInstance
        if (!(e instanceof RuleBroken)) break
        surveySkip.add(signature(e.violation, e.actions))
      }
    }, RUNS ? 24 * 3_600_000 : 600_000)
  }
})
