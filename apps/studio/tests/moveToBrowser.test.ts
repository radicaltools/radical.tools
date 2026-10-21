// Move to browser (decided 2026-10-21): a model kept in a file or a folder
// comes back into this browser, as it is on screen; the file or folder
// stays on disk, and Studio no longer writes it.
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { documents } from '../src/renderer/src/store/documentStore'

class MemLS {
  private map = new Map<string, string>()
  getItem(k: string): string | null { return this.map.has(k) ? this.map.get(k)! : null }
  setItem(k: string, v: string): void { this.map.set(k, String(v)) }
  removeItem(k: string): void { this.map.delete(k) }
  clear(): void { this.map.clear() }
  key(i: number): string | null { return [...this.map.keys()][i] ?? null }
  get length(): number { return this.map.size }
}

const MODEL = { nodes: [{ id: 'sys1', type: 'system', label: 'Shop', x: 0, y: 0, width: 10, height: 10, collapsed: false }], relations: [] }

describe('Move to browser', () => {
  beforeEach(() => {
    ;(globalThis as any).localStorage = new MemLS()
    if (!(globalThis as any).crypto?.randomUUID) {
      ;(globalThis as any).crypto = { randomUUID: () => 'id-' + Math.random().toString(36).slice(2) }
    }
  })

  it('keeps a file model in this browser, as shown, and leaves the file alone', async () => {
    const writeFile = vi.fn(async () => ({ success: true }))
    ;(globalThis as any).window.electronAPI = { writeFile, readFile: vi.fn(async () => ({ success: true, content: JSON.stringify(MODEL) })) }
    const meta = documents.createFSDocument('/tmp/shop.radical')
    const moved = documents.moveToBrowser(meta.id, { ...MODEL, nodes: [{ ...MODEL.nodes[0], label: 'Shop (edited)' }] } as any)
    expect(moved).toMatchObject({ id: meta.id, source: 'ls', name: 'shop' })
    expect(moved!.filePath).toBeUndefined()
    expect((await documents.loadDocument(meta.id))!.nodes[0].label).toBe('Shop (edited)')
    await documents.saveDocument(meta.id, MODEL as any)
    expect(writeFile).not.toHaveBeenCalled()
    delete (globalThis as any).window.electronAPI
  })

  it('does nothing for a model already in this browser', () => {
    const meta = documents.createLSDocument('Here', MODEL as any)
    expect(documents.moveToBrowser(meta.id, MODEL as any)).toBeNull()
  })
})
