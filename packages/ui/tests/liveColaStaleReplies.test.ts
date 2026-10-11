/**
 * The live layout's worker answers asynchronously: a tick it sent before it
 * received a newer model (a collapse, an undo) still holds the old model's
 * group boxes. Applied after the collapse, it gave the collapsed group back
 * its expanded size, a big empty rectangle that stayed until the next sync.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import type { LiveColaMessage, LiveColaReply } from '../src/layout/liveColaLayout'

const workers: FakeWorker[] = []
class FakeWorker {
  onmessage: ((e: MessageEvent<LiveColaReply>) => void) | null = null
  onerror: (() => void) | null = null
  sent: LiveColaMessage[] = []
  constructor() { workers.push(this) }
  postMessage(m: LiveColaMessage) { this.sent.push(m) }
  terminate() {}
  reply(m: LiveColaReply) { this.onmessage?.({ data: m } as MessageEvent<LiveColaReply>) }
}

vi.mock('../src/layout/liveCola.worker?worker', () => ({ default: FakeWorker }))

const realWorker = (globalThis as { Worker?: unknown }).Worker
;(globalThis as { Worker?: unknown }).Worker = FakeWorker

afterEach(() => { (globalThis as { Worker?: unknown }).Worker = realWorker })

const { LiveColaLayout } = await import('../src/layout/liveColaLayout')

const nextFrame = () => new Promise((r) => setTimeout(r, 40))

describe('live layout worker replies', () => {
  it('drops positions computed for a model older than the last one sent', async () => {
    const applied: Array<Record<string, { x: number; y: number; width?: number; height?: number }>> = []
    const layout = new LiveColaLayout({
      getModel: () => ({ nodes: {}, relations: {} }),
      applyPositions: (p) => applied.push(p),
    })
    const worker = workers[workers.length - 1]
    layout.start(true)
    const startGen = (worker.sent[worker.sent.length - 1] as { gen: number }).gen

    // A tick of the expanded group is on its way when the user collapses it.
    worker.reply({ type: 'positions', positions: { g: { x: 0, y: 0, width: 900, height: 600 } }, gen: startGen })
    layout.invalidate()
    const collapseGen = (worker.sent[worker.sent.length - 1] as { gen: number }).gen
    expect(collapseGen).toBeGreaterThan(startGen)
    // …and one more arrives after the collapse was sent.
    worker.reply({ type: 'positions', positions: { g: { x: 0, y: 0, width: 900, height: 600 } }, gen: startGen })
    await nextFrame()
    expect(applied).toEqual([])

    worker.reply({ type: 'positions', positions: { g: { x: 5, y: 5 } }, gen: collapseGen })
    await nextFrame()
    expect(applied).toEqual([{ g: { x: 5, y: 5 } }])
    layout.stop()
  })
})
