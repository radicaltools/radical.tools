import React, { useEffect } from 'react'
import { hideRefusal, useDiagramStore } from '../store/diagramStore'
import { descendantIds } from '@radical/common/model'

/**
 * Confirmation modal that appears when the user presses Delete on the canvas.
 * Asks whether to remove the selected element(s) from the underlying model
 * (permanent) or just hide them from the currently active view.
 */
export function DeleteConfirmDialog(): React.ReactElement | null {
  const pending = useDiagramStore((s) => s.pendingDelete)
  const activeViewId = useDiagramStore((s) => s.activeViewId)
  const c4Nodes = useDiagramStore((s) => s.c4Nodes)
  const c4Relations = useDiagramStore((s) => s.c4Relations)
  const resolve = useDiagramStore((s) => s.resolvePendingDelete)
  // A view per element shows what its element holds, a view that lists
  // nothing what its filter gives: nothing is hidden from them.
  const refusal = useDiagramStore((s) => (s.activeViewId ? hideRefusal(s, s.activeViewId) : null))

  // Esc → cancel
  useEffect(() => {
    if (!pending) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); resolve('cancel') }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [pending, resolve])

  if (!pending) return null
  const nodeCount = pending.nodeIds.length
  const edgeCount = pending.edgeIds.length
  if (nodeCount + edgeCount === 0) return null

  const firstNode = pending.nodeIds[0] ? c4Nodes[pending.nodeIds[0]] : null
  const firstEdge = pending.edgeIds[0] ? c4Relations[pending.edgeIds[0]] : null
  const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`
  const summary = nodeCount + edgeCount === 1
    ? (firstNode ? `"${firstNode.label}"` : firstEdge ? `relation "${firstEdge.label || '(unnamed)'}"` : '1 element')
    : [nodeCount ? plural(nodeCount, 'element', 'elements') : '', edgeCount ? plural(edgeCount, 'relation', 'relations') : ''].filter(Boolean).join(' and ')
  // What Remove from model takes: the elements with what lies inside them,
  // and every relation of any of them (the prompt counted the selection
  // only: "8 node(s) + 10 relation(s)" removed 10 and 30).
  const removedNodes = new Set<string>()
  for (const id of pending.nodeIds) {
    if (!c4Nodes[id]) continue
    removedNodes.add(id)
    for (const d of descendantIds(id, c4Nodes)) removedNodes.add(d)
  }
  const removedRelations = Object.values(c4Relations).filter((r) => pending.edgeIds.includes(r.id) || removedNodes.has(r.sourceId) || removedNodes.has(r.targetId)).length
  const removes = [removedNodes.size ? plural(removedNodes.size, 'element', 'elements') : '', removedRelations ? plural(removedRelations, 'relation', 'relations') : ''].filter(Boolean).join(' and ')

  const canHide = !!activeViewId && nodeCount > 0 && !refusal

  return (
    <div className="milestone-modal-backdrop" onClick={() => resolve('cancel')}>
      <div className="milestone-modal" onClick={(e) => e.stopPropagation()}>
        <h3 className="milestone-modal-title">Delete {summary}?</h3>
        <p className="milestone-modal-text">
          Choose how to handle this delete request.
        </p>
        <div className="milestone-modal-options">
          <button className="milestone-option" onClick={() => resolve('model')}>
            <div className="milestone-option-title">Remove from model</div>
            <div className="milestone-option-desc">
              Permanently delete from the model (and from every view that
              references it): {removes}, with what lies inside the elements
              and their relations.
            </div>
          </button>
          <button
            className="milestone-option"
            disabled={!canHide}
            onClick={() => canHide && resolve('view')}
            style={canHide ? undefined : { opacity: 0.45, cursor: 'not-allowed' }}
          >
            <div className="milestone-option-title">
              Hide from current view{activeViewId ? '' : ' (no active view)'}
            </div>
            <div className="milestone-option-desc">
              {canHide
                ? 'Keep the element in the model — just remove it from the active view.'
                : refusal === 'group'
                  ? 'A view per element shows everything its element holds; nothing can be hidden from it.'
                  : refusal === 'filter'
                    ? 'This view shows what its filter gives; change the filter to leave elements out.'
                    : 'Activate a view to be able to hide elements from it without deleting them.'}
            </div>
          </button>
          <button className="milestone-option ghost" onClick={() => resolve('cancel')}>
            <div className="milestone-option-title">Cancel</div>
            <div className="milestone-option-desc">Keep everything as it is.</div>
          </button>
        </div>
      </div>
    </div>
  )
}
