import { describe, it, expect, beforeEach, vi } from 'vitest'
import { documents } from '../src/renderer/src/store/documentStore'
import { useDiagramStore } from '../src/renderer/src/store/diagramStore'
import type { DiagramData } from '../src/renderer/src/types/c4'

class MemLS {
  private map = new Map<string, string>()
  getItem(k: string): string | null { return this.map.has(k) ? this.map.get(k)! : null }
  setItem(k: string, v: string): void { this.map.set(k, String(v)) }
  removeItem(k: string): void { this.map.delete(k) }
  clear(): void { this.map.clear() }
  key(i: number): string | null { return [...this.map.keys()][i] ?? null }
  get length(): number { return this.map.size }
}

function installFolderApi(): { disk: Record<string, string> } {
  const disk: Record<string, string> = {}
  ;(globalThis as any).window.electronAPI = {
    openFolder: vi.fn(async () => ({ success: true, folderPath: '/tmp/model', files: { ...disk } })),
    pickFolder: vi.fn(async () => ({ success: true, folderPath: '/tmp/model' })),
    readFolder: vi.fn(async () => ({ success: true, files: { ...disk } })),
    readFile: vi.fn(async (filePath: string) => {
      const rel = filePath.replace(/^\/tmp\/model\//, '')
      return rel in disk ? { success: true, content: disk[rel] } : { success: false }
    }),
    writeFolder: vi.fn(async (_path: string, files: Record<string, string>) => {
      for (const k of Object.keys(disk)) delete disk[k]
      Object.assign(disk, files)
      return { success: true }
    }),
  }
  return { disk }
}

const SAMPLE: DiagramData = {
  nodes: [
    { id: 'sys1', type: 'system', label: 'Payments', collapsed: false, x: 0, y: 0, width: 400, height: 300, description: 'Money mover' },
    { id: 'sys2', type: 'system', label: 'Ledger', collapsed: false, x: 0, y: 0, width: 400, height: 300, description: 'Keeps the books' },
  ],
  relations: [],
}

const flush = () => new Promise((r) => setTimeout(r, 0))

describe('lazy node body hydration (md-folder docs)', () => {
  beforeEach(() => {
    ;(globalThis as any).localStorage = new MemLS()
    if (!(globalThis as any).crypto?.randomUUID) {
      ;(globalThis as any).crypto = { randomUUID: () => 'id-' + Math.random().toString(36).slice(2) }
    }
    delete (globalThis as any).window.electronAPI
  })

  async function loadLazyMdDoc(): Promise<string> {
    installFolderApi()
    const ls = documents.createLSDocument('Draft', SAMPLE)
    const meta = await documents.saveAsFolder(ls.id, SAMPLE)
    await documents.saveDocument(meta!.id, SAMPLE)
    documents.setActiveId(meta!.id)
    const data = await documents.loadDocument(meta!.id)
    useDiagramStore.getState().loadDiagram(data!)
    return meta!.id
  }

  it('loadDiagram marks lazily-loaded nodes pending, with no description in memory yet', async () => {
    await loadLazyMdDoc()
    const state = useDiagramStore.getState()
    expect(state.pendingBodyNodeIds.sys1).toBe(true)
    expect(state.pendingBodyNodeIds.sys2).toBe(true)
    expect(state.c4Nodes.sys1.description).toBeUndefined()
  })

  it('hydrateNode fetches and merges the body, clearing the pending flag, without touching undo', async () => {
    await loadLazyMdDoc()
    const before = useDiagramStore.getState().canUndo
    useDiagramStore.getState().hydrateNode('sys1')
    await flush()
    const state = useDiagramStore.getState()
    expect(state.c4Nodes.sys1.description).toBe('Money mover')
    expect(state.pendingBodyNodeIds.sys1).toBeUndefined()
    // Not a user edit — must not push undo history.
    expect(state.canUndo).toBe(before)
    // The other lazy node is untouched.
    expect(state.c4Nodes.sys2.description).toBeUndefined()
    expect(state.pendingBodyNodeIds.sys2).toBe(true)
  })

  it('scanDescriptions finds a match in an unopened node and merges it in; non-matches stay pending', async () => {
    await loadLazyMdDoc()
    const matches = await useDiagramStore.getState().scanDescriptions('books')
    expect(matches.has('sys2')).toBe(true)
    expect(matches.has('sys1')).toBe(false)
    const state = useDiagramStore.getState()
    expect(state.c4Nodes.sys2.description).toBe('Keeps the books')
    expect(state.pendingBodyNodeIds.sys2).toBeUndefined()
    // sys1 didn't match — read but discarded, still pending, not cached.
    expect(state.c4Nodes.sys1.description).toBeUndefined()
    expect(state.pendingBodyNodeIds.sys1).toBe(true)
  })
})
