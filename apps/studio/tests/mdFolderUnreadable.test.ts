// A sidecar file of a folder model that Studio cannot parse (a trailing
// comma, git conflict markers, a file caught half written). It read as "no
// such file": the model lost its relations (or views, or layout) without a
// word, and the next save removed the file from the folder as stale. The
// MCP server refuses the same folder.
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { documents } from '../src/renderer/src/store/documentStore'
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

const settle = async (): Promise<void> => {
  for (let i = 0; i < 5; i++) await new Promise((r) => setTimeout(r, 0))
}
/** Past the autosave debounce. */
const saved = (): Promise<void> => new Promise((r) => setTimeout(r, 600))

function sys(id: string, label: string) {
  return { id, type: 'system' as const, label, collapsed: false, x: 0, y: 0, width: 400, height: 300 }
}

const SAMPLE: DiagramData = {
  nodes: [sys('sys1', 'Payments'), sys('sys2', 'Ledger')],
  relations: [{ id: 'r1', sourceId: 'sys1', targetId: 'sys2', label: 'posts to' }],
}

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
    disk,
    emit(paths: string[]) { listener?.({ folderPath: '/tmp/model', paths }) },
  }
}

const notices = (): string[] => useDiagramStore.getState().notifications.map((n) => n.message)

describe('a folder file that cannot be parsed', () => {
  beforeEach(() => {
    ;(globalThis as any).localStorage = new MemLS()
    if (!(globalThis as any).crypto?.randomUUID) {
      ;(globalThis as any).crypto = { randomUUID: () => 'id-' + Math.random().toString(36).slice(2) }
    }
    useDiagramStore.setState({ notifications: [] } as any)
    useDiagramStore.getState().setAppMode('designer')
  })

  it('arriving while the model is open: the model stays, the user is told, nothing is written', async () => {
    const good = serializeToMdFolder(SAMPLE, 'model')
    const folder = installFolderApi(good)
    documents.createMdDocument('/tmp/model')
    await settle()
    expect(Object.keys(useDiagramStore.getState().c4Relations)).toEqual(['r1'])

    // A trailing comma, as left by a hand edit.
    folder.disk['relations.json'] = good['relations.json'].replace(/\]\s*$/, ',]')
    folder.emit(['relations.json'])
    await settle()
    expect(Object.keys(useDiagramStore.getState().c4Relations)).toEqual(['r1'])
    expect(notices().some((m) => /relations\.json/.test(m))).toBe(true)

    // The next edit must not reach the folder: it would write the model
    // without the file's content, or remove the file.
    folder.api.writeFolder.mockClear()
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    useDiagramStore.getState().updateNode('sys1', { description: 'edited while the file is broken' })
    await saved()
    expect(folder.api.writeFolder).not.toHaveBeenCalled()
    warn.mockRestore()

    // Fixed outside: read again, and saving works from there.
    folder.disk['relations.json'] = good['relations.json']
    folder.emit(['relations.json'])
    await settle()
    expect(Object.keys(useDiagramStore.getState().c4Relations)).toEqual(['r1'])
    useDiagramStore.getState().updateNode('sys1', { description: 'edited after the fix' })
    await saved()
    expect(folder.api.writeFolder).toHaveBeenCalled()
  })

  it('there when the folder is opened: the user is told and nothing is written', async () => {
    const good = serializeToMdFolder(SAMPLE, 'model')
    const folder = installFolderApi({ ...good, 'relations.json': '[{"id": "r1", ' })
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    documents.createMdDocument('/tmp/model')
    await settle()
    expect(notices().some((m) => /relations\.json/.test(m))).toBe(true)

    useDiagramStore.getState().addNode({ type: 'system', label: 'New', collapsed: false, x: 0, y: 0, width: 400, height: 300 } as any)
    await saved()
    expect(folder.api.writeFolder).not.toHaveBeenCalled()
    await expect(documents.saveDocument(documents.getActiveId()!, SAMPLE)).rejects.toThrow(/relations\.json/)
    expect(folder.api.writeFolder).not.toHaveBeenCalled()
    warn.mockRestore()
  })
})
