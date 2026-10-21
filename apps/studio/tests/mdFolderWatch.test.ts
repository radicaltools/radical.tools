// The active md-folder document follows edits made outside Studio: the host
// reports a folder change, autosave reloads the document from disk.
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { documents, useDocumentsStore } from '../src/renderer/src/store/documentStore'
import { reloadActiveDocument } from '../src/renderer/src/persistence/autosave'
import { useDiagramStore } from '@radical/ui/store/diagramStore'
import { deserializeFromMdFolder, serializeToMdFolder } from '@radical/common/formats/mdFolder'
import { serializeAgentActivity } from '@radical/common/formats/agentActivity'
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
    writeFolder: vi.fn(async (_path: string, files: Record<string, string>) => {
      for (const k of Object.keys(disk)) delete disk[k]
      Object.assign(disk, files)
      return { success: true }
    }),
    readAgentActivity: vi.fn(async () => ({ success: true, content: null as string | null })),
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
    /** The model on disk now. */
    model: () => deserializeFromMdFolder({ ...disk }).data,
  }
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))
const labels = (data: DiagramData) => Object.fromEntries(data.nodes.map((n) => [n.id, n.label]))

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

  it('keeps the camera in use instead of the one saved on disk', async () => {
    const onDisk = { x: 0, y: 0, zoom: 1 }
    const withView: DiagramData = {
      ...SAMPLE,
      views: [{ id: 'v1', name: 'Context', kind: 'static', nodeIds: [], positions: {}, viewport: onDisk } as any],
    }
    const folder = installFolderApi(serializeToMdFolder(withView, 'model'))
    documents.createMdDocument('/tmp/model')
    await settle()
    useDiagramStore.getState().setActiveView('v1')
    const place = vi.fn()
    const w = (globalThis as any).window
    w.__rfPlaceCamera = place
    w.__rfCurrentViewport = { x: -480, y: -220, zoom: 0.6 }

    folder.setDisk(serializeToMdFolder({ ...withView, nodes: [...SAMPLE.nodes, sys('sys3', 'Added outside')] }, 'model'))
    folder.emit({ folderPath: '/tmp/model', paths: ['nodes/added-outside/_index.md'] })
    await settle()
    delete w.__rfPlaceCamera
    delete w.__rfCurrentViewport

    expect(useDiagramStore.getState().activeViewId).toBe('v1')
    expect(place).toHaveBeenLastCalledWith({ x: -480, y: -220, zoom: 0.6 }, expect.any(Array), { keep: true })
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

  it('merges edits not saved yet with an outside edit', async () => {
    const folder = installFolderApi(serializeToMdFolder(SAMPLE, 'model'))
    documents.createMdDocument('/tmp/model')
    await settle()
    useDiagramStore.getState().updateNode('sys2', { label: 'General ledger' })

    // Before the save runs, an agent renames the other system and adds one.
    folder.setDisk(serializeToMdFolder({ ...SAMPLE, nodes: [sys('sys1', 'Payments hub'), sys('sys2', 'Ledger'), sys('sys3', 'Fraud')] }, 'model'))
    folder.emit({ folderPath: '/tmp/model', paths: ['nodes/payments-hub/_index.md'] })
    await settle()

    const nodes = useDiagramStore.getState().c4Nodes
    expect([nodes.sys1.label, nodes.sys2.label, nodes.sys3?.label]).toEqual(['Payments hub', 'General ledger', 'Fraud'])
    // …and saves them, merged.
    await wait(500)
    expect(labels(folder.model())).toEqual({ sys1: 'Payments hub', sys2: 'General ledger', sys3: 'Fraud' })
  })

  it('lets a presentation play on through an outside edit, and reads the edit once it stops (item 136)', async () => {
    const slide = (id: string) => ({ id, name: id, snapshotId: null, viewport: { x: 0, y: 0, zoom: 1 } })
    const withDecks: DiagramData = {
      ...SAMPLE,
      presentations: [
        { id: 'main', name: 'Main', slides: [slide('m1')] },
        { id: 'agent', name: 'Agent deck', slides: [slide('a1'), slide('a2'), slide('a3')] },
      ],
    }
    const folder = installFolderApi(serializeToMdFolder(withDecks, 'model'))
    documents.createMdDocument('/tmp/model')
    await settle()
    const store = useDiagramStore.getState
    store().setAppMode('designer')
    store().setActivePresentation('agent')
    store().startPresentation()
    store().goToSlide(2)

    folder.setDisk(serializeToMdFolder({ ...withDecks, nodes: [sys('sys1', 'Payments hub'), sys('sys2', 'Ledger')] }, 'model'))
    folder.emit({ folderPath: '/tmp/model', paths: ['nodes/payments-hub/_index.md'] })
    await settle()
    expect(store().presentationActive).toBe(true)
    expect(store().activePresentationId).toBe('agent')
    expect(store().presentationSlideIndex).toBe(2)

    store().stopPresentation()
    await settle()
    await settle()
    expect(store().c4Nodes.sys1.label).toBe('Payments hub')
    expect(store().activePresentationId).toBe('agent')
    expect(store().presentationSlideIndex).toBe(2)
  })

  it('keeps Undo after an outside edit: it takes back the user\'s edit, not the agent\'s', async () => {
    const folder = installFolderApi(serializeToMdFolder(SAMPLE, 'model'))
    documents.createMdDocument('/tmp/model')
    await settle()
    const store = useDiagramStore.getState
    store().setAppMode('designer')
    store().updateNode('sys2', { label: 'General ledger' })
    await wait(500) // saved

    folder.setDisk(serializeToMdFolder({ ...SAMPLE, nodes: [sys('sys1', 'Payments hub'), sys('sys2', 'General ledger')] }, 'model'))
    folder.emit({ folderPath: '/tmp/model', paths: ['nodes/payments-hub/_index.md'] })
    await settle()
    expect(store().c4Nodes.sys1.label).toBe('Payments hub')
    expect(store().canUndo).toBe(true)
    store().undo()
    expect([store().c4Nodes.sys1.label, store().c4Nodes.sys2.label]).toEqual(['Payments hub', 'Ledger'])
    await wait(500)
    expect(labels(folder.model())).toEqual({ sys1: 'Payments hub', sys2: 'Ledger' })
  })

  it('holds its saves while an agent writes the folder, then saves them merged', async () => {
    const folder = installFolderApi(serializeToMdFolder(SAMPLE, 'model'))
    documents.createMdDocument('/tmp/model')
    await settle()
    const notices = vi.spyOn(useDiagramStore.getState(), 'pushNotification')
    // The agent is writing: its mark holds for a moment.
    folder.api.readAgentActivity.mockResolvedValue({ success: true, content: serializeAgentActivity('claude-code', Date.now() - 15_000 + 600) })
    useDiagramStore.getState().updateNode('sys2', { label: 'General ledger' })
    await wait(450)
    expect(folder.api.writeFolder).not.toHaveBeenCalled()
    expect(notices).toHaveBeenCalledTimes(1)
    expect(notices.mock.calls[0][0]).toMatch(/agent is editing this model/)

    // The agent writes again meanwhile; Studio takes its change in, keeping its own edit.
    folder.setDisk(serializeToMdFolder({ ...SAMPLE, nodes: [sys('sys1', 'Payments hub'), sys('sys2', 'Ledger')] }, 'model'))
    folder.emit({ folderPath: '/tmp/model', paths: ['nodes/payments-hub/_index.md'] })
    await settle()
    expect(useDiagramStore.getState().c4Nodes.sys2.label).toBe('General ledger')
    expect(folder.api.writeFolder).not.toHaveBeenCalled()

    // Once the mark has passed, Studio saves, merged with the agent's change.
    await wait(700)
    expect(folder.api.writeFolder).toHaveBeenCalledTimes(1)
    expect(labels(folder.model())).toEqual({ sys1: 'Payments hub', sys2: 'General ledger' })
    expect(notices).toHaveBeenCalledTimes(1) // said once
    notices.mockRestore()
  })

  it('writes the edits it holds for an agent when the page goes away', async () => {
    const folder = installFolderApi(serializeToMdFolder(SAMPLE, 'model'))
    documents.createMdDocument('/tmp/model')
    await settle()
    folder.api.readAgentActivity.mockResolvedValue({ success: true, content: serializeAgentActivity('claude-code', Date.now()) })
    useDiagramStore.getState().updateNode('sys2', { label: 'General ledger' })
    await wait(450)
    expect(folder.api.writeFolder).not.toHaveBeenCalled()

    // The write merges with what the agent wrote meanwhile (the folder
    // session in the main process; mdFolderSync.test.ts).
    window.dispatchEvent(new Event('pagehide'))
    await settle()
    expect(folder.api.writeFolder).toHaveBeenCalledTimes(1)
    expect(labels(folder.model())).toEqual({ sys1: 'Payments', sys2: 'General ledger' })
  })

  it('keeps those edits for the next visit when the write cannot land before the page goes', async () => {
    const folder = installFolderApi(serializeToMdFolder(SAMPLE, 'model'))
    documents.createMdDocument('/tmp/model')
    await settle()
    folder.api.readAgentActivity.mockResolvedValue({ success: true, content: serializeAgentActivity('claude-code', Date.now() - 15_000 + 900) })
    useDiagramStore.getState().updateNode('sys2', { label: 'General ledger' })
    await wait(450)
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    folder.api.writeFolder.mockRejectedValueOnce(new Error('the page is gone'))
    window.dispatchEvent(new Event('pagehide'))
    await settle()
    warn.mockRestore()

    // The next visit: the agent's change is on disk, the user's is not.
    folder.setDisk(serializeToMdFolder({ ...SAMPLE, nodes: [sys('sys1', 'Payments hub'), sys('sys2', 'Ledger'), sys('sys3', 'Fraud')] }, 'model'))
    reloadActiveDocument()
    await settle()
    const nodes = useDiagramStore.getState().c4Nodes
    expect([nodes.sys1.label, nodes.sys2.label, nodes.sys3?.label]).toEqual(['Payments hub', 'General ledger', 'Fraud'])
    // Saved once the agent's mark has passed, and kept no longer.
    await wait(900)
    expect(labels(folder.model())).toEqual({ sys1: 'Payments hub', sys2: 'General ledger', sys3: 'Fraud' })
    expect([...Array((localStorage as unknown as MemLS).length).keys()].map((i) => localStorage.key(i)).filter((k) => k?.startsWith('radical-unsaved-edits:'))).toEqual([])
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
