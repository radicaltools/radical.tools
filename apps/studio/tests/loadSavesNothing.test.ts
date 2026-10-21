/**
 * A load saves nothing by itself (D15).
 *
 * After a reload the store goes on changing: the live layout settles, the
 * canvas gives places to what it has none for, the camera is put back. That
 * was saved, also in Viewer and Presenter: the document and its nodes[].x/y
 * mirror changed with no edit of the user. A save comes only after an edit.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { useDiagramStore } from '@radical/ui/store/diagramStore'
import { documents } from '../src/renderer/src/store/documentStore'

const store = new Map<string, string>()
;(globalThis as any).localStorage = {
  getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
  setItem: (k: string, v: string) => { store.set(k, String(v)) },
  removeItem: (k: string) => { store.delete(k) },
  clear: () => { store.clear() },
  key: (i: number) => Array.from(store.keys())[i] ?? null,
  get length() { return store.size },
}

const MODEL = {
  nodes: [
    { id: 'a', type: 'system', label: 'A', collapsed: false, x: 0, y: 0, width: 300, height: 180 },
    { id: 'b', type: 'system', label: 'B', collapsed: false, x: 500, y: 0, width: 300, height: 180 },
  ],
  relations: [],
} as any

const wait = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))
const saved = (): string | undefined => store.get(`radical-doc:${documents.getActiveId()}`)
/** What the live layout does: moves nodes, no undo step. */
const settleLayout = (): void => {
  const nodes = useDiagramStore.getState().c4Nodes
  useDiagramStore.setState({ c4Nodes: { ...nodes, a: { ...nodes.a, x: nodes.a.x + 37, y: nodes.a.y + 11 } } as any })
}

beforeEach(async () => {
  store.clear()
  useDiagramStore.getState().setAppMode('designer')
  documents.createLSDocument('Model', MODEL)
  await wait(20)
})

describe('a model just opened', () => {
  it('is not saved while only the layout settles', async () => {
    const before = saved()
    settleLayout()
    useDiagramStore.setState({ defaultViewport: { x: 12, y: 34, zoom: 0.7 } as any })
    await wait(600)
    expect(saved()).toBe(before)
  })

  it('is saved after an edit, with what settled since', async () => {
    settleLayout()
    useDiagramStore.getState().updateNode('b', { label: 'Renamed' })
    await wait(600)
    const doc = JSON.parse(saved()!)
    expect(doc.nodes.find((n: any) => n.id === 'b').label).toBe('Renamed')
  })

  it('is saved after a step that only moves (a drag, Smart Layout)', async () => {
    const before = saved()
    useDiagramStore.getState()._pushUndo()
    settleLayout()
    await wait(600)
    expect(saved()).not.toBe(before)
  })
})
