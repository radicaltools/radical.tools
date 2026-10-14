/**
 * Documents and tabs. The index of models lives in localStorage, which
 * every tab of the browser shares.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { useDiagramStore } from '@radical/ui/store/diagramStore'
import { documents, StorageFullError } from '../src/renderer/src/store/documentStore'

const store = new Map<string, string>()
let indexFull = false
;(globalThis as any).localStorage = {
  getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
  setItem: (k: string, v: string) => {
    if (indexFull && k === 'radical-docs-index') throw new Error('QuotaExceededError')
    store.set(k, String(v))
  },
  removeItem: (k: string) => { store.delete(k) },
  clear: () => { store.clear() },
  key: (i: number) => Array.from(store.keys())[i] ?? null,
  get length() { return store.size },
}

const settle = (): Promise<void> => new Promise((r) => setTimeout(r, 50))
const doc = (label: string) => ({ nodes: [{ id: label, type: 'system', label, collapsed: false, x: 0, y: 0, width: 200, height: 100 } as any], relations: [] })

beforeEach(async () => {
  indexFull = false
  for (const d of documents.listDocuments()) documents.deleteDocument(d.id, { wipePayload: true })
  await settle()
})

describe('two tabs on two models', () => {
  // The index's activeId is the model the last tab opened. Read as this
  // tab's model, an edit in one tab was saved into the other tab's model.
  it('each tab keeps saving into its own model', async () => {
    const a = documents.createLSDocument('A', doc('a'))
    const b = documents.createLSDocument('B', doc('b'))
    documents.setActiveId(a.id)
    await settle()
    // Another tab opens B: it writes the shared index.
    const shared = JSON.parse(store.get('radical-docs-index')!)
    store.set('radical-docs-index', JSON.stringify({ ...shared, activeId: b.id }))
    expect(documents.getActiveId()).toBe(a.id)
    await documents.saveDocument(documents.getActiveId()!, doc('edited in A'))
    expect((await documents.loadDocument(b.id))!.nodes.map((n) => n.label)).toEqual(['b'])
    expect((await documents.loadDocument(a.id))!.nodes.map((n) => n.label)).toEqual(['edited in A'])
  })
})

describe('deleting the only model', () => {
  // It stayed on screen with nowhere to save to; a reload showed another.
  it('leaves an empty model of its own on screen', async () => {
    const only = documents.createLSDocument('Only', doc('only'))
    documents.setActiveId(only.id)
    await settle()
    documents.deleteDocument(only.id, { wipePayload: true })
    await settle()
    const active = documents.getActiveId()
    expect(active).toBeTruthy()
    expect(active).not.toBe(only.id)
    expect(Object.keys(useDiagramStore.getState().c4Nodes)).toEqual([])
  })
})

describe('a rename that storage refuses', () => {
  it('says so instead of doing nothing', () => {
    const d = documents.createLSDocument('Old name', doc('x'))
    indexFull = true
    expect(() => documents.renameDocument(d.id, 'A longer new name')).toThrow(StorageFullError)
  })
})
