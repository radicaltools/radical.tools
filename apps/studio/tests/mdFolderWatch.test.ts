// The active md-folder document follows edits made outside Studio: the host
// reports a folder change, autosave reloads the document from disk.
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { documents, useDocumentsStore } from '../src/renderer/src/store/documentStore'
import { useDiagramStore } from '@radical/ui/store/diagramStore'
import { serializeToMdFolder } from '@radical/common/formats/mdFolder'
import type { FolderChange } from '@radical/host-bridge'
import type { DiagramData } from '@radical/common/c4'

class MemLS {
  private map = new Map<string, string>()
  getItem(k: string): string | null { return this.map.has(k) ? this.map.get(k)! : null }
  setItem(k: string, v: string): void { this.map.set(k, String(v)) }
  removeItem(k: string): void { this.map.delete(k) }
  clear(): void { this.map.clear() }
  key(i: number): string | null { return [...this.map.keys()][i] ?? null }
  get length(): number { return this.map.size }
}

const useDocumentsStoreSubscribe = (fn: () => void): (() => void) => useDocumentsStore.subscribe(fn)

const settle = async (): Promise<void> => {
  for (let i = 0; i < 5; i++) await new Promise((r) => setTimeout(r, 0))
}

function sys(id: string, label: string) {
  return { id, type: 'system' as const, label, collapsed: false, x: 0, y: 0, width: 400, height: 300 }
}

const SAMPLE: DiagramData = { nodes: [sys('sys1', 'Payments'), sys('sys2', 'Ledger')], relations: [] }

function installFolderApi(initial: Record<string, string>) {
  const disk: Record<string, string> = { ...initial }
  let listener: ((change: FolderChange) => void) | null = null
  const api = {
    readFolder: vi.fn(async () => ({ success: true, files: { ...disk } })),
    readFile: vi.fn(async () => ({ success: false })),
    writeFolder: vi.fn(async () => ({ success: true })),
    watchFolder: vi.fn(async () => {}),
    onFolderChanged: vi.fn((l: (change: FolderChange) => void) => { listener = l }),
  }
  ;(globalThis as any).window.electronAPI = api
  return {
    api,
    /** Replace the folder's content, as an outside editor or git would. */
    setDisk(files: Record<string, string>) {
      for (const k of Object.keys(disk)) delete disk[k]
      Object.assign(disk, files)
    },
    emit(change: FolderChange) { listener?.(change) },
  }
}

describe('md-folder documents follow outside edits', () => {
  beforeEach(() => {
    ;(globalThis as any).localStorage = new MemLS()
    if (!(globalThis as any).crypto?.randomUUID) {
      ;(globalThis as any).crypto = { randomUUID: () => 'id-' + Math.random().toString(36).slice(2) }
    }
  })

  it('reloads the active document when its folder changes, keeping the selection', async () => {
    const folder = installFolderApi(serializeToMdFolder(SAMPLE, 'model'))
    documents.createMdDocument('/tmp/model')
    await settle()
    expect(folder.api.watchFolder).toHaveBeenLastCalledWith('/tmp/model')
    useDiagramStore.getState().selectNode('sys2')

    folder.setDisk(serializeToMdFolder({
      ...SAMPLE,
      nodes: [sys('sys1', 'Renamed outside'), sys('sys2', 'Ledger'), sys('sys3', 'Added outside')],
    }, 'model'))
    folder.emit({ folderPath: '/tmp/model', paths: ['nodes/renamed-outside/_index.md'] })
    await settle()

    const s = useDiagramStore.getState()
    expect(s.c4Nodes.sys1.label).toBe('Renamed outside')
    expect(s.c4Nodes.sys3).toBeDefined()
    expect(s.selectedNodeId).toBe('sys2')
  })

  it('starts watching when the active document is saved as a folder', async () => {
    const folder = installFolderApi({})
    ;(folder.api as any).pickFolder = vi.fn(async () => ({ success: true, folderPath: '/tmp/saved' }))
    const ls = documents.createLSDocument('Draft', SAMPLE)
    await settle()
    folder.api.watchFolder.mockClear()
    await documents.saveAsFolder(ls.id, SAMPLE)
    await settle()
    expect(folder.api.watchFolder).toHaveBeenLastCalledWith('/tmp/saved')
  })

  it('stops watching when another document becomes active', async () => {
    const folder = installFolderApi(serializeToMdFolder(SAMPLE, 'model'))
    documents.createMdDocument('/tmp/model')
    await settle()
    documents.createLSDocument('Other', { nodes: [sys('only', 'Other')], relations: [] })
    await settle()
    expect(folder.api.watchFolder).toHaveBeenLastCalledWith(null)

    folder.emit({ folderPath: '/tmp/model', paths: ['nodes/payments/_index.md'] })
    await settle()
    expect(Object.keys(useDiagramStore.getState().c4Nodes)).toEqual(['only'])
  })

  it('keeps the document unchanged on disk when a save is refused as a conflict', async () => {
    const folder = installFolderApi(serializeToMdFolder(SAMPLE, 'model'))
    const meta = documents.createMdDocument('/tmp/model')
    await settle()
    folder.api.writeFolder.mockResolvedValueOnce({ success: false, conflict: ['nodes/payments/_index.md'] } as any)
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const notify = vi.fn()
    const unsubscribe = useDocumentsStoreSubscribe(notify)
    await documents.saveDocument(meta.id, SAMPLE)
    unsubscribe()
    expect(warn).toHaveBeenCalledWith('[documentStore] folder changed on disk, not overwriting:', ['nodes/payments/_index.md'])
    expect(notify).not.toHaveBeenCalled() // not recorded as saved
    warn.mockRestore()
  })
})
