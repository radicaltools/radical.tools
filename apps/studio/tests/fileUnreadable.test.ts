// A model kept in a .radical file that does not parse (a trailing comma left
// by a hand edit, a git merge), or that is no longer there. loadDocument
// read either as "a new, empty file": the model opened with 0 elements and no
// word, and the next save wrote the empty model over the file, or made it
// again where it had been deleted.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { documents } from '../src/renderer/src/store/documentStore'
import { useDiagramStore } from '@radical/ui/store/diagramStore'
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

const SAMPLE: DiagramData = {
  nodes: [{ id: 'sys1', type: 'system', label: 'Payments', collapsed: false, x: 0, y: 0, width: 400, height: 300 }],
  relations: [],
}

/** An Electron host with one file on its disk (none when `content` is null). */
function installFileApi(content: string | null) {
  const disk = { content }
  const api = {
    readFile: vi.fn(async () => disk.content === null
      ? { success: false, error: "ENOENT: no such file or directory, open '/tmp/model.radical'" }
      : { success: true, content: disk.content }),
    writeFile: vi.fn(async (_path: string, json: string) => { disk.content = json; return { success: true } }),
  }
  ;(globalThis as any).window.electronAPI = api
  return { api, disk }
}

const notices = (): string[] => useDiagramStore.getState().notifications.map((n) => n.message)

describe('a .radical file that cannot be read', () => {
  beforeEach(() => {
    ;(globalThis as any).localStorage = new MemLS()
    if (!(globalThis as any).crypto?.randomUUID) {
      ;(globalThis as any).crypto = { randomUUID: () => 'id-' + Math.random().toString(36).slice(2) }
    }
    useDiagramStore.setState({ notifications: [] } as any)
    useDiagramStore.getState().setAppMode('designer')
  })
  afterEach(() => { delete (globalThis as any).window.electronAPI })

  it('that does not parse: the user is told which file, and nothing is written to it', async () => {
    const broken = JSON.stringify(SAMPLE, null, 2).replace(/\]\s*\}\s*$/, '],\n}')
    const file = installFileApi(broken)
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    documents.createFSDocument('/tmp/model.radical')
    await settle()
    expect(notices().some((m) => m.includes('/tmp/model.radical') && /cannot be read/.test(m))).toBe(true)

    useDiagramStore.getState().addNode({ type: 'system', label: 'New', collapsed: false, x: 0, y: 0, width: 400, height: 300 } as any)
    await saved()
    expect(file.api.writeFile).not.toHaveBeenCalled()
    expect(file.disk.content).toBe(broken)
    await expect(documents.saveDocument(documents.getActiveId()!, SAMPLE)).rejects.toThrow(/model\.radical/)
    expect(file.api.writeFile).not.toHaveBeenCalled()
    warn.mockRestore()

    // Fixed outside and opened again: read, and saved from there.
    file.disk.content = JSON.stringify(SAMPLE)
    expect((await documents.loadDocument(documents.getActiveId()!))?.nodes).toHaveLength(1)
    await documents.saveDocument(documents.getActiveId()!, SAMPLE)
    expect(file.api.writeFile).toHaveBeenCalled()
  })

  it('that is no longer there: the user is told, and it is not made again', async () => {
    const file = installFileApi(null)
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    documents.createFSDocument('/tmp/model.radical')
    await settle()
    expect(notices().some((m) => m.includes('/tmp/model.radical') && /not there/.test(m))).toBe(true)
    useDiagramStore.getState().addNode({ type: 'system', label: 'New', collapsed: false, x: 0, y: 0, width: 400, height: 300 } as any)
    await saved()
    expect(file.api.writeFile).not.toHaveBeenCalled()
    expect(file.disk.content).toBeNull()
    warn.mockRestore()
  })
})
