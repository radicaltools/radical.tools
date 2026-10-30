// ─── View index ──────────────────────────────────────────────────────────────
//
// What each view's filter gives, for the model's structure, kept in the
// folder's cache (.radical/cache/views.json) so the next open takes it from
// there instead of running the filters (ADR Model cache beside the model).
// Written a moment after a folder model opens or changes, when the index
// read with it is of another structure or lacks a view; the views are
// worked out by then (the view cards count them), so it costs little.

import { buildViewIndex, modelStructure, presetViewIndexOf, viewIndexKey } from '@radical/common/viewPipeline'
import { writeViewIndex } from '@radical/common/formats/modelCache'
import type { DiagramView } from '@radical/common/c4'
import { useDiagramStore } from '@radical/ui/store/diagramStore'
import { documents } from '../store/documentStore'
import { onDocumentLoaded } from './autosave'

const WRITE_AFTER_MS = 3000

/** The index the folder has: of which document, structure and views. */
let kept: { id: string; structure: string; keys: Set<string> } | null = null
let timer: ReturnType<typeof setTimeout> | undefined

function schedule(): void {
  clearTimeout(timer)
  timer = setTimeout(() => { void write() }, WRITE_AFTER_MS)
}

async function write(): Promise<void> {
  const id = documents.getActiveId()
  if (!id || documents.listDocuments().find((d) => d.id === id)?.source !== 'md') return
  const s = useDiagramStore.getState()
  // A milestone on screen is not the folder's model.
  if (s.activeSnapshotId) return
  const views = Object.values(s.views) as DiagramView[]
  const structure = modelStructure(s.c4Nodes, s.c4Relations)
  const keys = views.map((v) => viewIndexKey(v)).filter((k): k is string => !!k)
  if (kept && kept.id === id && kept.structure === structure && keys.every((k) => kept!.keys.has(k))) return
  const index = buildViewIndex(views, s.c4Nodes, s.c4Relations)
  if (await documents.writeViewIndex(id, writeViewIndex(index))) kept = { id, structure, keys: new Set(Object.keys(index.views)) }
}

if (typeof window !== 'undefined') {
  onDocumentLoaded((id) => {
    // The index read with the model, when it was this document's.
    const read = presetViewIndexOf()
    kept = read ? { id, structure: read.structure, keys: new Set(read.keys) } : null
    schedule()
  })
  useDiagramStore.subscribe((s, prev) => {
    if (s.c4Nodes !== prev.c4Nodes || s.c4Relations !== prev.c4Relations || s.views !== prev.views) schedule()
  })
}
