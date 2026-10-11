/**
 * Web Worker entry point for Smart Layout — everything after the engines.
 *
 * The ELK candidate generation phase runs on the main thread (elk-worker.min.js
 * is itself a web-worker script and cannot be imported inside another worker).
 * This worker receives the raw candidates and does the CPU-intensive rest off
 * the main thread: crossing minimisation and scoring of every candidate, then
 * the annealing phases A / B / C.
 *
 * Protocol
 * ─────────
 * Main → Worker  { nodes, relations, raw, options }   (nodes/relations = visible projection from the ELK phase)
 * Worker → Main  { type: 'result', result: SmartLayoutResult }
 *              | { type: 'error',  message: string }
 *              | { type: 'progress', progress: SmartLayoutProgress }
 */

import { runSmartLayoutWorkerPhase, type SmartLayoutResult, type RawCandidate, type SmartLayoutProgress, type SmartLayoutOptions } from '@radical/layout/smartLayout'
import type { C4Node, C4Relation } from '@radical/common/c4'

self.onmessage = async (e: MessageEvent) => {
  const { nodes, relations, raw, options } = e.data as {
    nodes: Record<string, C4Node>
    relations: Record<string, C4Relation>
    raw: RawCandidate[]
    options?: SmartLayoutOptions
  }
  try {
    const result: SmartLayoutResult = await runSmartLayoutWorkerPhase(
      nodes, relations, raw,
      (progress: SmartLayoutProgress) => self.postMessage({ type: 'progress', progress }),
      options,
    )
    self.postMessage({ type: 'result', result })
  } catch (err) {
    self.postMessage({ type: 'error', message: String(err) })
  }
}
