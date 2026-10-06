/**
 * Live WebCoLa layout, main-thread side. The engine (liveColaEngine.ts) runs
 * in a Web Worker (liveCola.worker.ts): a physics step on a few hundred nodes
 * takes tens of milliseconds, which used to come out of every frame. Where
 * workers are unavailable (Node / Vitest) or fail to load, the engine runs
 * on the main thread, pacing its renders on heavy graphs.
 *
 * Kept in a separate module from the engine, like smartLayoutRunner.ts: the
 * worker imports the engine, so the ?worker import must not live there.
 */

import type { C4Node, C4Relation } from '@radical/common/c4'
import { LiveColaEngine, type LiveColaCallbacks, type LiveColaPositions } from './liveColaEngine'
import LiveColaWorkerClass from './liveCola.worker?worker'

export type { LiveColaCallbacks, LiveColaPositions }

type Model = { nodes: Record<string, C4Node>; relations: Record<string, C4Relation> }

/** Messages from LiveColaLayout to its worker (see liveCola.worker.ts). */
export type LiveColaMessage =
  | { type: 'start'; skipBulk: boolean; model: Model }
  | { type: 'invalidate' | 'reset'; model: Model }
  | { type: 'stop' }
  | { type: 'seed' | 'grab' | 'drag'; id: string; x: number; y: number }
  | { type: 'release'; id: string }

export class LiveColaLayout {
  private worker: Worker | null = null
  private engine: LiveColaEngine | null = null
  private _running = false
  private lastSkipBulk = false
  /** Positions from the worker not applied yet: applied once per frame. */
  private pending: LiveColaPositions | null = null
  private frame = 0

  constructor(private readonly callbacks: LiveColaCallbacks) {
    if (typeof Worker !== 'undefined') {
      try {
        this.worker = new LiveColaWorkerClass()
        this.worker.onmessage = (e: MessageEvent<{ type: 'positions'; positions: LiveColaPositions } | { type: 'settled' }>) => {
          if (!this._running) return
          if (e.data.type === 'positions') this.applyNextFrame(e.data.positions)
          else this.settleAfterPending()
        }
        this.worker.onerror = () => this.runInThread()
      } catch {
        this.worker = null
      }
    }
    if (!this.worker) this.runInThread()
  }

  /** Falls back to the engine on this thread, resuming where the worker was. */
  private runInThread(): void {
    this.worker?.terminate()
    this.worker = null
    if (this.engine) return
    this.engine = new LiveColaEngine(this.callbacks, { paceRenders: true })
    if (this._running) this.engine.start(this.lastSkipBulk)
  }

  /** Coalesces worker updates: rendering runs at most once per frame. */
  private applyNextFrame(positions: LiveColaPositions): void {
    this.pending = this.pending ? Object.assign(this.pending, positions) : positions
    if (this.frame) return
    const raf = typeof requestAnimationFrame === 'function' ? requestAnimationFrame : (f: FrameRequestCallback) => setTimeout(() => f(0), 16)
    this.frame = raf(() => {
      this.frame = 0
      const next = this.pending
      this.pending = null
      if (next && this._running) this.callbacks.applyPositions(next)
    }) as unknown as number
  }

  /** Reports rest after the positions still waiting for a frame. */
  private settleAfterPending(): void {
    if (this.frame) {
      const raf = typeof requestAnimationFrame === 'function' ? requestAnimationFrame : (f: FrameRequestCallback) => setTimeout(() => f(0), 16)
      raf(() => { if (this._running) this.callbacks.onSettled?.() })
    } else {
      this.callbacks.onSettled?.()
    }
  }

  private post(message: LiveColaMessage): void {
    this.worker?.postMessage(message)
  }

  get running(): boolean {
    return this._running
  }

  start(skipBulk = false): void {
    if (this._running) return
    this._running = true
    this.lastSkipBulk = skipBulk
    if (this.engine) this.engine.start(skipBulk)
    else this.post({ type: 'start', skipBulk, model: this.callbacks.getModel() })
  }

  stop(): void {
    this._running = false
    this.pending = null
    if (this.engine) this.engine.stop()
    else this.post({ type: 'stop' })
  }

  invalidate(): void {
    if (this.engine) this.engine.invalidate()
    else if (this._running) this.post({ type: 'invalidate', model: this.callbacks.getModel() })
  }

  reset(): void {
    if (this.engine) this.engine.reset()
    else this.post({ type: 'reset', model: this.callbacks.getModel() })
  }

  seedPosition(id: string, x: number, y: number): void {
    if (this.engine) this.engine.seedPosition(id, x, y)
    else this.post({ type: 'seed', id, x, y })
  }

  grab(id: string, x: number, y: number): void {
    if (this.engine) this.engine.grab(id, x, y)
    else this.post({ type: 'grab', id, x, y })
  }

  drag(id: string, x: number, y: number): void {
    if (this.engine) this.engine.drag(id, x, y)
    else this.post({ type: 'drag', id, x, y })
  }

  release(id: string): void {
    if (this.engine) this.engine.release(id)
    else this.post({ type: 'release', id })
  }
}
