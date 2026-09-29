// ─── Document backend ────────────────────────────────────────────────────────
//
// How the diagram store reaches the document it is editing. The store itself
// knows nothing about documents or storage: an app that has documents (Studio)
// configures a backend *before the store module is first imported*, because
// the store reads the active document to build its initial state. An app
// without documents (the read-only Hub viewer) configures nothing.
//
// Saving is not part of this interface: the app subscribes to the store and
// persists changes itself (see apps/studio persistence/).

import type { DiagramData } from '@radical/common/c4'

export interface DocumentBackend {
  /** Makes sure there is an active document, creating one from `seed` when
   *  there is none, and returns its content if it can be read synchronously
   *  (for the first paint). Null when it has to be loaded asynchronously. */
  openActive(seed: () => DiagramData): DiagramData | null
  getActiveId(): string | null
  /** Node descriptions of markdown-folder documents load on demand. */
  hydrateNodeBody(docId: string, nodeId: string): Promise<string | undefined>
  getPendingBodyNodeIds(docId: string): string[]
}

let backend: DocumentBackend | null = null

export function configureDocumentBackend(next: DocumentBackend | null): void {
  backend = next
}

export function documentBackend(): DocumentBackend | null {
  return backend
}
