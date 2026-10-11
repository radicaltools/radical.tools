// The canvas selection reaches the active md-folder document's folder
// (.radical/selection.json), where the MCP server's get_selection reads it.
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { documents } from '../src/renderer/src/store/documentStore'
import { useDiagramStore } from '@radical/ui/store/diagramStore'
import { serializeToMdFolder } from '@radical/common/formats/mdFolder'
import { parseSelection } from '@radical/common/formats/canvasSelection'
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

const wait = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))

function sys(id: string, label: string) {
  return { id, type: 'system' as const, label, collapsed: false, x: 0, y: 0, width: 400, height: 300 }
}

const SAMPLE: DiagramData = { nodes: [sys('sys1', 'Payments'), sys('sys2', 'Ledger')], relations: [] }

function installFolderApi() {
  const api = {
    readFolder: vi.fn(async () => ({ success: true, files: serializeToMdFolder(SAMPLE, 'model') })),
    readFile: vi.fn(async () => ({ success: false })),
    writeFolder: vi.fn(async () => ({ success: true })),
    watchFolder: vi.fn(async () => {}),
    onFolderChanged: vi.fn(),
    writeSelection: vi.fn(async (_folderPath: string, _content: string) => ({ success: true })),
  }
  ;(globalThis as any).window.electronAPI = api
  return api
}

const lastSelection = (api: ReturnType<typeof installFolderApi>) => {
  const [folderPath, content] = api.writeSelection.mock.calls.at(-1)!
  return { folderPath, selection: parseSelection(content) }
}

describe('canvas selection in the model folder', () => {
  beforeEach(() => {
    ;(globalThis as any).localStorage = new MemLS()
    if (!(globalThis as any).crypto?.randomUUID) {
      ;(globalThis as any).crypto = { randomUUID: () => 'id-' + Math.random().toString(36).slice(2) }
    }
  })

  it('writes the selected nodes and view into the active folder, and clears it on leaving', async () => {
    const api = installFolderApi()
    const meta = documents.createMdDocument('/tmp/model')
    documents.setActiveId(meta.id)
    await wait(20)
    useDiagramStore.getState().setSelectedNodeIds(['sys2', 'sys1'])
    await wait(400)
    expect(lastSelection(api)).toMatchObject({
      folderPath: '/tmp/model',
      selection: { version: 1, viewId: null, nodeIds: ['sys2', 'sys1'], relationIds: [] },
    })

    const other = documents.createLSDocument('scratch', SAMPLE)
    documents.setActiveId(other.id)
    await wait(20)
    expect(lastSelection(api)).toMatchObject({ folderPath: '/tmp/model', selection: { nodeIds: [], relationIds: [] } })
  })
})
