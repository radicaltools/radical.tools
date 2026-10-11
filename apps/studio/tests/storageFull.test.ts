/**
 * A new model never opens as another one.
 *
 * Browser storage has a quota of a few MB. When it is used up, the content of
 * a new local model could not be written, the model was added anyway, and
 * opening it loaded nothing: the canvas kept the model just left, under the
 * new model's name. Creating now fails up front, a model without content
 * opens empty, and a save that storage refuses is reported.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { useDiagramStore } from '@radical/ui/store/diagramStore'
import { documents, StorageFullError } from '../src/renderer/src/store/documentStore'

const store = new Map<string, string>()
let full = false
;(globalThis as any).localStorage = {
  getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
  setItem: (k: string, v: string) => {
    if (full && k.startsWith('radical-doc:')) throw new Error('QuotaExceededError')
    store.set(k, String(v))
  },
  removeItem: (k: string) => { store.delete(k) },
  clear: () => { store.clear() },
  key: (i: number) => Array.from(store.keys())[i] ?? null,
  get length() { return store.size },
}

const OLD = {
  nodes: [{ id: 'old-a', kind: 'system', label: 'Old A', x: 0, y: 0, width: 100, height: 60 } as any],
  relations: [],
}

/** Loads run on a promise; let them land. */
const settle = (): Promise<void> => new Promise((r) => setTimeout(r, 20))

beforeEach(async () => {
  full = false
  store.clear()
  documents.createLSDocument('Old', OLD)
  await settle()
  expect(Object.keys(useDiagramStore.getState().c4Nodes)).toEqual(['old-a'])
})

describe('new model with browser storage full', () => {
  it('refuses to create it and keeps the open model active', () => {
    const before = documents.getActiveId()
    const count = documents.listDocuments().length
    full = true
    expect(() => documents.createLSDocument('Untitled model', { nodes: [], relations: [] }))
      .toThrow(StorageFullError)
    expect(documents.getActiveId()).toBe(before)
    expect(documents.listDocuments()).toHaveLength(count)
  })

  it('a save that storage refuses rejects with StorageFullError', async () => {
    full = true
    await expect(documents.saveDocument(documents.getActiveId()!, OLD))
      .rejects.toBeInstanceOf(StorageFullError)
  })
})

describe('a local model without stored content', () => {
  it('opens empty, not as the model left', async () => {
    const meta = documents.createLSDocument('No content')
    await settle()
    expect(documents.getActiveId()).toBe(meta.id)
    expect(useDiagramStore.getState().c4Nodes).toEqual({})
  })
})

describe('loadDiagram after viewing a milestone', () => {
  it('drops the parked live model and the diff ghosts', () => {
    useDiagramStore.setState({
      liveBackup: { nodes: { 'old-a': OLD.nodes[0] }, relations: {}, sequences: {} },
      milestoneDirty: true,
      diffGhostNodes: { 'old-a': OLD.nodes[0] },
      diffHighlight: { 'old-a': 'removed' },
      showDiff: true,
    } as any)
    useDiagramStore.getState().loadDiagram({ nodes: [], relations: [] })
    const s = useDiagramStore.getState()
    expect(s.liveBackup).toBeNull()
    expect(s.milestoneDirty).toBe(false)
    expect(s.diffGhostNodes).toEqual({})
    expect(s.diffHighlight).toEqual({})
    expect(s.rfNodes).toEqual([])
  })
})
