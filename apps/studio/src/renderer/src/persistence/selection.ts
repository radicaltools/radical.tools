// ─── Canvas selection → model folder ─────────────────────────────────────────
//
// Writes what is selected on the canvas (and the view it is selected in) into
// the active md-folder document's `.radical/selection.json`, so an AI client
// on the same folder — the MCP server's get_selection — can act on "the
// selected mockup". Debounced; a document the user leaves gets an empty
// selection, so a client never acts on something no longer on screen.

import { serializeSelection } from '@radical/common/formats/canvasSelection'
import { useDiagramStore } from '@radical/ui/store/diagramStore'
import { documents, useDocumentsStore } from '../store/documentStore'

const PUBLISH_DELAY_MS = 250

interface Picked {
  viewId: string | null
  nodeIds: string[]
  relationIds: string[]
}

const NOTHING: Picked = { viewId: null, nodeIds: [], relationIds: [] }

function pick(): Picked {
  const s = useDiagramStore.getState()
  const nodeIds = s.selectedNodeIds.length ? s.selectedNodeIds : (s.selectedNodeId ? [s.selectedNodeId] : [])
  return { viewId: s.activeViewId, nodeIds, relationIds: s.selectedEdgeId ? [s.selectedEdgeId] : [] }
}

if (typeof window !== 'undefined') {
  let timer: ReturnType<typeof setTimeout> | null = null
  /** Documents a selection was written to, to clear when the user leaves. */
  const written = new Set<string>()
  let shownIn = documents.getActiveId()

  const publish = (id: string, picked: Picked): void => {
    written.add(id)
    void documents.publishSelection(id, serializeSelection(picked))
      .catch((e) => console.warn('[selection] publish failed:', e))
  }

  const schedule = (): void => {
    if (timer !== null) clearTimeout(timer)
    timer = setTimeout(() => {
      timer = null
      const id = documents.getActiveId()
      if (id) publish(id, pick())
    }, PUBLISH_DELAY_MS)
  }

  let prev = useDiagramStore.getState()
  useDiagramStore.subscribe((s) => {
    if (s.selectedNodeIds !== prev.selectedNodeIds || s.selectedNodeId !== prev.selectedNodeId
      || s.selectedEdgeId !== prev.selectedEdgeId || s.activeViewId !== prev.activeViewId) schedule()
    prev = s
  })

  useDocumentsStore.subscribe((s) => {
    if (s.activeId === shownIn) return
    if (shownIn && written.has(shownIn)) publish(shownIn, NOTHING)
    shownIn = s.activeId
    schedule()
  })
}
