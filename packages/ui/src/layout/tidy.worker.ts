/**
 * Web Worker: runs Tidy off the renderer thread, reporting each move as it
 * is made. Protocol:
 *   Main → Worker  { nodes, relations, options }   (options without functions)
 *   Worker → Main  { type: 'progress', done, message }
 *                | { type: 'result', result }
 *                | { type: 'error', message }
 * Stopping it is terminating it: the run is synchronous, so no message
 * reaches it meanwhile; the time budget runs inside.
 */
import { runTidyLayout, type TidyLayoutResult, type TidyOptions } from '@radical/layout/tidy'
import type { C4Node, C4Relation } from '@radical/common/c4'

self.onmessage = (e: MessageEvent) => {
  const { nodes, relations, options } = e.data as { nodes: Record<string, C4Node>; relations: Record<string, C4Relation>; options: TidyOptions }
  try {
    const result: TidyLayoutResult = runTidyLayout(nodes, relations, {
      ...options,
      onProgress: (done, message) => self.postMessage({ type: 'progress', done, message }),
    })
    self.postMessage({ type: 'result', result })
  } catch (err) {
    self.postMessage({ type: 'error', message: String(err) })
  }
}
