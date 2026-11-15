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
import { useAgentAssayStore } from '../src/renderer/src/persistence/agentAssay'
import type { AssayRunStatus } from '@radical/common/formats/assayRunStatus'
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

const assay = (state: AssayRunStatus['state']): AssayRunStatus => ({
  version: 1, client: 'claude-code', startedAt: new Date().toISOString(), updatedAt: new Date().toISOString(), state,
  repositories: [{ name: 'RS2', units: 3, facts: 100 }], sources: 0, stages: [{ id: 'c4', status: 'working' }], proposals: { waiting: 0, accepted: 0, rejected: 0 },
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

  // Exploratory runs 25 to 34: the far end of a relation stayed to be shown
  // and pulled Studio to another view later; at a stage's end Studio opened a
  // table where nothing could be framed.
  it('takes a relation\'s far end as context only, and opens a canvas before a table', async () => {
    const focus = vi.fn()
    ;(globalThis as any).window.__rfFocusNodes = focus
    const nodes = [sys('sys1', 'Payments'), sys('sys2', 'Ledger', 500)]
    const table = (ids: string[]): DiagramView => ({ ...view('t', 'Register', ids), kind: 'table' })
    const edit = await openFolder({ nodes, relations: [], views: [view('a', 'Payments', ['sys1']), view('b', 'Ledger', ['sys2'])] })
    useDiagramStore.getState().setActiveView('a')
    useAgentForgeStore.setState({ status: run('active') })
    setFollowAgent(true)

    // A relation from Payments to Ledger, which the open view does not show.
    const rel = { id: 'r1', sourceId: 'sys1', targetId: 'sys2', label: 'books' }
    await edit({ nodes, relations: [rel], views: [view('a', 'Payments', ['sys1']), view('b', 'Ledger', ['sys2'])] })
    await wait(150)
    expect(useDiagramStore.getState().activeViewId).toBe('a')
    // The next write, on Payments alone, does not go after Ledger.
    await edit({ nodes: [{ ...nodes[0], label: 'Payments API' }, nodes[1]], relations: [rel], views: [view('a', 'Payments', ['sys1']), view('b', 'Ledger', ['sys2'])] })
    await wait(150)
    expect(useDiagramStore.getState().activeViewId).toBe('a')

    // Two elements a table shows both of and a canvas one of: the canvas.
    await wait(350)
    const more = [sys('sys3', 'Audit', 1000), sys('sys4', 'Reports', 1500)]
    await edit({ nodes: [{ ...nodes[0], label: 'Payments API' }, nodes[1], ...more], relations: [rel], views: [view('a', 'Payments', ['sys1']), view('b', 'Ledger', ['sys2', 'sys3']), table(['sys3', 'sys4'])] })
    await wait(150)
    expect(useDiagramStore.getState().activeViewId).toBe('b')
    expect(focus).toHaveBeenLastCalledWith(['sys3'], { duration: 600 })
    useAgentForgeStore.setState({ status: run('finished') })
  })

  it('waits while the user types into a field, and follows once it lets the focus go (F-0131)', async () => {
    const focus = vi.fn()
    ;(globalThis as any).window.__rfFocusNodes = focus
    const nodes = [sys('sys1', 'Customer'), sys('sys2', 'Ledger', 500)]
    const views = (b: string[]) => [view('a', 'Customers', ['sys1']), view('b', 'Shop', b)]
    const edit = await openFolder({ nodes, relations: [], views: views(['sys2']) })
    const store = useDiagramStore.getState
    store().setAppMode('designer')
    store().setActiveView('a')
    store().selectNode('sys1')
    useAgentAssayStore.setState({ status: assay('active') })
    setFollowAgent(true)

    // The user types the name in the card while the agent adds Shop's elements.
    store().beginTyping()
    store().updateNode('sys1', { label: 'Customer (online)' })
    const shop = sys('sys3', 'Shop', 1000)
    await edit({ nodes: [{ ...nodes[0], label: 'Customer (online)' }, nodes[1], shop], relations: [], views: views(['sys2', 'sys3']) })
    await wait(150)
    expect(store().activeViewId).toBe('a')
    expect(store().selectedNodeId).toBe('sys1')
    expect(focus).not.toHaveBeenCalled()
    store().updateNode('sys1', { label: 'Customer (online) shopper' })
    expect(store().c4Nodes.sys1.label).toBe('Customer (online) shopper')

    // The field lets the focus go: what the agent did is followed then.
    store().endTyping()
    window.dispatchEvent(new Event('focusout'))
    await wait(150)
    expect(store().activeViewId).toBe('b')
    expect(focus).toHaveBeenLastCalledWith(['sys3'], { duration: 600 })
    useAgentAssayStore.setState({ status: null })
  })

  it('waits only while the focus is in a field typed in: a drop-down, a checkbox or a button with the focus does not hold it back (F-0178)', async () => {
    // A type picked in the card's drop-down kept the focus there, and the
    // agent's writes were followed only once the user clicked elsewhere.
    const field = (tagName: string, extra: Record<string, unknown> = {}) => ({ tagName, nodeName: tagName, isContentEditable: false, type: '', ...extra })
    const cases: Array<[string, Record<string, unknown>, boolean]> = [
      ['a drop-down', field('SELECT'), false],
      ['a checkbox', field('INPUT', { type: 'checkbox' }), false],
      ['a radio button', field('INPUT', { type: 'radio' }), false],
      ['a button', field('BUTTON', { type: 'button' }), false],
      ['a text input', field('INPUT', { type: 'text' }), true],
      ['a number input', field('INPUT', { type: 'number' }), true],
      ['a text area', field('TEXTAREA', { type: 'textarea' }), true],
      ['editable text', field('DIV', { isContentEditable: true }), true],
    ]
    const doc = (globalThis as any).document
    const blank = { activeElement: null, querySelector: () => null, querySelectorAll: () => [] }
    try {
      ;(globalThis as any).document = blank
      const focus = vi.fn()
      ;(globalThis as any).window.__rfFocusNodes = focus
      let nodes = [sys('sys1', 'Customer'), sys('sys2', 'Ledger', 500)]
      const views = () => [view('a', 'Customers', ['sys1']), view('b', 'Shop', nodes.slice(1).map((n) => n.id))]
      const edit = await openFolder({ nodes, relations: [], views: views() })
      const store = useDiagramStore.getState
      store().setAppMode('designer')
      useAgentAssayStore.setState({ status: assay('active') })
      setFollowAgent(true)
      for (const [i, [what, active, waits]] of cases.entries()) {
        store().setActiveView('a')
        await wait(350)
        ;(globalThis as any).document = { ...blank, activeElement: active }
        nodes = [...nodes, sys(`shop${i}`, `Shop ${i}`, 1000 + 500 * i)]
        await edit({ nodes, relations: [], views: views() })
        await wait(150)
        expect(store().activeViewId, what).toBe(waits ? 'a' : 'b')
        // The field lets the focus go: what waited is followed then.
        ;(globalThis as any).document = blank
        window.dispatchEvent(new Event('focusout'))
        await wait(150)
        expect(store().activeViewId, what).toBe('b')
      }
      useAgentAssayStore.setState({ status: null })
    } finally {
      ;(globalThis as any).document = doc
    }
  }, 15_000)

  it('follows an agent\'s Assay run as its Forge run, and stops once neither goes on', () => {
    useAgentForgeStore.setState({ status: null })
    useAgentAssayStore.setState({ status: assay('active') })
    setFollowAgent(true)
    // A Forge run ending leaves the Assay run to follow.
    useAgentForgeStore.setState({ status: run('finished') })
    expect(useFollowAgentStore.getState().on).toBe(true)
    useAgentAssayStore.setState({ status: assay('closed') })
    expect(useFollowAgentStore.getState().on).toBe(false)
    useAgentAssayStore.setState({ status: null })
  })
})
