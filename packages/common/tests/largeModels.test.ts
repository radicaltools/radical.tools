import { describe, expect, it } from 'vitest'
import { parseSearch, searchFoldCount, searchModel, searchScanCount, type SearchData } from '../src/search'
import { addChoices, buildViewIndex, modelStructure, presetViewIndex, viewIndexKey, viewShownNodes } from '../src/viewPipeline'
import { MdFolderSession, readEach, type MdFolderStorage } from '../src/formats/mdFolderSync'
import { builtInGovernanceMetamodel } from '../src/metamodel'
import type { C4Node, C4Relation, DiagramView } from '../src/c4'
import { CHECK_RULES, computeEvidence, type CheckModel } from '../src/check'
import type { TestCase } from '../src/check/reports'
import { sameViewsPlacesAside } from '../src/model'

// A model of 20,000 elements, shaped like radical.tools' own: needs, the
// requirements derived from them and the scenarios verifying those, ADRs,
// and systems of containers of components that satisfy the requirements.

const metamodel = builtInGovernanceMetamodel()

function largeModel(size = 20_000): { nodes: Record<string, C4Node>; relations: Record<string, C4Relation> } {
  const nodes: Record<string, C4Node> = {}
  const relations: Record<string, C4Relation> = {}
  const add = (id: string, type: string, label: string, props: Record<string, unknown> = {}) => {
    nodes[id] = { id, type, label, x: 0, y: 0, width: 240, height: 140, collapsed: false, ...props } as C4Node
  }
  const link = (sourceId: string, targetId: string, relationType: string) => {
    const id = `r${Object.keys(relations).length}`
    relations[id] = { id, sourceId, targetId, relationType }
  }
  for (let i = 0; Object.keys(nodes).length < size; i++) {
    add(`need${i}`, 'need', `Need ${i}`, { description: `I need the canvas — and its labels — to stay readable, case ${i}.` })
    add(`sys${i}`, 'system', `System ${i}`)
    add(`api${i}`, 'container', `API ${i}`, { parentId: `sys${i}`, technology: 'TypeScript' })
    add(`adr${i}`, 'adr', `Decision ${i}`, { status: 'accepted', decision: `We keep the layout of view ${i} → stable.` })
    for (let j = 0; j < 4; j++) {
      add(`req${i}-${j}`, 'requirement', `Layout stays ${i}.${j}`, { ears_type: 'event-driven', trigger: 'the user runs Smart Layout', action: `Studio shall keep each element where it was placed (${i}.${j}).` })
      add(`sc${i}-${j}`, 'scenario', `Layout stays after reload ${i}.${j}`, { given: 'a laid-out view', when: 'the page reloads', then: 'nothing moves' })
      add(`cmp${i}-${j}`, 'component', `Layout engine ${i}.${j}`, { parentId: `api${i}`, description: 'Places the elements of a view — rows, columns and grids.' })
      link(`req${i}-${j}`, `need${i}`, 'derives')
      link(`sc${i}-${j}`, `req${i}-${j}`, 'verifies')
      link(`cmp${i}-${j}`, `req${i}-${j}`, 'satisfies')
    }
  }
  return { nodes: Object.freeze(nodes), relations: Object.freeze(relations) }
}

const MODEL = largeModel()

/** `nodes` behind a proxy that counts the walks over them (each asks for
 *  their keys: Object.values, a spread, a for…in), frozen as they are. */
function counted(nodes: Record<string, C4Node>): { nodes: Record<string, C4Node>; walks: () => number } {
  let walks = 0
  const proxy = new Proxy(nodes, { ownKeys(target) { walks++; return Reflect.ownKeys(target) } })
  return { nodes: proxy, walks: () => walks }
}

