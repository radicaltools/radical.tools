// An edit made outside Studio (an MCP client, an editor) is highlighted for a
// few seconds after the reload brings it in.
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { documents } from '../src/renderer/src/store/documentStore'
import { useDiagramStore } from '@radical/ui/store/diagramStore'
import { serializeToMdFolder } from '@radical/common/formats/mdFolder'
import { setChangeFlashDuration } from '../src/renderer/src/persistence/changeFlash'
import type { FolderChange } from '@radical/host-bridge'
import type { C4Node, DiagramData } from '@radical/common/c4'

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
const wait = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))

function sys(id: string, label: string, x = 0, description?: string): C4Node {
  return { id, type: 'system', label, collapsed: false, x, y: 0, width: 400, height: 300, ...(description ? { description } : {}) }
}

// Studio reads a folder's descriptions on demand; they still compare.
const audit = sys('sys4', 'Audit', 0, 'Keeps the audit trail.')
const SAMPLE: DiagramData = {
  nodes: [sys('sys1', 'Payments'), sys('sys2', 'Ledger'), audit, sys('sys5', 'Reports', 0, 'Monthly.')],
  relations: [],
}

/** A folder document whose content `edit` replaces, as an outside editor would. */
async function openFolder() {
  const disk: Record<string, string> = serializeToMdFolder(SAMPLE, 'model')
  let listener: ((change: FolderChange) => void) | null = null
  ;(globalThis as any).window.electronAPI = {
    readFolder: vi.fn(async () => ({ success: true, files: { ...disk } })),
    readFile: vi.fn(async () => ({ success: false })),
    writeFolder: vi.fn(async () => ({ success: true })),
    watchFolder: vi.fn(async () => {}),
    onFolderChanged: vi.fn((l: (change: FolderChange) => void) => { listener = l }),
  }
  documents.createMdDocument('/tmp/model')
  await settle()
  return async (data: DiagramData): Promise<void> => {
    for (const k of Object.keys(disk)) delete disk[k]
    Object.assign(disk, serializeToMdFolder(data, 'model'))
    listener?.({ folderPath: '/tmp/model', paths: ['nodes'] })
    await settle()
  }
}

describe('outside changes flash', () => {
  beforeEach(() => {
    ;(globalThis as any).localStorage = new MemLS()
    if (!(globalThis as any).crypto?.randomUUID) {
      ;(globalThis as any).crypto = { randomUUID: () => 'id-' + Math.random().toString(36).slice(2) }
    }
    setChangeFlashDuration(200)
  })

  it('highlights what changed for a while, then takes it down', async () => {
    const edit = await openFolder()
    expect(useDiagramStore.getState().showDiff).toBe(false)
    await edit({
      ...SAMPLE,
      nodes: [sys('sys1', 'Payments API', 700), sys('sys3', 'Billing'), audit, sys('sys5', 'Reports', 0, 'Weekly.')],
    })
    let s = useDiagramStore.getState()
    expect(s.diffHighlight).toEqual({ sys1: 'changed', sys2: 'removed', sys3: 'new', sys5: 'changed' })
    expect(Object.keys(s.diffGhostNodes)).toEqual(['sys2'])
    expect(s.showDiff).toBe(true)

    await wait(300)
    s = useDiagramStore.getState()
    expect(s.diffHighlight).toEqual({})
    expect(s.diffGhostNodes).toEqual({})
    expect(s.showDiff).toBe(false)
  })

  it('shows nothing for a layout change', async () => {
    const edit = await openFolder()
    await edit({ ...SAMPLE, nodes: SAMPLE.nodes.map((n) => ({ ...n, x: n.x + 300 })) })
    expect(useDiagramStore.getState().diffHighlight).toEqual({})
    expect(useDiagramStore.getState().showDiff).toBe(false)
  })

  it('adds up a burst of changes and goes after the last one', async () => {
    setChangeFlashDuration(300)
    const edit = await openFolder()
    await edit({ ...SAMPLE, nodes: [...SAMPLE.nodes, sys('sys3', 'Billing'), sys('sys6', 'Scratch')] })
    await wait(150)
    await edit({ ...SAMPLE, nodes: [...SAMPLE.nodes.filter((n) => n.id !== 'sys2'), sys('sys3', 'Billing v2')] })
    // Billing stays new, Scratch came and went, Ledger is removed.
    expect(useDiagramStore.getState().diffHighlight).toEqual({ sys2: 'removed', sys3: 'new' })
    await wait(200)
    expect(useDiagramStore.getState().diffHighlight).toEqual({ sys2: 'removed', sys3: 'new' })
    await wait(200)
    expect(useDiagramStore.getState().diffHighlight).toEqual({})
  })
})
