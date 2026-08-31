import { describe, it, expect, beforeEach, vi } from 'vitest'
import { documents } from '../src/renderer/src/store/documentStore'
import type { DiagramData } from '../src/renderer/src/types/c4'

class MemLS {
  private map = new Map<string, string>()
  getItem(k: string): string | null { return this.map.has(k) ? this.map.get(k)! : null }
  setItem(k: string, v: string): void { this.map.set(k, String(v)) }
  removeItem(k: string): void { this.map.delete(k) }
  clear(): void { this.map.clear() }
  key(i: number): string | null { return [...this.map.keys()][i] ?? null }
  get length(): number { return this.map.size }
}

/** In-memory folder-backed electronAPI: keeps one folder's file map. */
function installFolderApi(): { disk: Record<string, string> } {
  const disk: Record<string, string> = {}
  ;(globalThis as any).window.electronAPI = {
    openFolder: vi.fn(async () => ({ success: true, folderPath: '/tmp/model', files: { ...disk } })),
    pickFolder: vi.fn(async () => ({ success: true, folderPath: '/tmp/model' })),
    readFolder: vi.fn(async () => ({ success: true, files: { ...disk } })),
    writeFolder: vi.fn(async (_path: string, files: Record<string, string>) => {
      // Emulate the main-process prune-and-write: replace managed files.
      for (const k of Object.keys(disk)) delete disk[k]
      Object.assign(disk, files)
      return { success: true }
    }),
  }
  return { disk }
}

const SAMPLE: DiagramData = {
  nodes: [
    { id: 'sys1', type: 'system', label: 'Payments', collapsed: false, x: 0, y: 0, width: 400, height: 300, description: 'Money mover' },
    { id: 'adr1', type: 'adr', label: 'Event sourcing', collapsed: false, x: 0, y: 0, width: 180, height: 52, ...({ status: 'accepted' } as Record<string, unknown>) },
  ],
  relations: [],
}

describe('documents — md-folder backend', () => {
  beforeEach(() => {
    ;(globalThis as any).localStorage = new MemLS()
    if (!(globalThis as any).crypto?.randomUUID) {
      ;(globalThis as any).crypto = { randomUUID: () => 'id-' + Math.random().toString(36).slice(2) }
    }
    delete (globalThis as any).window.electronAPI
  })

  it('imports a folder as an md-backed document', async () => {
    installFolderApi()
    const meta = await documents.importFromFolder()
    expect(meta).not.toBeNull()
    expect(meta!.source).toBe('md')
    expect(meta!.folderPath).toBe('/tmp/model')
    expect(meta!.name).toBe('model')
  })

  it('saveAsFolder writes markdown and converts an LS doc to md-backed', async () => {
    const { disk } = installFolderApi()
    const ls = documents.createLSDocument('Draft', SAMPLE)
    const meta = await documents.saveAsFolder(ls.id, SAMPLE)
    expect(meta).not.toBeNull()
    expect(meta!.source).toBe('md')
    // One markdown file per element, plus the manifest.
    expect(disk['radical.md']).toContain('radicalFormat')
    expect(Object.keys(disk).some((p) => p.startsWith('nodes/payments'))).toBe(true)
    expect(Object.keys(disk).some((p) => p.startsWith('nodes/event-sourcing'))).toBe(true)
  })

  it('round-trips through save + load on the md backend', async () => {
    installFolderApi()
    const ls = documents.createLSDocument('Draft', SAMPLE)
    const meta = await documents.saveAsFolder(ls.id, SAMPLE)
    await documents.saveDocument(meta!.id, SAMPLE)
    const loaded = await documents.loadDocument(meta!.id)
    expect(loaded).not.toBeNull()
    const byId = Object.fromEntries(loaded!.nodes.map((n) => [n.id, n]))
    expect(byId.sys1.label).toBe('Payments')
    expect(byId.sys1.description).toBe('Money mover')
    expect((byId.adr1 as unknown as Record<string, unknown>).status).toBe('accepted')
  })
})
