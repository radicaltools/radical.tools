import { describe, expect, it } from 'vitest'
import { parseSearch, searchModel, type SearchData } from '../src/search'
import { addChoices, viewShownNodes } from '../src/viewPipeline'
import { MdFolderSession, readEach, type MdFolderStorage } from '../src/formats/mdFolderSync'
import { builtInGovernanceMetamodel } from '../src/metamodel'
import type { C4Node, C4Relation, DiagramView } from '../src/c4'

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

/** The fastest of three runs, in ms. */
function bestOf3(run: () => void): number {
  let best = Infinity
  for (let i = 0; i < 3; i++) {
    const t = performance.now()
    run()
    best = Math.min(best, performance.now() - t)
  }
  return best
}

describe('a model of 20,000 elements', () => {
  it('finds the matches of each letter typed in Quick Search within 100 ms', () => {
    const data: SearchData = { metamodel, nodes: MODEL.nodes, relations: MODEL.relations, views: {} }
    // The first letter folds the model's texts; the ones after reuse them.
    searchModel(data, parseSearch('l', data))
    let hits = 0
    const ms = bestOf3(() => { hits = searchModel(data, parseSearch('layout sta', data)).hits.length })
    expect(hits).toBeGreaterThan(1000)
    expect(ms).toBeLessThan(100)
  })

  it('works out the + rows of a table of 1,000 rows within 200 ms', () => {
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
    const ctx = { nodes: MODEL.nodes, relations: MODEL.relations, metamodel }
    const rows = Object.values(MODEL.nodes).filter((n) => n.type === 'requirement').slice(0, 1000)
    let offered = 0
    const ms = bestOf3(() => { offered = rows.filter((node) => addChoices(view, ctx, { node, depth: 1 }).length > 0).length })
    expect(offered).toBe(1000)
    expect(ms).toBeLessThan(200)
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
