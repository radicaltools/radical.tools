// Follow the agent: each outside change opens the view that shows what it
// added or changed and frames the agent's turn there, until the user takes
// the camera; the next turn is followed again.
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { documents } from '../src/renderer/src/store/documentStore'
import { useDiagramStore } from '@radical/ui/store/diagramStore'
import { noteUserCamera } from '@radical/ui/store/userCamera'
import { serializeToMdFolder } from '@radical/common/formats/mdFolder'
import type { ForgeRunStatus } from '@radical/common/formats/forgeRunStatus'
import { setChangeFlashDuration } from '../src/renderer/src/persistence/changeFlash'
import { setFollowAgent, setFollowAgentQuiet, useFollowAgentStore } from '../src/renderer/src/persistence/followAgent'
import { useAgentForgeStore } from '../src/renderer/src/persistence/agentForge'
import type { FolderChange } from '@radical/host-bridge'
import type { C4Node, DiagramData, DiagramView } from '@radical/common/c4'

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

const sys = (id: string, label: string, x = 0): C4Node =>
  ({ id, type: 'system', label, collapsed: false, x, y: 0, width: 400, height: 300 })
const view = (id: string, name: string, nodeIds: string[]): DiagramView => ({ id, name, nodeIds, positions: {} })

const run = (state: ForgeRunStatus['state']): ForgeRunStatus => ({
  version: 1, client: 'claude-code', startedAt: new Date().toISOString(), updatedAt: new Date().toISOString(), state,
  stages: [{ id: 'requirements', status: 'generating' }],
})

/** A folder document whose content `edit` replaces, as an agent over MCP would. */
async function openFolder(data: DiagramData) {
  const disk: Record<string, string> = serializeToMdFolder(data, 'model')
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
  return async (next: DiagramData): Promise<void> => {
    for (const k of Object.keys(disk)) delete disk[k]
    Object.assign(disk, serializeToMdFolder(next, 'model'))
    listener?.({ folderPath: '/tmp/model', paths: ['nodes'] })
    await settle()
  }
}

describe('follow the agent', () => {
  beforeEach(() => {
    ;(globalThis as any).localStorage = new MemLS()
    if (!(globalThis as any).crypto?.randomUUID) {
      ;(globalThis as any).crypto = { randomUUID: () => 'id-' + Math.random().toString(36).slice(2) }
    }
    setChangeFlashDuration(50)
    setFollowAgentQuiet(300)
  })

  it('opens a view that shows what the agent adds, frames its turn, waits after the user takes the camera, and stops with the run', async () => {
    const focus = vi.fn()
    ;(globalThis as any).window.__rfFocusNodes = focus
    const nodes = [sys('sys1', 'Payments'), sys('sys2', 'Ledger', 500)]
    // A blank view shows every element: never one to follow to.
    const views = (b: string[]) => [view('blank', 'Blank', []), view('a', 'Payments', ['sys1']), view('b', 'Billing', b)]
    const edit = await openFolder({ nodes, relations: [], views: views(['sys2']) })
    useDiagramStore.getState().setActiveView(null)
    useAgentForgeStore.setState({ status: run('active') })
    setFollowAgent(true)

    // The agent adds Billing, which no view shows yet: Studio stays where it is.
    const billing = sys('sys3', 'Billing', 1000)
    await edit({ nodes: [...nodes, billing], relations: [], views: views(['sys2']) })
    await wait(150)
    expect(useDiagramStore.getState().activeViewId).toBe(null)
    expect(focus).not.toHaveBeenCalled()

    // Then files it into a view, as a Forge stage does when it completes:
    // Studio opens that view and frames Billing.
    await edit({ nodes: [...nodes, billing], relations: [], views: views(['sys2', 'sys3']) })
    expect(useDiagramStore.getState().activeViewId).toBe('b')
    await wait(150)
    expect(focus).toHaveBeenLastCalledWith(['sys3'], { duration: 600 })

    // It changes Billing in the same turn: still framed.
    focus.mockClear()
    await edit({ nodes: [...nodes, { ...billing, label: 'Billing API' }], relations: [], views: views(['sys2', 'sys3']) })
    await wait(150)
    expect(focus).toHaveBeenLastCalledWith(['sys3'], { duration: 600 })

    // The user takes the camera: the rest of the turn leaves it alone.
    focus.mockClear()
    noteUserCamera()
    const audit = sys('sys4', 'Audit', 1500)
    await edit({ nodes: [...nodes, { ...billing, label: 'Billing API' }, audit], relations: [], views: views(['sys2', 'sys3', 'sys4']) })
    await wait(150)
    expect(focus).not.toHaveBeenCalled()

    // After a pause, the agent's next turn is followed again.
    await wait(350)
    const reports = sys('sys5', 'Reports', 2000)
    await edit({ nodes: [...nodes, { ...billing, label: 'Billing API' }, audit, reports], relations: [], views: views(['sys2', 'sys3', 'sys4', 'sys5']) })
    await wait(150)
    expect(focus).toHaveBeenLastCalledWith(['sys5'], { duration: 600 })
    expect(useFollowAgentStore.getState().on).toBe(true)

    // The run finishes: following is off.
    useAgentForgeStore.setState({ status: run('finished') })
    expect(useFollowAgentStore.getState().on).toBe(false)
  })
})
