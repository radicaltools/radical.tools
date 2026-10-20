// Agent on another version: an agent's MCP server records its product
// version with each write; Studio says once per model and version when it is
// not Studio's.
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { documents } from '../src/renderer/src/store/documentStore'
import { useDiagramStore } from '@radical/ui/store/diagramStore'
import { serializeToMdFolder } from '@radical/common/formats/mdFolder'
import { serializeAgentActivity } from '@radical/common/formats/agentActivity'
import { agentVersionNotice, setStudioBuild } from '../src/renderer/src/persistence/agentVersion'
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
  for (let i = 0; i < 8; i++) await new Promise((r) => setTimeout(r, 0))
}
const sys = (id: string, label: string): C4Node => ({ id, type: 'system', label, collapsed: false, x: 0, y: 0, width: 400, height: 300 })

/** A folder document an agent edits through an MCP server of `server()`. */
async function openFolder(data: DiagramData, server: () => string | undefined) {
  const disk: Record<string, string> = serializeToMdFolder(data, 'model')
  let listener: ((change: FolderChange) => void) | null = null
  ;(globalThis as any).window.electronAPI = {
    readFolder: vi.fn(async () => ({ success: true, files: { ...disk } })),
    readFile: vi.fn(async () => ({ success: false })),
    writeFolder: vi.fn(async () => ({ success: true })),
    watchFolder: vi.fn(async () => {}),
    onFolderChanged: vi.fn((l: (change: FolderChange) => void) => { listener = l }),
    readAgentActivity: vi.fn(async () => ({ success: true, content: serializeAgentActivity('claude-code', Date.now() - 60_000, server()) })),
  }
  documents.createMdDocument(`/tmp/model-${Math.random().toString(36).slice(2)}`)
  await settle()
  return async (next: DiagramData): Promise<void> => {
    for (const k of Object.keys(disk)) delete disk[k]
    Object.assign(disk, serializeToMdFolder(next, 'model'))
    listener?.({ folderPath: documents.listDocuments().find((d) => d.id === documents.getActiveId())!.folderPath!, paths: ['nodes'] })
    await settle()
  }
}

const warnings = (): string[] => useDiagramStore.getState().notifications.filter((n) => n.severity === 'warning').map((n) => n.message)

describe('agent on another version', () => {
  beforeEach(() => {
    ;(globalThis as any).localStorage = new MemLS()
    if (!(globalThis as any).crypto?.randomUUID) {
      ;(globalThis as any).crypto = { randomUUID: () => 'id-' + Math.random().toString(36).slice(2) }
    }
    useDiagramStore.setState({ notifications: [] })
    setStudioBuild({ version: '0.3.0', commit: '1a2b3c4' })
  })

  it('warns once when an agent writes through an MCP server of another version', async () => {
    let server: string | undefined = '0.3.0+9f8e7d6'
    const edit = await openFolder({ nodes: [sys('a', 'Shop')], relations: [] }, () => server)

    // A build of Studio's version from another commit: nothing to say.
    await edit({ nodes: [sys('a', 'Shop'), sys('b', 'Ledger')], relations: [] })
    expect(warnings()).toEqual([])

    // An older server: said once, however often it writes.
    server = '0.2.0+716e537'
    await edit({ nodes: [sys('a', 'Shop'), sys('b', 'Ledger API')], relations: [] })
    await edit({ nodes: [sys('a', 'Shop'), sys('b', 'Ledger API'), sys('c', 'Audit')], relations: [] })
    expect(warnings()).toEqual([
      'The agent edits this model through radical-mcp 0.2.0+716e537, older than Studio 0.3.0+1a2b3c4. Builds of different versions may read and write the model differently. Update the agent\'s MCP server to the version of Studio.',
    ])

    // A server that records no version (before 0.3.0): nothing to compare.
    server = undefined
    await edit({ nodes: [sys('a', 'Shop')], relations: [] })
    expect(warnings()).toHaveLength(1)
  })

  it('names a newer server as newer', () => {
    expect(agentVersionNotice('0.4.0', { version: '0.3.0', release: true })).toBe(
      'The agent edits this model through radical-mcp 0.4.0, newer than Studio 0.3.0. Builds of different versions may read and write the model differently. Update Studio to the version of the server.',
    )
    expect(agentVersionNotice('0.3.0+abcdef0', { version: '0.3.0', release: true })).toBeNull()
  })
})
