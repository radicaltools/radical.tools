// Regression tests for md-folder data-loss bugs: stale lazy body paths after a
// rename, pruning files the format doesn't own, overlapping folder writes and
// a slow document load landing in another document.
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { documents, readLocalDocument } from '../src/renderer/src/store/documentStore'
import { useDiagramStore } from '@radical/ui/store/diagramStore'
import { serializeToMdFolder, staleMdFolderFiles } from '@radical/common/formats/mdFolder'
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

const tick = (): Promise<void> => new Promise((r) => setTimeout(r, 0))

/** Folder-backed electronAPI over one in-memory folder. Like the main process,
 *  a write lands file by file (yielding in between, as each IPC-backed fs call
 *  does) and then prunes stale files the format owns. `gate`, when set, holds
 *  folder reads until it resolves. */
function installFolderApi(initial: Record<string, string> = {}) {
  const disk: Record<string, string> = { ...initial }
  const io: { gate: Promise<void> | null } = { gate: null }
  ;(globalThis as any).window.electronAPI = {
    pickFolder: vi.fn(async () => ({ success: true, folderPath: '/tmp/model' })),
    readFolder: vi.fn(async () => {
      if (io.gate) await io.gate
      return { success: true, files: { ...disk } }
    }),
    readFile: vi.fn(async (filePath: string) => {
      const rel = filePath.replace(/^\/tmp\/model\//, '')
      return rel in disk ? { success: true, content: disk[rel] } : { success: false }
    }),
    writeFolder: vi.fn(async (_path: string, files: Record<string, string>) => {
      for (const [rel, content] of Object.entries(files)) {
        await tick()
        disk[rel] = content
      }
      await tick()
      for (const rel of staleMdFolderFiles({ ...disk }, files)) delete disk[rel]
      return { success: true }
    }),
  }
  return { disk, io }
}

function sys(id: string, label: string, description?: string, parentId?: string) {
  return {
    id, type: 'system' as const, label, collapsed: false, x: 0, y: 0, width: 400, height: 300,
    ...(description ? { description } : {}), ...(parentId ? { parentId } : {}),
  }
}

const SAMPLE: DiagramData = {
  nodes: [sys('sys1', 'Payments', 'Money mover'), sys('sys2', 'Ledger', 'Keeps the books')],
  relations: [],
}

/** An md doc on the fake folder, loaded lazily: no description in memory. */
async function lazyMdDoc(): Promise<{ id: string; data: DiagramData; disk: Record<string, string> }> {
  const { disk } = installFolderApi()
  const ls = documents.createLSDocument('Draft', SAMPLE)
  const meta = await documents.saveAsFolder(ls.id, SAMPLE)
  const data = await documents.loadDocument(meta!.id)
  expect(data!.nodes.every((n) => n.description === undefined)).toBe(true)
  return { id: meta!.id, data: data!, disk }
}

async function bodyOnDisk(id: string, nodeId: string): Promise<string | undefined> {
  await documents.loadDocument(id)
  return documents.hydrateNodeBody(id, nodeId)
}

describe('md-folder persistence safety', () => {
  beforeEach(() => {
    ;(globalThis as any).localStorage = new MemLS()
    if (!(globalThis as any).crypto?.randomUUID) {
      ;(globalThis as any).crypto = { randomUUID: () => 'id-' + Math.random().toString(36).slice(2) }
    }
    delete (globalThis as any).window.electronAPI
  })

  it('keeps an unopened node\'s description across repeated saves after a rename', async () => {
    const { id, data } = await lazyMdDoc()
    const renamed = { ...data, nodes: data.nodes.map((n) => n.id === 'sys1' ? { ...n, label: 'Payments Hub' } : n) }
    await documents.saveDocument(id, renamed)
    await documents.saveDocument(id, renamed) // the old path no longer exists now
    expect(await documents.hydrateNodeBody(id, 'sys1')).toBe('Money mover')
    expect(await bodyOnDisk(id, 'sys1')).toBe('Money mover')
  })

  it('keeps an unopened node\'s description after it moves into a directory', async () => {
    const { id, data } = await lazyMdDoc()
    // sys2 becomes a child of sys1, and sys1 (a system) is already a directory.
    const moved = { ...data, nodes: data.nodes.map((n) => n.id === 'sys2' ? { ...n, parentId: 'sys1' } : n) }
    await documents.saveDocument(id, moved)
    await documents.saveDocument(id, moved)
    expect(await bodyOnDisk(id, 'sys2')).toBe('Keeps the books')
  })

  it('never deletes files the format does not own', async () => {
    const { id, data, disk } = await lazyMdDoc()
    disk['package.json'] = '{}'
    disk['nodes/README.md'] = '# Notes\n'
    await documents.saveDocument(id, { ...data, nodes: data.nodes.filter((n) => n.id !== 'sys2') })
    expect(disk['package.json']).toBe('{}')
    expect(disk['nodes/README.md']).toBe('# Notes\n')
    expect(Object.keys(disk).some((p) => p.startsWith('nodes/ledger'))).toBe(false)
  })

  it('does not save as folder into a non-model folder unless the user confirms', async () => {
    const { disk } = installFolderApi({ 'package.json': '{"name":"app"}' })
    const ls = documents.createLSDocument('Draft', SAMPLE)
    const confirm = vi.fn(() => false)
    expect(await documents.saveAsFolder(ls.id, SAMPLE, confirm)).toBeNull()
    expect(confirm).toHaveBeenCalledWith('model')
    expect(Object.keys(disk)).toEqual(['package.json'])
    expect(await documents.saveAsFolder(ls.id, SAMPLE)).toBeNull() // no confirm → refuse

    const meta = await documents.saveAsFolder(ls.id, SAMPLE, () => true)
    expect(meta!.source).toBe('md')
    expect(disk['package.json']).toBe('{"name":"app"}')
    expect(disk['radical.md']).toContain('radicalFormat')
  })

  it('saves into an existing model folder without asking', async () => {
    installFolderApi(serializeToMdFolder(SAMPLE, 'model'))
    const ls = documents.createLSDocument('Draft', SAMPLE)
    const confirm = vi.fn(() => false)
    expect(await documents.saveAsFolder(ls.id, SAMPLE, confirm)).not.toBeNull()
    expect(confirm).not.toHaveBeenCalled()
  })

  it('overlapping saves do not prune each other\'s files', async () => {
    const { id, disk } = await lazyMdDoc()
    const full = SAMPLE
    const renamed = { ...SAMPLE, nodes: SAMPLE.nodes.map((n) => n.id === 'sys1' ? { ...n, label: 'Payments Hub' } : n) }
    // The second save starts while the first is still writing.
    await Promise.all([documents.saveDocument(id, full), documents.saveDocument(id, renamed)])
    const sys1Files = Object.entries(disk).filter(([p, c]) => p.startsWith('nodes/') && c.includes('"sys1"'))
    expect(sys1Files.map(([p]) => p)).toEqual(['nodes/payments-hub/_index.md'])
  })

  it('drops a slow load that finishes after the user switched to another document', async () => {
    const { io } = installFolderApi(serializeToMdFolder(SAMPLE, 'model'))
    let release!: () => void
    io.gate = new Promise((r) => { release = r })

    documents.createMdDocument('/tmp/model') // becomes active → folder read starts, held by the gate
    const other: DiagramData = { nodes: [sys('only', 'Other model')], relations: [] }
    const b = documents.createLSDocument('Other', other) // switch away before it lands
    await tick()
    release()
    await tick()
    await tick()

    expect(documents.getActiveId()).toBe(b.id)
    expect(Object.keys(useDiagramStore.getState().c4Nodes)).toEqual(['only'])
  })

  it('writes an edit made just before a switch to the document being left', async () => {
    const a = documents.createLSDocument('A', { nodes: [sys('n1', 'Before')], relations: [] })
    await tick()
    expect(Object.keys(useDiagramStore.getState().c4Nodes)).toEqual(['n1'])
    useDiagramStore.getState().updateNode('n1', { label: 'After' })
    documents.createLSDocument('B', { nodes: [], relations: [] }) // within the 400 ms debounce
    expect(readLocalDocument(a.id)!.nodes.find((n) => n.id === 'n1')!.label).toBe('After')
  })
})
