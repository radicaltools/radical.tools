/**
 * Live WebCoLa layout, main-thread side. The engine (@radical/layout liveColaEngine.ts) runs
 * in a Web Worker (liveCola.worker.ts): a physics step on a few hundred nodes
 * takes tens of milliseconds, which used to come out of every frame. Where
 * workers are unavailable (Node / Vitest) or fail to load, or the page asks
 * for it, the engine runs on the main thread, pacing its renders on heavy
 * graphs.
 *
 * Kept in a separate module from the engine, like smartLayoutRunner.ts: the
 * worker imports the engine, so the ?worker import must not live there.
 */

import { LiveColaEngine, type DragMode, type LiveColaCallbacks, type LiveColaModel, type LiveColaPositions } from '@radical/layout/liveColaEngine'
import LiveColaWorkerClass from './liveCola.worker?worker'

export type { DragMode, LiveColaCallbacks, LiveColaPositions }

type Model = LiveColaModel

/** Messages from LiveColaLayout to its worker (see liveCola.worker.ts).
 *  `gen` numbers the builds: the worker tags its replies with the build they
 *  come from. */
export type LiveColaMessage =
  | { type: 'start'; skipBulk: boolean; model: Model; gen: number }
  | { type: 'invalidate' | 'relax'; model: Model; gen: number; added?: string[]; covered?: boolean }
  | { type: 'reset'; model: Model; gen: number; free?: string[]; aligned?: string[] }
  | { type: 'stop' }
  | { type: 'seed'; id: string; x: number; y: number }
  | { type: 'grab'; id: string; x: number; y: number; mode: DragMode; abs?: { x: number; y: number }; withIds?: string[] }
  | { type: 'drag'; id: string; x: number; y: number; abs?: { x: number; y: number } }
  | { type: 'release'; id: string }

/**
 * The host page can keep the engine on the main thread by setting
 * `window.__RADICAL_LIVE_LAYOUT = 'thread'` before the app loads. Screenshot
 * tests do: a frozen page clock drives the page's timers and frames but not a
 * worker's, which would keep stepping in real time between frozen frames.
 */
function inThreadRequested(): boolean {
  return (globalThis as { __RADICAL_LIVE_LAYOUT?: unknown }).__RADICAL_LIVE_LAYOUT === 'thread'
}

/** Messages from the worker to LiveColaLayout, tagged with their build. */
export type LiveColaReply =
  | { type: 'positions'; positions: LiveColaPositions; gen: number }
  | { type: 'settled'; gen: number }
  /** The release before it is done: its positions were sent. */
  | { type: 'released'; gen: number }

export class LiveColaLayout {
  private worker: Worker | null = null
  private engine: LiveColaEngine | null = null
  private _running = false
  private lastSkipBulk = false
  /** Positions from the worker not applied yet: applied once per frame. */
  private pending: LiveColaPositions | null = null
  private frame = 0
  /** Build sent to the worker last (see LiveColaMessage). */
  private gen = 0
  /** Called once the release sent last has put the drop where it landed. */
  private landed: (() => void) | null = null

  constructor(private readonly callbacks: LiveColaCallbacks) {
    if (typeof Worker !== 'undefined' && !inThreadRequested()) {
      try {
        this.worker = new LiveColaWorkerClass()
        this.worker.onmessage = (e: MessageEvent<LiveColaReply>) => {
          if (!this._running) return
          // A reply the worker sent before it got the latest model (collapse,
          // undo, view switch) holds that model's sizes: applied now, a
          // collapsed group would get back its expanded box.
          if (e.data.gen !== this.gen) return
          if (e.data.type === 'positions') this.applyNextFrame(e.data.positions)
          else if (e.data.type === 'released') this.landAfterPending()
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

  /** Says the release has landed, after the positions still waiting for a
   *  frame (its own among them). */
  private landAfterPending(): void {
    const landed = this.landed
    this.landed = null
    if (!landed) return
    const raf = typeof requestAnimationFrame === 'function' ? requestAnimationFrame : (f: FrameRequestCallback) => setTimeout(() => f(0), 16)
    if (this.frame) raf(() => landed())
    else landed()
  }

  /** Starts a new build: replies and positions of the previous one are void. */
  private nextGen(): number {
    this.pending = null
    return ++this.gen
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
    else this.post({ type: 'start', skipBulk, model: this.callbacks.getModel(), gen: this.nextGen() })
  }

  stop(): void {
    this._running = false
    this.pending = null
    if (this.engine) this.engine.stop()
    else this.post({ type: 'stop' })
  }

  /** See LiveColaEngine.invalidate. */
  invalidate(added?: string[], covered?: boolean): void {
    if (this.engine) this.engine.invalidate(added, covered)
    else if (this._running) this.post({ type: 'invalidate', model: this.callbacks.getModel(), gen: this.nextGen(), added, covered })
  }

  /** See LiveColaEngine.reset. */
  reset(free?: string[], aligned?: string[]): void {
    if (this.engine) this.engine.reset(free, aligned)
    else this.post({ type: 'reset', model: this.callbacks.getModel(), gen: this.nextGen(), free, aligned })
  }

  /** Starts the layout relaxing the whole diagram (LiveColaEngine.relaxLive). */
  relax(): void {
    this._running = true
    if (this.engine) this.engine.relaxLive()
    else this.post({ type: 'relax', model: this.callbacks.getModel(), gen: this.nextGen() })
  }

  seedPosition(id: string, x: number, y: number): void {
    if (this.engine) this.engine.seedPosition(id, x, y)
    else this.post({ type: 'seed', id, x, y })
  }

  /** See LiveColaEngine.grab. */
  grab(id: string, x: number, y: number, mode: DragMode = 'push', abs?: { x: number; y: number }, withIds?: string[]): void {
    if (this.engine) this.engine.grab(id, x, y, mode, abs, withIds)
    else this.post({ type: 'grab', id, x, y, mode, abs, withIds })
  }

  drag(id: string, x: number, y: number, abs?: { x: number; y: number }): void {
    if (this.engine) this.engine.drag(id, x, y, abs)
    else this.post({ type: 'drag', id, x, y, abs })
  }

  /** See LiveColaEngine.release. `landed` is called once the positions it
   *  makes are applied (the worker answers a frame or more later; never
   *  before this call returns). */
  release(id: string, landed?: () => void): void {
    this.landed = landed ?? null
    if (this.engine) {
      this.engine.release(id)
      // On this thread the positions are applied (or paced into a frame) by now.
      const raf = typeof requestAnimationFrame === 'function' ? requestAnimationFrame : (f: FrameRequestCallback) => setTimeout(() => f(0), 16)
      raf(() => this.landAfterPending())
    } else {
      this.post({ type: 'release', id })
    }
  }
}
