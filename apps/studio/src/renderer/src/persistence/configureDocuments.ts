// Gives the diagram store Studio's documents to start from. Must be evaluated
// before the store module, so it imports nothing that imports the store.

import { configureDocumentBackend } from '@radical/ui/store/documentBackend'
import { documents, readLocalDocument } from '../store/documentStore'

configureDocumentBackend({
  openActive(seed) {
    const { meta } = documents.ensureActive(seed)
    return meta.source === 'ls' ? readLocalDocument(meta.id) : null
  },
  getActiveId: () => documents.getActiveId(),
  hydrateNodeBody: (docId, nodeId) => documents.hydrateNodeBody(docId, nodeId),
  getPendingBodyNodeIds: (docId) => documents.getPendingBodyNodeIds(docId),
})
