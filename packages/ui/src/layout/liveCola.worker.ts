/**
 * Web Worker host for the live WebCoLa engine (liveColaEngine.ts), so each
 * physics step (tens of milliseconds on a few hundred nodes) runs off the
 * main thread. LiveColaLayout (liveColaLayout.ts) is the main-thread side.
 *
 * Protocol
 * ─────────
 * Main → Worker  { type: 'start', skipBulk, model, gen } | { type: 'invalidate' | 'reset', model, gen }
 *              | { type: 'stop' } | { type: 'seed', id, x, y }
 *              | { type: 'grab', id, x, y, mode, abs?, withIds? } | { type: 'drag', id, x, y, abs? }
 *              | { type: 'release', id }
 * Worker → Main  { type: 'positions', positions, gen } | { type: 'settled', gen }
 *
 * `model` is the store's nodes and relations at the time of the call; the
 * engine reads it whenever it rebuilds. `gen` numbers that model; replies
 * carry the one they were computed from, so the main thread can drop replies
 * already in flight when a newer model was sent.
 */

import { LiveColaEngine } from './liveColaEngine'
import type { LiveColaMessage, LiveColaReply } from './liveColaLayout'

let model: Extract<LiveColaMessage, { model: unknown }>['model'] = { nodes: {}, relations: {} }
let gen = 0
const reply = (message: LiveColaReply) => self.postMessage(message)

const engine = new LiveColaEngine({
  getModel: () => model,
  applyPositions: (positions) => reply({ type: 'positions', positions, gen }),
  onSettled: () => reply({ type: 'settled', gen }),
})

self.onmessage = (e: MessageEvent<LiveColaMessage>) => {
  const m = e.data
  if ('model' in m) { model = m.model; gen = m.gen }
  switch (m.type) {
    case 'start': engine.start(m.skipBulk); break
    case 'invalidate': engine.invalidate(); break
    case 'reset': engine.reset(); break
    case 'stop': engine.stop(); break
    case 'seed': engine.seedPosition(m.id, m.x, m.y); break
    case 'grab': engine.grab(m.id, m.x, m.y, m.mode, m.abs, m.withIds); break
    case 'drag': engine.drag(m.id, m.x, m.y, m.abs); break
    case 'release': engine.release(m.id); break
  }
}