describe('a model of 20,000 elements', () => {
  // How long it takes is measured at night (fitness function Large model
  // stays responsive); here, the work: each text folded once, not again on
  // every letter (1.4 s a letter at 21,000 elements before).
  it('folds each text of the model once, and no text again for the letters typed after', () => {
    const data: SearchData = { metamodel, nodes: MODEL.nodes, relations: MODEL.relations, views: {} }
    const before = searchFoldCount()
    searchModel(data, parseSearch('l', data))
    const first = searchFoldCount() - before
    expect(first).toBeGreaterThan(Object.keys(MODEL.nodes).length)
    let hits = 0
    for (const q of ['la', 'lay', 'layout', 'layout s', 'layout sta']) hits = searchModel(data, parseSearch(q, data)).hits.length
    expect(hits).toBeGreaterThan(1000)
    expect(searchFoldCount() - before).toBe(first)
  })

  it('finds, letter by letter, what a search from scratch finds, going through the model once a word', () => {
    const typed: SearchData = { metamodel, nodes: MODEL.nodes, relations: MODEL.relations, views: {} }
    const query = 'layout stays 1'
    const before = searchScanCount()
    const narrowed = [...query].map((_, i) => searchModel(typed, parseSearch(query.slice(0, i + 1), typed)).hits)
    // The first letter, and the letter after the space (a word of its own
    // narrows too: only its own letters are new).
    expect(searchScanCount() - before).toBe(1)
    for (let i = 0; i < query.length; i++) {
      // From scratch: the same elements in another record, nothing to narrow from.
      const fresh: SearchData = { metamodel, nodes: Object.freeze({ ...MODEL.nodes }), relations: Object.freeze({ ...MODEL.relations }), views: {} }
      expect(narrowed[i]).toEqual(searchModel(fresh, parseSearch(query.slice(0, i + 1), fresh)).hits)
    }
  })

  it('works out the + rows of a table of 1,000 rows without going through every element for each', () => {
    // As the Traceability table: needs, the requirements derived from them,
    // the scenarios verifying those; a + under each requirement.
    const view: DiagramView = {
      id: 'trace', name: 'Traceability', kind: 'table', nodeIds: [], positions: {},
      pipeline: { levels: [
        { ways: [{ types: ['need'] }] },
        { ways: [{ types: ['requirement'], via: { direction: 'in', relationType: 'derives' } }] },
        { ways: [{ types: ['scenario'], via: { direction: 'in', relationType: 'verifies' } }] },
      ] },
    } as DiagramView
    // Every walk over the elements (a copy, a scan) asks for their keys.
    const { nodes, walks } = counted(MODEL.nodes)
    const ctx = { nodes, relations: MODEL.relations, metamodel }
    const rows = Object.values(MODEL.nodes).filter((n) => n.type === 'requirement').slice(0, 1000)
    const offered = rows.filter((node) => addChoices(view, ctx, { node, depth: 1 }).length > 0).length
    expect(offered).toBe(1000)
    // A copy of every element for each row was 1,000 walks.
    expect(walks()).toBeLessThan(10)
  })

  it('keeps what a view shows when only the places of its elements changed', () => {
    const view = { id: 'reqs', name: 'Requirements', nodeIds: Object.freeze([]) as unknown as string[], positions: {}, pipeline: { levels: [{ ways: [{ types: ['requirement'] }] }] } } as DiagramView
    const shown = viewShownNodes(view, MODEL.nodes, MODEL.relations)
    expect(shown?.size).toBe(Object.values(MODEL.nodes).filter((n) => n.type === 'requirement').length)
    // Opening a view writes its positions into the elements.
    const moved = Object.freeze({ ...MODEL.nodes, 'req0-0': Object.freeze({ ...MODEL.nodes['req0-0'], x: 500, y: 300 }) })
    expect(viewShownNodes(view, moved, MODEL.relations)).toBe(shown)
    // Anything else asks the chain again.
    const retyped = Object.freeze({ ...MODEL.nodes, 'req0-0': Object.freeze({ ...MODEL.nodes['req0-0'], type: 'scenario' }) })
    const again = viewShownNodes(view, retyped, MODEL.relations)
    expect(again).not.toBe(shown)
    expect(again?.has('req0-0')).toBe(false)
    const added = Object.freeze({ ...MODEL.nodes, extra: Object.freeze({ ...MODEL.nodes['req0-0'], id: 'extra' }) })
    expect(viewShownNodes(view, added, MODEL.relations)?.has('extra')).toBe(true)
  })

  it('keeps what a view shows across an edit its filters do not read', () => {
    const byType = { id: 'reqs2', name: 'Requirements', nodeIds: Object.freeze([]) as unknown as string[], positions: {}, pipeline: { levels: [{ ways: [{ types: ['requirement'] }] }] } } as DiagramView
    const byText = { id: 'stays', name: 'Stays', nodeIds: Object.freeze([]) as unknown as string[], positions: {}, pipeline: { levels: [{ ways: [{ types: ['requirement'] }], filters: [{ kind: 'text', text: 'stays 0.0' }] }] } } as DiagramView
    const typed = viewShownNodes(byType, MODEL.nodes, MODEL.relations)
    expect([...viewShownNodes(byText, MODEL.nodes, MODEL.relations)!]).toEqual(['req0-0'])
    // A letter typed in a name: the type filter's answer stands, the text filter's is asked again.
    const renamed = Object.freeze({ ...MODEL.nodes, 'req0-0': Object.freeze({ ...MODEL.nodes['req0-0'], label: 'Layout moves 0.0' }) })
    expect(viewShownNodes(byType, renamed, MODEL.relations)).toBe(typed)
    expect(viewShownNodes(byText, renamed, MODEL.relations)?.size).toBe(0)
  })
})

