/**
 * The Setup wizard of a first start, and the model Studio makes on a first
 * visit. Each start reads this browser's localStorage afresh, as a page load
 * does.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { DiagramData } from '@radical/common/c4'

const store = new Map<string, string>()
;(globalThis as any).localStorage = {
  getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
  setItem: (k: string, v: string) => { store.set(k, String(v)) },
  removeItem: (k: string) => { store.delete(k) },
  clear: () => { store.clear() },
  key: (i: number) => Array.from(store.keys())[i] ?? null,
  get length() { return store.size },
}

const SEED: DiagramData = { nodes: [{ id: 'sys', type: 'system', label: 'System', collapsed: false, x: 0, y: 0, width: 200, height: 100 } as any], relations: [] }

/** One start of Studio in this browser, its modules fresh as after a page
 *  load, in main.tsx's order: the first start is read before the document
 *  store makes its first model. */
async function start() {
  vi.resetModules()
  const { firstStart } = await import('../src/renderer/src/firstStart')
  const { documents } = await import('../src/renderer/src/store/documentStore')
  const settings = await import('@radical/ui/studioSettings')
  const { meta } = documents.ensureActive(() => SEED)
  return { wizard: firstStart(), documents, settings, active: meta.id }
}

beforeEach(() => store.clear())

describe('the Setup wizard of a first start', () => {
  // F-0121: a reload or a new tab before the wizard was finished or skipped
  // took the first visit's model, or a choice made in the wizard, for a
  // returning user's: the wizard never opened again.
  it('opens again after a reload until it is finished or skipped', async () => {
    expect((await start()).wizard).toBe(true)
    expect((await start()).wizard).toBe(true)
    const third = await start()
    expect(third.wizard).toBe(true)
    expect(third.settings.loadStudioSettings().setupDone).toBe(false)
  })

  it('a choice made in it, stored at once, does not end it', async () => {
    const first = await start()
    localStorage.setItem('radical-theme', 'light')
    first.settings.updateStudioSettings({ specialKey: 'shift' })
    const again = await start()
    expect(again.wizard).toBe(true)
    expect(again.settings.loadStudioSettings().specialKey).toBe('shift')
  })

  it('finished or skipped, it stays closed', async () => {
    const first = await start()
    first.settings.updateStudioSettings({ setupDone: true })
    expect((await start()).wizard).toBe(false)
  })

  it('a browser Studio was used in before the wizard existed is set up without it', async () => {
    localStorage.setItem('radical-studio-settings', JSON.stringify({ specialKey: 'ctrl' }))
    const used = await start()
    expect(used.wizard).toBe(false)
    expect(used.settings.loadStudioSettings().setupDone).toBe(true)
  })
})

describe('the model made on a first visit', () => {
  // F-0121: after a reload the Welcome screen listed it under Recent, an
  // "Untitled" model the user never made.
  it('is not the user\'s after a reload either, until it is saved', async () => {
    const first = await start()
    expect(first.documents.isBootSeeded(first.active)).toBe(true)
    const again = await start()
    expect(again.active).toBe(first.active)
    expect(again.documents.isBootSeeded(first.active)).toBe(true)
    await again.documents.saveDocument(first.active, SEED)
    expect(again.documents.isBootSeeded(first.active)).toBe(false)
    expect((await start()).documents.isBootSeeded(first.active)).toBe(false)
  })

  it('a renamed one is the user\'s', async () => {
    const first = await start()
    first.documents.renameDocument(first.active, 'Mine')
    expect((await start()).documents.isBootSeeded(first.active)).toBe(false)
  })
})
