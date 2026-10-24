/**
 * Runs Tidy in a dedicated Web Worker so Studio stays responsive while a
 * large view is tidied; falls back to the engine in-thread where there is
 * no Worker (Node, Vitest). The ?worker import lives here, apart from the
 * engine, so Vite bundles the worker on its own (see smartLayoutRunner.ts).
 */
import type { C4Node, C4Relation } from '@radical/common/c4'
import { runTidyLayout, type TidyLayoutResult, type TidyOptions } from '@radical/layout/tidy'
import TidyWorkerClass from './tidy.worker?worker'

export const TIDY_STOPPED = 'Smart Layout stopped'

export function runTidy(
  nodes: Record<string, C4Node>,
  relations: Record<string, C4Relation>,
  options: Omit<TidyOptions, 'onProgress' | 'shouldStop'>,
  onProgress?: (done: number, message: string) => void,
  signal?: AbortSignal,
): Promise<TidyLayoutResult> {
  if (typeof Worker === 'undefined') {
    return Promise.resolve(runTidyLayout(nodes, relations, { ...options, onProgress, shouldStop: () => !!signal?.aborted }))
  }
  return new Promise<TidyLayoutResult>((resolve, reject) => {
    const worker = new TidyWorkerClass()
    const stop = (): void => { worker.terminate(); reject(new Error(TIDY_STOPPED)) }
    if (signal?.aborted) { stop(); return }
    signal?.addEventListener('abort', stop, { once: true })
    worker.onmessage = (e: MessageEvent<
      | { type: 'result'; result: TidyLayoutResult }
      | { type: 'error'; message: string }
      | { type: 'progress'; done: number; message: string }
    >) => {
      if (e.data.type === 'progress') { onProgress?.(e.data.done, e.data.message); return }
      signal?.removeEventListener('abort', stop)
      worker.terminate()
      if (e.data.type === 'result') resolve(e.data.result)
      else reject(new Error(e.data.message))
    }
    worker.onerror = (e: ErrorEvent) => {
      signal?.removeEventListener('abort', stop)
      worker.terminate()
      reject(new Error(e.message ?? 'tidy worker error'))
    }
    worker.postMessage({ nodes, relations, options })
  })
}