describe('the view index', () => {
  const chain = (types: string[], extra: Record<string, unknown> = {}): DiagramView =>
    ({ id: `v-${types.join('-')}`, name: types.join(', '), nodeIds: Object.freeze([]) as unknown as string[], positions: {}, pipeline: { levels: [{ ways: [{ types }], ...extra }] } }) as DiagramView
  /** The same view again, as a model opened anew has it: nothing kept for it. */
  const again = (view: DiagramView): DiagramView => ({ ...view, nodeIds: Object.freeze([...view.nodeIds]) as unknown as string[] })

  it('gives a view of a model of the same structure its elements without running its filter', () => {
    const view = chain(['requirement'])
    const index = buildViewIndex([view], MODEL.nodes, MODEL.relations)
    expect(index.structure).toBe(modelStructure(MODEL.nodes, MODEL.relations))
    // Taken from the index: one element left out of it is left out of the view.
    const key = viewIndexKey(view)!
    const tampered = { ...index, views: { [key]: index.views[key].slice(1) } }
    const leftOut = index.ids[index.views[key][0]]
    presetViewIndex(tampered)
    try {
      expect(viewShownNodes(again(view), MODEL.nodes, MODEL.relations)?.has(leftOut)).toBe(false)
      // A rename keeps the structure; the index still answers.
      const renamed = Object.freeze({ ...MODEL.nodes, 'req9-0': Object.freeze({ ...MODEL.nodes['req9-0'], label: 'Renamed' }) })
      expect(viewShownNodes(again(view), renamed, MODEL.relations)?.has(leftOut)).toBe(false)
      // Another structure: the filter runs, and finds what the index left out.
      const retyped = Object.freeze({ ...MODEL.nodes, 'req9-1': Object.freeze({ ...MODEL.nodes['req9-1'], type: 'scenario' }) })
      const shown = viewShownNodes(again(view), retyped, MODEL.relations)!
      expect(shown.has(leftOut)).toBe(true)
      expect(shown.has('req9-1')).toBe(false)
    } finally {
      presetViewIndex(null)
    }
  })

  it('keeps no view whose filter reads names or properties', () => {
    expect(viewIndexKey(chain(['requirement']))).not.toBeNull()
    expect(viewIndexKey(chain(['requirement'], { filters: [{ kind: 'text', text: 'layout' }] }))).toBeNull()
    expect(viewIndexKey(chain(['adr'], { filters: [{ kind: 'property', key: 'status', op: 'is', values: ['accepted'] }] }))).toBeNull()
  })

  it('sees the same structure in elements and relations listed in another order', () => {
    const reversed = Object.freeze(Object.fromEntries(Object.entries(MODEL.nodes).reverse()))
    const relations = Object.freeze(Object.fromEntries(Object.entries(MODEL.relations).reverse()))
    expect(modelStructure(reversed, relations)).toBe(modelStructure(MODEL.nodes, MODEL.relations))
  })
})

