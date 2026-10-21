// Edits kept for the next visit (autosave's keepEdits): a folder model whose
// saves wait for an agent keeps what is not written yet in localStorage when
// the tab is hidden, and merges it into the folder's model when it is opened
// again. What is kept follows the model: an edit undone is no longer kept.
import { describe, it, expect, beforeEach, vi } from 'vitest'

// The tab's visibility, for autosave to follow (registered on import).
const page = vi.hoisted(() => {
  const events = new EventTarget()
  const state = { visibility: 'visible' }
  ;(globalThis as any).document = {
    get visibilityState() { return state.visibility },
    addEventListener: events.addEventListener.bind(events),
    removeEventListener: events.removeEventListener.bind(events),
  }
  return {
    setVisibility(v: 'visible' | 'hidden') {
      state.visibility = v
      events.dispatchEvent(new Event('visibilitychange'))
    },
  }
})

import { deserializeFromMdFolder, serializeToMdFolder } from '@radical/common/formats/mdFolder'
import { serializeAgentActivity } from '@radical/common/formats/agentActivity'
import type { DiagramData } from '@radical/common/c4'

// The setup files installed persistence before the tab had a visibility to
// follow: this file's own copy of it (and of the stores it saves) follows it.
vi.resetModules()
const { documents } = await import('../src/renderer/src/store/documentStore')
const { reloadActiveDocument } = await import('../src/renderer/src/persistence/autosave')
const { useDiagramStore } = await import('@radical/ui/store/diagramStore')

class MemLS {
  private map = new Map<string, string>()
  getItem(k: string): string | null { return this.map.has(k) ? this.map.get(k)! : null }
  setItem(k: string, v: string): void { this.map.set(k, String(v)) }
  removeItem(k: string): void { this.map.delete(k) }
  clear(): void { this.map.clear() }
  key(i: number): string | null { return [...this.map.keys()][i] ?? null }
  get length(): number { return this.map.size }
}

const settle = async (): Promise<void> => {
  for (let i = 0; i < 5; i++) await new Promise((r) => setTimeout(r, 0))
}
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

const sys = (id: string, label: string) => ({ id, type: 'system' as const, label, collapsed: false, x: 0, y: 0, width: 400, height: 300 })
const SAMPLE: DiagramData = { nodes: [sys('sys1', 'Payments'), sys('sys2', 'Ledger')], relations: [] }

function installFolderApi(initial: Record<string, string>) {
  const disk: Record<string, string> = { ...initial }
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
    onFolderChanged: vi.fn(() => {}),
  }
  ;(globalThis as any).window.electronAPI = api
  return { api, model: () => deserializeFromMdFolder({ ...disk }).data }
}

const kept = (): string[] =>
  [...Array((localStorage as unknown as MemLS).length).keys()].map((i) => localStorage.key(i)!).filter((k) => k.startsWith('radical-unsaved-edits:'))

describe('edits kept for the next visit', () => {
  beforeEach(() => {
    ;(globalThis as any).localStorage = new MemLS()
    if (!(globalThis as any).crypto?.randomUUID) {
      ;(globalThis as any).crypto = { randomUUID: () => 'id-' + Math.random().toString(36).slice(2) }
    }
  })

  it('keeps no edit that was undone after the tab was hidden (item 155)', async () => {
    const folder = installFolderApi(serializeToMdFolder(SAMPLE, 'model'))
    documents.createMdDocument('/tmp/model')
    await settle()
    const store = useDiagramStore.getState
    store().setAppMode('designer')
    // An agent writes the folder: Studio holds its saves.
    folder.api.readAgentActivity.mockResolvedValue({ success: true, content: serializeAgentActivity('claude-code', Date.now()) })
    store().updateNode('sys2', { label: 'General ledger' })
    await wait(450)

    page.setVisibility('hidden')
    await settle()
    expect(kept()).toHaveLength(1)
    page.setVisibility('visible')
    store().undo()
    expect(store().c4Nodes.sys2.label).toBe('Ledger')

    // The page goes before its write lands.
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    folder.api.writeFolder.mockRejectedValueOnce(new Error('the page is gone'))
    window.dispatchEvent(new Event('pagehide'))
    await settle()
    warn.mockRestore()
    expect(kept()).toEqual([])

    folder.api.readAgentActivity.mockResolvedValue({ success: true, content: null })
    reloadActiveDocument()
    await settle()
    expect(store().c4Nodes.sys2.label).toBe('Ledger')
    expect(folder.model().nodes.find((n) => n.id === 'sys2')?.label).toBe('Ledger')
  })
})
