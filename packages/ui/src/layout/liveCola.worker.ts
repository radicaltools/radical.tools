/**
 * Web Worker host for the live WebCoLa engine (liveColaEngine.ts), so each
 * physics step (tens of milliseconds on a few hundred nodes) runs off the
 * main thread. LiveColaLayout (liveColaLayout.ts) is the main-thread side.
 *
 * Protocol
 * ─────────
 * Main → Worker  { type: 'start', skipBulk, model } | { type: 'invalidate' | 'reset', model }
 *              | { type: 'stop' } | { type: 'seed', id, x, y }
 *              | { type: 'grab' | 'drag', id, x, y } | { type: 'release', id }
 * Worker → Main  { type: 'positions', positions }
 *
 * `model` is the store's nodes and relations at the time of the call; the
 * engine reads it whenever it rebuilds.
 */

import { LiveColaEngine } from './liveColaEngine'
import type { LiveColaMessage } from './liveColaLayout'

let model: Extract<LiveColaMessage, { model: unknown }>['model'] = { nodes: {}, relations: {} }

const engine = new LiveColaEngine({
  getModel: () => model,
  applyPositions: (positions) => self.postMessage({ type: 'positions', positions }),
})

self.onmessage = (e: MessageEvent<LiveColaMessage>) => {
  const m = e.data
  if ('model' in m) model = m.model
  switch (m.type) {
    case 'start': engine.start(m.skipBulk); break
    case 'invalidate': engine.invalidate(); break
    case 'reset': engine.reset(); break
    case 'stop': engine.stop(); break
    case 'seed': engine.seedPosition(m.id, m.x, m.y); break
    case 'grab': engine.grab(m.id, m.x, m.y); break
    case 'drag': engine.drag(m.id, m.x, m.y); break
    case 'release': engine.release(m.id); break
  }
}