describe('checking a model of 20,000 elements', () => {
  // How long it takes is measured at night; here, the work. Each rule went
  // through every relation for each ADR or requirement, and through every
  // test case for each test a scenario names: radical.tools' own model with
  // its test results took 2.4 s to check, ×4 with its repository's mapping 20 s.
  it('goes through the relations and the test cases a few times, not once for each element', () => {
    let relationWalks = 0
    const relations = new Proxy(MODEL.relations, { ownKeys(target) { relationWalks++; return Reflect.ownKeys(target) } })
    // A scenario names a test of its file; every file has its cases.
    const nodes: Record<string, C4Node> = {}
    for (const [id, n] of Object.entries(MODEL.nodes)) {
      nodes[id] = n.type === 'scenario' ? { ...n, metrics: `test(tests/${id.slice(0, 5)}.spec.ts › ${n.label}) passed` } as C4Node : n
    }
    const list: TestCase[] = Object.values(nodes).filter((n) => n.type === 'scenario')
      .map((n) => ({ file: `/repo/tests/${n.id.slice(0, 5)}.spec.ts`, title: [n.label], status: 'passed' }) as TestCase)
    let caseWalks = 0
    const tests = new Proxy(list, { get(target, key, receiver) { if (key === 'filter') caseWalks++; return Reflect.get(target, key, receiver) } })
    const model: CheckModel = { nodes: Object.freeze(nodes), relations, metamodel, tests }
    for (const rule of CHECK_RULES) rule.run(model)
    const evidence = computeEvidence(model)
    expect(Object.values(evidence.nodes).filter((e) => e.status === 'passed').length).toBe(list.length)
    expect(relationWalks).toBeLessThan(20)
    expect(caseWalks).toBeLessThan(20)
  })

  it('is not checked again when a view only places or moves its elements', () => {
    const view = { id: 'v', name: 'V', nodeIds: ['a'], positions: {} } as unknown as DiagramView
    const views = { v: view }
    expect(sameViewsPlacesAside(views, { v: { ...view, positions: { a: { x: 1, y: 2, width: 3, height: 4 } }, viewport: { x: 0, y: 0, zoom: 1 } } as DiagramView })).toBe(true)
    expect(sameViewsPlacesAside(views, { v: { ...view, nodeIds: ['a', 'b'] } })).toBe(false)
    expect(sameViewsPlacesAside(views, { v: { ...view, name: 'W' } })).toBe(false)
    expect(sameViewsPlacesAside(views, { v: view, w: view })).toBe(false)
  })
})

describe('reading a large model folder', () => {
  it('reads several files at a time, each result in its place', async () => {
    let reading = 0
    let most = 0
    const read = async (path: string) => {
      most = Math.max(most, ++reading)
      await new Promise((resolve) => setTimeout(resolve, 1))
      reading--
      return `content of ${path}`
    }
    const paths = Array.from({ length: 200 }, (_, i) => `nodes/n${i}.md`)
    expect(await readEach(paths, read)).toEqual(paths.map((p) => `content of ${p}`))
    expect(most).toBeGreaterThan(1)
    expect(most).toBeLessThanOrEqual(32)
  })

  it('reads the folder several files at a time when the session opens it', async () => {
    const files: Record<string, string> = { 'radical.md': '---\nradicalFormat: md-folder\nversion: 1\n---\n' }
    for (let i = 0; i < 300; i++) files[`nodes/n${i}.md`] = `---\nid: n${i}\ntype: component\nlabel: N${i}\n---\n`
    let reading = 0
    let most = 0
    const storage: MdFolderStorage = {
      list: async () => Object.fromEntries(Object.keys(files).map((p) => [p, '1'])),
      read: async (path) => {
        most = Math.max(most, ++reading)
        await new Promise((resolve) => setTimeout(resolve, 1))
        reading--
        return files[path]
      },
      write: async () => '1',
      remove: async () => {},
    }
    expect(await new MdFolderSession(storage).readAll()).toEqual(files)
    expect(most).toBeGreaterThan(1)
  })
})
